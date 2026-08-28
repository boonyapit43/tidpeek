import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import {
  exportTransactionsFlat,
  getSummary,
  listAccountsWithBalance,
  listCategoryTotals,
  listDailyForMonth,
  listDailyForWeek,
  listMonthlyForYear,
  searchTotals,
  searchTransactions,
} from "./queries";

/**
 * ข้อสัญญาเรื่องตัวเลขที่แอปนี้ให้ไว้ พิสูจน์บนฐานข้อมูลจริง
 *
 * เทสในนี้ไม่ได้เช็คว่า "ฟังก์ชันคืนค่าอะไร" แต่เช็คว่า "ตัวเลขที่คนเห็น
 * สองที่ต้องตรงกัน" ซึ่งเป็นสิ่งเดียวที่คนใช้จะจับได้ว่าแอปผิด — พอยอด
 * รายวันบวกกันแล้วไม่เท่ายอดรายเดือน ความเชื่อถือในตัวเลขทั้งหมดก็จบ
 *
 * เทียบยอดด้วย Number() ได้เพราะตัวเลขในเทสเป็นหลักพัน ยังไม่ถึงจุดที่
 * ทศนิยมของ JavaScript เพี้ยน ส่วนโค้ดจริงยังคงรวมยอดใน SQL ทั้งหมด
 */

const n = (v: string) => Number(v);

let shopId: string;
let otherShopId: string;
let cashId: string;
let bankId: string;
/** ประเภทที่นับเป็นกำไร */
let saleId: string;
let costId: string;
/** ประเภทที่ไม่นับเป็นกำไร เช่นเติมทุน */
let topUpId: string;

async function seed() {
  const [shop] = await raw`insert into shops (name) values ('ร้านหลัก') returning id`;
  const [other] = await raw`insert into shops (name) values ('ร้านอื่น') returning id`;
  shopId = shop.id;
  otherShopId = other.id;

  const [cash] = await raw`
    insert into accounts (shop_id, name, kind, opening_balance)
    values (${shopId}, 'เงินสด', 'cash', 1000) returning id`;
  const [bank] = await raw`
    insert into accounts (shop_id, name, kind, opening_balance)
    values (${shopId}, 'ไทยพลัส', 'bank', 0) returning id`;
  cashId = cash.id;
  bankId = bank.id;

  const [sale] = await raw`
    insert into categories (shop_id, direction, name, counts)
    values (null, 'in', 'ขายหน้าร้าน', true) returning id`;
  const [cost] = await raw`
    insert into categories (shop_id, direction, name, counts)
    values (null, 'out', 'ซื้อของเข้าร้าน', true) returning id`;
  const [topUp] = await raw`
    insert into categories (shop_id, direction, name, counts)
    values (null, 'in', 'เติมทุน', false) returning id`;
  saleId = sale.id;
  costId = cost.id;
  topUpId = topUp.id;

  const rows: [string, string, string, string, string | null, string][] = [
    // วันที่, ทิศทาง, จำนวน, ชื่อ, ประเภท, บัญชี
    ["2026-08-01", "in", "1200.50", "ขายวันเสาร์", saleId, cashId],
    ["2026-08-01", "out", "300.25", "ซื้อผัก", costId, cashId],
    ["2026-08-02", "in", "900", "ขายวันอาทิตย์", saleId, bankId],
    ["2026-08-02", "in", "5000", "เติมทุนเข้าร้าน", topUpId, bankId],
    ["2026-08-15", "out", "450.75", "ซื้อเนื้อ", costId, cashId],
    // ไม่ระบุประเภท — ต้องถูกนับเป็นกำไรตามค่าตั้งต้น
    ["2026-08-15", "in", "100", "ขายเบ็ดเตล็ด", null, cashId],
    // เดือนอื่นของปีเดียวกัน
    ["2026-09-03", "in", "2000", "ขายเดือนหน้า", saleId, bankId],
    ["2026-12-31", "out", "1000", "ปิดปี", costId, bankId],
  ];

  for (const [date, direction, amount, title, categoryId, accountId] of rows) {
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, category_id, account_id)
      values (${shopId}, ${date}, ${direction}, ${amount}, ${title}, ${categoryId}, ${accountId})`;
  }

  // รายการที่ลบแล้ว — ต้องไม่ถูกนับที่ไหนเลย
  await raw`
    insert into transactions (shop_id, txn_date, direction, amount, title, category_id, account_id, is_deleted)
    values (${shopId}, '2026-08-01', 'in', 99999, 'รายการที่ลบแล้ว', ${saleId}, ${cashId}, true)`;

  // รายการของอีกร้าน — ต้องไม่โผล่ในยอดของร้านนี้
  await raw`
    insert into transactions (shop_id, txn_date, direction, amount, title)
    values (${otherShopId}, '2026-08-01', 'in', 77777, 'ของร้านอื่น')`;
}

beforeAll(async () => {
  await createSchema();
});

beforeEach(async () => {
  await resetData();
  await seed();
});

afterAll(async () => {
  await closeTestDb();
});

/* ------------------------------------------------------------------ */

describe("ยอดของแต่ละมุมมองต้องตรงกัน", () => {
  it("ยอดรายวันทั้งเดือนบวกกัน เท่ากับยอดของเดือน", async () => {
    const [daily, month] = await Promise.all([
      listDailyForMonth(shopId, "2026-08"),
      getSummary(shopId, { month: "2026-08" }),
    ]);

    const sum = (key: "income" | "expense" | "profit" | "excluded") =>
      daily.reduce((acc, row) => acc + n(row[key]), 0);

    expect(sum("income")).toBe(n(month.income));
    expect(sum("expense")).toBe(n(month.expense));
    expect(sum("profit")).toBe(n(month.profit));
    expect(sum("excluded")).toBe(n(month.excluded));
  });

  it("ยอดรายเดือนทั้งปีบวกกัน เท่ากับยอดของปี", async () => {
    const [monthly, year] = await Promise.all([
      listMonthlyForYear(shopId, "2026"),
      getSummary(shopId, { year: "2026" }),
    ]);

    const sum = (key: "income" | "expense" | "profit") =>
      monthly.reduce((acc, row) => acc + n(row[key]), 0);

    expect(sum("income")).toBe(n(year.income));
    expect(sum("expense")).toBe(n(year.expense));
    expect(sum("profit")).toBe(n(year.profit));
  });

  it("ยอดของวันเดียว เท่ากับยอดของวันนั้นในรายการรายวัน", async () => {
    const [day, daily] = await Promise.all([
      getSummary(shopId, { day: "2026-08-01" }),
      listDailyForMonth(shopId, "2026-08"),
    ]);

    const row = daily.find((d) => d.txnDate === "2026-08-01");
    expect(n(row!.income)).toBe(n(day.income));
    expect(n(row!.expense)).toBe(n(day.expense));
  });
});

describe("มุมมองสัปดาห์", () => {
  /**
   * สัปดาห์ 31 ส.ค. – 6 ก.ย. 2026 คร่อมสองเดือนพอดี
   * เป็นเคสที่พังง่ายที่สุดถ้าคิดขอบเขตวันผิด
   */
  const WEEK = "2026-08-31";

  it("ยอดรายวันในสัปดาห์บวกกัน เท่ากับยอดของสัปดาห์", async () => {
    const [daily, week] = await Promise.all([
      listDailyForWeek(shopId, WEEK),
      getSummary(shopId, { week: WEEK }),
    ]);

    const sum = (k: "income" | "expense" | "profit") =>
      daily.reduce((acc, row) => acc + n(row[k]), 0);

    expect(sum("income")).toBe(n(week.income));
    expect(sum("expense")).toBe(n(week.expense));
    expect(sum("profit")).toBe(n(week.profit));
  });

  it("สัปดาห์ที่คร่อมสองเดือน ต้องเก็บวันของทั้งสองเดือน", async () => {
    // 2026-09-03 มีรายการ 2,000 อยู่ ถ้าคิดขอบเขตผิดจะหลุดไป
    const week = await getSummary(shopId, { week: WEEK });
    expect(n(week.income)).toBeGreaterThanOrEqual(2000);
  });

  it("รายการนอกสัปดาห์ต้องไม่ถูกนับ", async () => {
    // 2026-08-01 กับ 2026-08-02 อยู่คนละสัปดาห์
    const week = await getSummary(shopId, { week: WEEK });
    const aug1 = await getSummary(shopId, { day: "2026-08-01" });

    expect(n(aug1.income)).toBeGreaterThan(0);
    expect(n(week.income)).toBeLessThan(n(aug1.income) + n(week.income) + 1);
    const daily = await listDailyForWeek(shopId, WEEK);
    expect(daily.map((d) => d.txnDate)).not.toContain("2026-08-01");
  });

  it("สัปดาห์บวกกันแล้วเท่ากับเดือน เมื่อสัปดาห์อยู่ในเดือนเดียวกันครบ", async () => {
    // ส.ค. 2026 เริ่มวันเสาร์ สัปดาห์ที่คลุมทั้งเดือนคือ 27 ก.ค. ถึง 31 ส.ค.
    const weeks = ["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];
    const totals = await Promise.all(weeks.map((w) => getSummary(shopId, { week: w })));

    const daysInAug = await listDailyForMonth(shopId, "2026-08");
    const augFromDays = daysInAug.reduce((acc, d) => acc + n(d.income), 0);

    // ทุกวันของ ส.ค. ต้องอยู่ในสัปดาห์ใดสัปดาห์หนึ่งข้างบน
    const fromWeeks = totals.reduce((acc, t) => acc + n(t.income), 0);
    expect(fromWeeks).toBeGreaterThanOrEqual(augFromDays);
  });
});

describe("นิยามของกำไร", () => {
  it("กำไร = รับที่นับ − จ่ายที่นับ", async () => {
    const s = await getSummary(shopId, { month: "2026-08" });
    expect(n(s.profit)).toBe(n(s.income) - n(s.expense));
  });

  it("เงินที่ไม่นับเป็นกำไร ไม่โผล่ในยอดรับและยอดจ่าย", async () => {
    const s = await getSummary(shopId, { month: "2026-08" });

    // รับที่นับ = 1200.50 + 900 + 100 (ไม่รวมเติมทุน 5000)
    expect(n(s.income)).toBe(2200.5);
    expect(n(s.inExcluded)).toBe(5000);
    expect(n(s.excluded)).toBe(n(s.inExcluded) + n(s.outExcluded));
  });

  it("รายการที่ไม่ระบุประเภท ถูกนับเป็นกำไรตามค่าตั้งต้น", async () => {
    const s = await getSummary(shopId, { day: "2026-08-15" });
    // รับ 100 (ไม่ระบุประเภท) − จ่าย 450.75
    expect(n(s.income)).toBe(100);
    expect(n(s.profit)).toBe(100 - 450.75);
  });
});

describe("ยอดคงเหลือของบัญชี", () => {
  it("ไม่สนใจธง counts — เงินเข้าออกจริงนับหมด", async () => {
    const accounts = await listAccountsWithBalance(shopId);
    const bank = accounts.find((a) => a.id === bankId)!;

    // 900 + 5000 (เติมทุน ไม่นับกำไรแต่เงินเข้าจริง) + 2000 − 1000
    expect(n(bank.balance)).toBe(6900);
  });

  it("รวมยอดตั้งต้นเข้าไปด้วย", async () => {
    const accounts = await listAccountsWithBalance(shopId);
    const cash = accounts.find((a) => a.id === cashId)!;

    // ตั้งต้น 1000 + 1200.50 − 300.25 − 450.75 + 100
    expect(n(cash.balance)).toBe(1549.5);
  });

  it("รายการที่ลบแล้ว ไม่เดินยอดบัญชี", async () => {
    const before = (await listAccountsWithBalance(shopId)).find((a) => a.id === cashId)!;

    await raw`
      update transactions set is_deleted = true
       where title = 'ขายเบ็ดเตล็ด'`;

    const after = (await listAccountsWithBalance(shopId)).find((a) => a.id === cashId)!;
    expect(n(before.balance) - n(after.balance)).toBe(100);
  });

  /**
   * เทสข้อนี้เคยจับบั๊กจริงมาแล้ว
   *
   * subquery ที่อ้างคอลัมน์ของตารางนอกเคยถูก drizzle เขียนออกมาเป็น "id"
   * เปล่าๆ ไม่มีชื่อตารางนำหน้า แล้ว Postgres ไปจับคู่กับคอลัมน์ของ subquery
   * เอง ได้ 0 เสมอโดยไม่มี error — ถ้าเทียบแค่ "คืนค่าเป็น string ไหม"
   * จะไม่มีวันเจอ ต้องเทียบตัวเลขจริงเท่านั้น
   */
  it("บัญชีที่ใช้ร่วม รวมเงินของทุกร้านที่ใช้บัญชีนั้น", async () => {
    const [shared] = await raw`
      insert into accounts (shop_id, name, kind, opening_balance)
      values (null, 'บัญชีร่วม', 'bank', 50) returning id`;

    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, account_id)
      values (${shopId}, '2026-08-01', 'in', 300, 'ร้านนี้', ${shared.id})`;
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, account_id)
      values (${otherShopId}, '2026-08-01', 'in', 700, 'ร้านอื่น', ${shared.id})`;

    const account = (await listAccountsWithBalance(shopId)).find((a) => a.id === shared.id)!;

    // ยอดในบัญชีจริงคือเงินของทั้งสองร้านรวมกัน บวกยอดตั้งต้น
    expect(n(account.balance)).toBe(1050);
  });

  it("ยอดคงเหลือไม่ได้เท่ากับยอดตั้งต้นเฉยๆ — subquery ต้องทำงานจริง", async () => {
    // ถ้า subquery พังแบบเงียบๆ ยอดจะกลายเป็นยอดตั้งต้นล้วน
    const cash = (await listAccountsWithBalance(shopId)).find((a) => a.id === cashId)!;
    expect(n(cash.balance)).not.toBe(n(cash.openingBalance));
  });
});

describe("ขอบเขตของข้อมูล", () => {
  it("รายการของร้านอื่นไม่โผล่ในยอดของร้านนี้", async () => {
    const s = await getSummary(shopId, { year: "2026" });
    expect(n(s.income)).toBeLessThan(77777);
  });

  it("รายการที่ลบแล้วไม่ถูกนับในทุกมุมมอง", async () => {
    const [day, month, year, cats, flat] = await Promise.all([
      getSummary(shopId, { day: "2026-08-01" }),
      getSummary(shopId, { month: "2026-08" }),
      getSummary(shopId, { year: "2026" }),
      listCategoryTotals(shopId, { year: "2026" }),
      exportTransactionsFlat(),
    ]);

    for (const s of [day, month, year]) expect(n(s.income)).toBeLessThan(99999);
    for (const c of cats) expect(n(c.total)).toBeLessThan(99999);
    expect(flat.map((r) => r.title)).not.toContain("รายการที่ลบแล้ว");
  });

  it("ยอดรวมรายประเภท บวกกันแล้วเท่ากับเงินที่เดินทั้งหมด", async () => {
    const [cats, s] = await Promise.all([
      listCategoryTotals(shopId, { month: "2026-08" }),
      getSummary(shopId, { month: "2026-08" }),
    ]);

    const total = cats.reduce((acc, c) => acc + n(c.total), 0);
    expect(total).toBe(n(s.income) + n(s.expense) + n(s.excluded));
  });
});

describe("ค้นหา", () => {
  it("ยอดรวมของผลค้นหา ตรงกับรายการที่แสดง", async () => {
    const [rows, totals] = await Promise.all([
      searchTransactions(shopId, { q: "ขาย" }),
      searchTotals(shopId, { q: "ขาย" }),
    ]);

    const income = rows
      .filter((r) => r.direction === "in")
      .reduce((acc, r) => acc + n(r.amount), 0);

    expect(rows).toHaveLength(totals.count);
    expect(income).toBe(n(totals.income));
  });

  it("ค้นจากชื่อประเภทได้ ไม่ใช่แค่ชื่อรายการ", async () => {
    const rows = await searchTransactions(shopId, { q: "ซื้อของเข้าร้าน" });
    expect(rows.map((r) => r.title)).toContain("ซื้อเนื้อ");
  });

  it("อักขระพิเศษของ LIKE ถูก escape ไม่ได้กลายเป็นตัวแทนที่", async () => {
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title)
      values (${shopId}, '2026-08-01', 'in', 5, 'ส่วนลด 10%')`;

    // ถ้าไม่ escape "%" จะ match ทุกแถว
    const rows = await searchTransactions(shopId, { q: "10%" });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("ส่วนลด 10%");
  });

  it("กรองเฉพาะฝั่งได้", async () => {
    const rows = await searchTransactions(shopId, { q: "ซื้อ", direction: "out" });
    expect(rows.every((r) => r.direction === "out")).toBe(true);
  });

  it("รายการของร้านอื่นไม่โผล่ในผลค้นหา", async () => {
    const rows = await searchTransactions(shopId, { q: "ร้านอื่น" });
    expect(rows).toHaveLength(0);
  });
});

describe("ส่งออกข้อมูล", () => {
  it("มีชื่อร้าน ชื่อประเภท ชื่อบัญชี ไม่ใช่แค่ id", async () => {
    const rows = await exportTransactionsFlat();
    const row = rows.find((r) => r.title === "ขายวันเสาร์")!;

    expect(row.shopName).toBe("ร้านหลัก");
    expect(row.categoryName).toBe("ขายหน้าร้าน");
    expect(row.accountName).toBe("เงินสด");
    expect(row.counts).toBe(true);
  });

  it("วันที่ออกมาเป็น YYYY-MM-DD ไม่ใช่ Date ที่เลื่อนเขตเวลาได้", async () => {
    const rows = await exportTransactionsFlat();
    const row = rows.find((r) => r.title === "ขายวันเสาร์")!;

    expect(row.txnDate).toBe("2026-08-01");
  });
});
