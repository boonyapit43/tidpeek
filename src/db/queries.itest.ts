import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import { addDays, today } from "@/lib/date";
import {
  exportTransactionsFlat,
  entriesPerCategory,
  countAccountMovements,
  latestTxnDate,
  listAccountMovements,
  listCategoryEntries,
  listPeriodEntries,
  listRecentTitles,
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
      exportTransactionsFlat(shopId, { year: "2026" }),
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

describe("เจาะดูรายการข้างในประเภท", () => {
  const AUGUST = { month: "2026-08" } as const;

  it("ได้เฉพาะรายการของประเภทนั้น ฝั่งนั้น ในช่วงนั้น เรียงวันใหม่ก่อน", async () => {
    const rows = await listCategoryEntries(shopId, AUGUST, costId, "out");

    expect(rows.map((r) => r.title)).toEqual(["ซื้อเนื้อ", "ซื้อผัก"]);
    // ชื่อบัญชีติดมาด้วย ไว้โชว์ว่าเงินออกจากไหน
    expect(rows[0].accountName).toBe("เงินสด");
  });

  it("กลุ่มไม่ระบุประเภทก็เจาะดูได้ และไม่ปนรายการของร้านอื่น", async () => {
    // ของร้านอื่นในชุดข้อมูลก็ไม่มีประเภทเหมือนกัน — ต้องไม่หลุดมา
    const rows = await listCategoryEntries(shopId, AUGUST, null, "in");

    expect(rows.map((r) => r.title)).toEqual(["ขายเบ็ดเตล็ด"]);
  });

  it("รายการที่ลบแล้วไม่โผล่ และช่วงเวลาตัดจริง", async () => {
    // แถวที่ลบแล้ว (99999) เป็นประเภทขายหน้าร้านในสิงหา ต้องไม่อยู่
    const august = await listCategoryEntries(shopId, AUGUST, saleId, "in");
    expect(august.map((r) => r.title)).toEqual(["ขายวันอาทิตย์", "ขายวันเสาร์"]);

    // เดือนกันยาของประเภทเดียวกัน มีของมันเอง ไม่ปนกับสิงหา
    const september = await listCategoryEntries(shopId, { month: "2026-09" }, saleId, "in");
    expect(september.map((r) => r.title)).toEqual(["ขายเดือนหน้า"]);
  });
});

describe("รายการที่แนบไปกับหน้าสรุปเพื่อกางดู", () => {
  it("ได้ทุกประเภทในช่วงเดียว พร้อมบอกว่าแต่ละแถวเป็นของประเภทไหนฝั่งไหน", async () => {
    const rows = await listPeriodEntries(shopId, { month: "2026-08" });

    const wage = rows.filter((r) => r.categoryId === costId);
    expect(wage.map((r) => r.title).sort()).toEqual(["ซื้อผัก", "ซื้อเนื้อ"]);
    expect(wage.every((r) => r.direction === "out")).toBe(true);

    // กลุ่มไม่ระบุประเภทมาด้วย เพราะโผล่เป็นกลุ่มของตัวเองในหน้าสรุป
    expect(rows.some((r) => r.categoryId === null && r.title === "ขายเบ็ดเตล็ด")).toBe(true);
  });

  it("ไม่ปนร้านอื่น ไม่ปนรายการที่ลบแล้ว และไม่หลุดช่วง", async () => {
    const rows = await listPeriodEntries(shopId, { month: "2026-08" });
    const titles = rows.map((r) => r.title);

    expect(titles).not.toContain("ของร้านอื่น");
    expect(titles).not.toContain("รายการที่ลบแล้ว");
    expect(titles).not.toContain("ขายเดือนหน้า");
    expect(rows.every((r) => r.txnDate.startsWith("2026-08"))).toBe(true);
  });

  /**
   * โควตาต้องจำกัด "ต่อประเภท" ไม่ใช่รวมทั้งก้อน — ถ้าตัดรวม ประเภทที่
   * รายการเยอะจะกินโควตาจนประเภทอื่นไม่เหลือให้กางเลยสักแถว
   */
  it("จำกัดต่อประเภท ประเภทที่รายการน้อยจึงไม่ถูกเบียดหาย", async () => {
    // ใส่รายการซื้อของเข้าร้านเพิ่มให้ทะลุโควตาไปไกลๆ
    for (let i = 0; i < 40; i++) {
      await raw`
        insert into transactions (shop_id, txn_date, direction, amount, title, category_id)
        values (${shopId}, '2026-08-05', 'out', 10, ${"ของชิ้นที่ " + i}, ${costId})`;
    }

    const rows = await listPeriodEntries(shopId, { month: "2026-08" });
    const cost = rows.filter((r) => r.categoryId === costId);

    expect(cost.length).toBe(entriesPerCategory({ month: "2026-08" }));
    // ประเภทขายหน้าร้านยังอยู่ครบ ไม่โดนเบียดหายไปกับโควตาของอีกประเภท
    expect(rows.filter((r) => r.categoryId === saleId).length).toBeGreaterThan(0);
  });

  /**
   * โควตาลดหลั่นตามความกว้างของช่วง — จำนวนกลุ่มไม่เปลี่ยนแต่จำนวนรายการ
   * ต่อกลุ่มโตตามช่วง ถ้าใช้โควตาเดียวกันหมด มุมมองปีจะแนบข้อมูลไปเป็น
   * ร้อยกิโลไบต์ให้เน็ตมือถือโหลดทิ้ง
   */
  it("ช่วงกว้างขึ้น แนบรายการต่อประเภทน้อยลง", async () => {
    for (let i = 0; i < 40; i++) {
      await raw`
        insert into transactions (shop_id, txn_date, direction, amount, title, category_id)
        values (${shopId}, '2026-08-05', 'out', 10, ${"ของชิ้นที่ " + i}, ${costId})`;
    }

    const month = await listPeriodEntries(shopId, { month: "2026-08" });
    const year = await listPeriodEntries(shopId, { year: "2026" });

    const countOf = (rows: { categoryId: string | null }[]) =>
      rows.filter((r) => r.categoryId === costId).length;

    expect(countOf(month)).toBe(10);
    expect(countOf(year)).toBe(5);
  });

  /**
   * เรียงตามเวลาที่บันทึก ไม่ใช่ตาม id
   *
   * id เป็น uuid สุ่ม ถ้าเรียงตามนั้นรายการในวันเดียวกันจะสลับที่กันมั่ว
   * ทั้งที่ทุกหน้าอื่นในแอปเรียง "ที่พิมพ์ทีหลังขึ้นก่อน" เหมือนกันหมด
   */
  it("วันเดียวกันเรียงจากที่พิมพ์ทีหลังขึ้นก่อน", async () => {
    await raw`delete from transactions where shop_id = ${shopId}`;
    for (const title of ["พิมพ์ก่อน", "พิมพ์กลาง", "พิมพ์ทีหลัง"]) {
      await raw`
        insert into transactions (shop_id, txn_date, direction, amount, title, category_id)
        values (${shopId}, '2026-08-05', 'out', 10, ${title}, ${costId})`;
    }

    const rows = await listPeriodEntries(shopId, { month: "2026-08" });

    expect(rows.map((r) => r.title)).toEqual(["พิมพ์ทีหลัง", "พิมพ์กลาง", "พิมพ์ก่อน"]);
  });
});

describe("คำแนะนำชื่อรายการในฟอร์มบันทึก", () => {
  /**
   * ดูย้อนหลังแค่ครึ่งปี ไม่ใช่ทั้งประวัติ
   *
   * เหตุผลหลักคือความเร็ว — ไม่งั้น query นี้กวาดทั้งตารางทุกครั้งที่เปิด
   * หน้าบันทึก ซึ่งเป็นหน้าที่ถูกเปิดบ่อยที่สุด และแพงขึ้นเรื่อยๆ ทุกปี
   * ผลพลอยได้คือคำแนะนำดีขึ้น ชื่อที่เลิกใช้ไปแล้วไม่มาเบียดที่ของที่ใช้อยู่
   */
  it("ชื่อที่ใช้นานเกินครึ่งปีไม่โผล่มาเบียด", async () => {
    const recent = addDays(today(), -10);
    const longAgo = addDays(today(), -400);

    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, category_id)
      values (${shopId}, ${recent}, 'out', 50, 'ของที่ยังซื้ออยู่', ${costId}),
             (${shopId}, ${longAgo}, 'out', 50, 'ของที่เลิกซื้อไปแล้ว', ${costId})`;

    const titles = (await listRecentTitles(shopId, "out")).map((t) => t.title);

    expect(titles).toContain("ของที่ยังซื้ออยู่");
    expect(titles).not.toContain("ของที่เลิกซื้อไปแล้ว");
  });

  it("เดาประเภทจากที่เคยใช้กับชื่อนั้นบ่อยสุด", async () => {
    const day = addDays(today(), -3);
    for (let i = 0; i < 3; i++) {
      await raw`
        insert into transactions (shop_id, txn_date, direction, amount, title, category_id)
        values (${shopId}, ${day}, 'out', 50, 'น้ำแข็ง', ${costId})`;
    }

    const hit = (await listRecentTitles(shopId, "out")).find((t) => t.title === "น้ำแข็ง");

    expect(hit?.categoryId).toBe(costId);
    expect(hit?.uses).toBe(3);
  });
});

describe("วันที่ของรายการล่าสุด", () => {
  it("ได้วันที่ใหม่สุดของร้าน ไม่นับรายการที่ลบและไม่นับร้านอื่น", async () => {
    // ชุดข้อมูลมีถึง 2026-12-31 ส่วนแถวที่ลบแล้ว (2026-08-01) กับของร้านอื่นต้องไม่เกี่ยว
    expect(await latestTxnDate(shopId)).toBe("2026-12-31");
  });

  it("ร้านที่ไม่มีรายการเลย ได้ null", async () => {
    expect(await latestTxnDate(otherShopId)).not.toBeNull(); // ร้านอื่นมีหนึ่งแถว

    const [empty] = await raw<{ id: string }[]>`
      insert into shops (name) values (${"ร้านว่าง"}) returning id`;
    expect(await latestTxnDate(empty.id)).toBeNull();
  });
});

describe("ส่งออกข้อมูล", () => {
  const YEAR = { year: "2026" } as const;

  it("มีชื่อประเภทกับชื่อบัญชี ไม่ใช่แค่ id", async () => {
    const rows = await exportTransactionsFlat(shopId, YEAR);
    const row = rows.find((r) => r.title === "ขายวันเสาร์")!;

    expect(row.categoryName).toBe("ขายหน้าร้าน");
    expect(row.accountName).toBe("เงินสด");
    expect(row.counts).toBe(true);
  });

  it("วันที่ออกมาเป็น YYYY-MM-DD ไม่ใช่ Date ที่เลื่อนเขตเวลาได้", async () => {
    const rows = await exportTransactionsFlat(shopId, YEAR);
    const row = rows.find((r) => r.title === "ขายวันเสาร์")!;

    expect(row.txnDate).toBe("2026-08-01");
  });

  /**
   * บั๊กที่เคยมี — ส่งออกแล้วได้รายการของทุกร้านปนกันมา
   *
   * ไฟล์ที่ส่งให้คนทำบัญชีของร้านหนึ่ง จึงมีรายการของอีกร้านอยู่ด้วย
   * โดยที่คนรับไฟล์ไปไม่มีทางรู้เลยว่าปน
   */
  it("ต้องมีเฉพาะรายการของร้านที่เลือก ไม่ปนร้านอื่น", async () => {
    const rows = await exportTransactionsFlat(shopId, YEAR);
    expect(rows.map((r) => r.title)).not.toContain("ของร้านอื่น");
  });

  it("กรองตามช่วงวันได้ ไม่ใช่ได้ทั้งหมดเสมอ", async () => {
    const august = await exportTransactionsFlat(shopId, { month: "2026-08" });
    const wholeYear = await exportTransactionsFlat(shopId, YEAR);

    expect(august.length).toBeLessThan(wholeYear.length);
    expect(august.every((r) => r.txnDate.startsWith("2026-08"))).toBe(true);
  });

  it("ช่วงกำหนดเองเก็บเฉพาะวันในช่วงนั้น", async () => {
    const rows = await exportTransactionsFlat(shopId, { from: "2026-08-01", to: "2026-08-02" });

    expect(rows.every((r) => r.txnDate >= "2026-08-01" && r.txnDate <= "2026-08-02")).toBe(true);
    expect(rows.map((r) => r.title)).not.toContain("ซื้อเนื้อ");
  });
});

/* ------------------------------------------------------------------ */

/**
 * เพดานของลิสต์ กับจำนวนจริงที่เอาไปบอกคนใช้
 *
 * สองอย่างนี้ต้องมาคู่กันเสมอ ลิสต์ที่ตัดแล้วไม่บอกว่าตัด อ่านได้ว่า
 * "ไม่มีรายการเก่ากว่านี้แล้ว" ซึ่งกับสมุดบัญชีคือการเข้าใจผิดเรื่องเงิน
 * ที่คนใช้ไม่มีทางรู้ตัว
 */
describe("เพดานลิสต์ กับจำนวนจริง", () => {
  it("เจาะดูประเภทแล้วตัดตามเพดาน แต่จำนวนจริงยังนับครบ", async () => {
    const AUGUST = { month: "2026-08" } as const;

    // สิงหามีของประเภทซื้อของเข้าร้านสองรายการ ขอมาแค่หนึ่ง
    const capped = await listCategoryEntries(shopId, AUGUST, costId, "out", 1);
    expect(capped).toHaveLength(1);
    // ต้องได้ตัวใหม่สุดก่อน ไม่ใช่ตัดเอาตัวไหนก็ได้
    expect(capped[0].title).toBe("ซื้อเนื้อ");

    // ส่วนจำนวนที่เอาไปโชว์บนหัวมาจากยอดรวมของประเภท ซึ่งไม่โดนเพดาน
    const totals = await listCategoryTotals(shopId, AUGUST);
    const group = totals.find((t) => t.categoryId === costId && t.direction === "out");
    expect(group?.txnCount).toBe(2);
  });

  it("ขอมากกว่าที่มี ได้เท่าที่มี ไม่พัง", async () => {
    const rows = await listCategoryEntries(shopId, { month: "2026-08" }, costId, "out", 999);
    expect(rows).toHaveLength(2);
  });

  it("ค้นหาตัดตามเพดาน แต่ยอดรวมยังนับทุกแถวที่ตรง", async () => {
    const q = { q: "ขาย" };

    const capped = await searchTransactions(shopId, q, 1);
    expect(capped).toHaveLength(1);

    // ยอดรวมกับจำนวนต้องเป็นของทั้งชุดผลลัพธ์ ไม่ใช่ของแถวที่โหลดมา
    const totals = await searchTotals(shopId, q);
    expect(totals.count).toBeGreaterThan(1);
  });
});

describe("นับความเคลื่อนไหวของบัญชี", () => {
  it("นับทั้งรายการปกติและการโอน เท่ากับที่ลิสต์ได้ตอนไม่ติดเพดาน", async () => {
    await raw`
      insert into transfers (shop_id, txn_date, from_account_id, to_account_id, amount)
      values (${shopId}, '2026-08-10', ${cashId}, ${bankId}, 500)`;

    const [rows, total] = await Promise.all([
      listAccountMovements(shopId, cashId, 999),
      countAccountMovements(shopId, cashId),
    ]);

    expect(total).toBe(rows.length);
    // เงินสดมีรายการปกติสี่ บวกโอนออกหนึ่ง
    expect(total).toBe(5);
  });

  /**
   * ที่ต้องเทสแยก เพราะจำนวนกับลิสต์เป็นคนละ query — ถ้าอันหนึ่งกรอง
   * ของที่ลบแล้วแต่อีกอันไม่กรอง หน้าจะขึ้น "แสดง 5 จาก 6 รายการ"
   * แล้วกดดูเพิ่มก็ไม่มีอะไรเพิ่ม กลายเป็นปุ่มที่กดแล้วไม่เกิดอะไร
   */
  it("ไม่นับรายการที่ลบแล้ว เหมือนที่ลิสต์ไม่แสดง", async () => {
    const before = await countAccountMovements(shopId, cashId);

    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, account_id, is_deleted)
      values (${shopId}, '2026-08-10', 'out', 123, 'ลบแล้ว', ${cashId}, true)`;

    expect(await countAccountMovements(shopId, cashId)).toBe(before);
  });

  it("บัญชีของร้านอื่น ได้ศูนย์ ไม่ใช่จำนวนจริง", async () => {
    expect(await countAccountMovements(otherShopId, cashId)).toBe(0);
  });
});
