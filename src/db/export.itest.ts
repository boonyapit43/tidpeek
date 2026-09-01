import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import { accountTotalsForPeriod, exportTransfersFlat } from "./queries";

/**
 * ชีต "ยอดบัญชี" กับ "โอนระหว่างบัญชี" ของไฟล์ที่ส่งออก
 *
 * แยกไฟล์ออกมาเพราะต้องมีข้อมูลการโอน ซึ่งชุดข้อมูลของ queries.itest.ts
 * ไม่มี และสองชีตนี้เป็นที่ที่คนเอาไปกระทบยอดกับสมุดธนาคารจริง
 *
 * ⚠️ เทสชุดนี้มีไว้ดักกับดักเฉพาะของ drizzle ด้วย — เวลา select ที่ไม่มี join
 *    คอลัมน์ที่เขียนใน sql`` ดิบจะถูก render เป็น "id" เฉยๆ ไม่มีชื่อตารางนำหน้า
 *    ถ้าข้างในเป็น subquery ที่มีตารางอื่นอยู่ "id" จะไปผูกกับตารางในนั้นแทน
 *    แล้วได้ผลลัพธ์เป็นศูนย์เงียบๆ โดยที่ SQL ไม่ error เลย
 *    เจอมาแล้วสองครั้ง — shopDelta ที่คืน 0 มาตลอดโดยไม่มีใครรู้
 *    และ transferNet กับ closing ของชีตนี้เอง ซึ่งเทสข้างล่างจับได้ก่อนขึ้นจริง
 */

let shopId: string;
let cashId: string;
let bankId: string;

async function seed() {
  const [shop] = await raw`insert into shops (name) values ('ร้านหลัก') returning id`;
  shopId = shop.id;

  const [cash] = await raw`
    insert into accounts (shop_id, name, kind, opening_balance, sort_order)
    values (${shopId}, 'เงินสด', 'cash', 1000, 1) returning id`;
  const [bank] = await raw`
    insert into accounts (shop_id, name, kind, opening_balance, sort_order)
    values (${shopId}, 'ไทยพลัส', 'bank', 10000, 2) returning id`;
  cashId = cash.id;
  bankId = bank.id;

  const [sale] = await raw`
    insert into categories (shop_id, direction, name, counts)
    values (${shopId}, 'in', 'ขายหน้าร้าน', true) returning id`;
  const [cost] = await raw`
    insert into categories (shop_id, direction, name, counts)
    values (${shopId}, 'out', 'ซื้อของเข้าร้าน', true) returning id`;

  const rows: [string, string, string, string, string, string][] = [
    // ก่อนช่วงที่จะส่งออก — ต้องไม่โผล่ในคอลัมน์ "ในช่วง" แต่ต้องอยู่ใน closing
    ["2026-07-20", "in", "500", "ขายเดือนก่อน", sale.id, cashId],
    // ในช่วง
    ["2026-08-01", "in", "1500", "ขายวันเสาร์", sale.id, cashId],
    ["2026-08-01", "out", "104", "ซื้อของ", cost.id, cashId],
    ["2026-08-02", "out", "165", "ค่าแก๊ส", cost.id, cashId],
    ["2026-08-02", "in", "900", "ขายผ่านแอป", sale.id, bankId],
    // หลังช่วง — ต้องไม่โผล่เลย แม้แต่ใน closing
    ["2026-09-05", "in", "7777", "ขายเดือนหน้า", sale.id, cashId],
  ];

  for (const [date, direction, amount, title, categoryId, accountId] of rows) {
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, category_id, account_id)
      values (${shopId}, ${date}, ${direction}, ${amount}, ${title}, ${categoryId}, ${accountId})`;
  }

  await raw`
    insert into transfers (shop_id, txn_date, from_account_id, to_account_id, amount, note)
    values (${shopId}, '2026-08-03', ${cashId}, ${bankId}, 500, 'ฝากเข้าธนาคาร')`;

  // การโอนที่ลบแล้ว — ต้องไม่ถูกนับที่ไหนเลย
  await raw`
    insert into transfers (shop_id, txn_date, from_account_id, to_account_id, amount, note, is_deleted)
    values (${shopId}, '2026-08-04', ${bankId}, ${cashId}, 9999, 'โอนผิดแล้วลบ', true)`;

  // การโอนนอกช่วง
  await raw`
    insert into transfers (shop_id, txn_date, from_account_id, to_account_id, amount)
    values (${shopId}, '2026-09-10', ${cashId}, ${bankId}, 300)`;
}

const AUGUST = { month: "2026-08" } as const;

const byName = <T extends { name: string }>(rows: T[], name: string) =>
  rows.find((r) => r.name === name)!;
const n = (v: string) => Number(v);

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

describe("ชีตยอดบัญชี", () => {
  it("มีทุกบัญชีของร้าน เรียงตามลำดับที่ตั้งไว้", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);
    expect(rows.map((r) => r.name)).toEqual(["เงินสด", "ไทยพลัส"]);
  });

  /**
   * ข้อนี้คือข้อที่สำคัญที่สุดของไฟล์นี้
   *
   * ถ้า subquery ผูกคอลัมน์ผิดตาราง ตัวเลขจะออกมาเป็นศูนย์ทั้งแถบ
   * โดยที่ไม่มี error ให้เห็น และไฟล์ที่ส่งออกไปจะบอกว่าเดือนนี้ไม่มีเงินเข้าออกเลย
   */
  it("รับเข้าและจ่ายออกในช่วง เป็นยอดจริงของบัญชีนั้น ไม่ใช่ศูนย์", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);
    const cash = byName(rows, "เงินสด");

    expect(n(cash.income)).toBe(1500);
    expect(n(cash.expense)).toBe(269); // 104 + 165
  });

  it("แต่ละบัญชีนับเฉพาะรายการของตัวเอง ไม่ปนกัน", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);

    expect(n(byName(rows, "ไทยพลัส").income)).toBe(900);
    expect(n(byName(rows, "ไทยพลัส").expense)).toBe(0);
  });

  it("ยอดตั้งต้นเป็นของบัญชีนั้นจริง", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);

    expect(n(byName(rows, "เงินสด").opening)).toBe(1000);
    expect(n(byName(rows, "ไทยพลัส").opening)).toBe(10000);
  });

  it("โอนสุทธิ ออกเป็นลบ เข้าเป็นบวก", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);

    expect(n(byName(rows, "เงินสด").transferNet)).toBe(-500);
    expect(n(byName(rows, "ไทยพลัส").transferNet)).toBe(500);
  });

  it("การโอนที่ลบแล้วไม่ถูกนับ", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);

    // ถ้านับ 9999 ที่ลบไปด้วย ตัวเลขจะไม่ใช่ -500 กับ 500
    expect(n(byName(rows, "เงินสด").transferNet)).toBe(-500);
    expect(n(byName(rows, "ไทยพลัส").transferNet)).toBe(500);
  });

  /**
   * closing คือยอด ณ วันสุดท้ายของช่วง ไม่ใช่ยอดวันนี้
   *
   * ถ้าใช้ยอดวันนี้ ตัวเลขของเดือนที่ปิดไปแล้วจะเปลี่ยนทุกครั้งที่ส่งออกใหม่
   * ซึ่งทำให้กระทบยอดกับสมุดธนาคารไม่ได้เลย
   */
  it("คงเหลือสิ้นช่วง นับของก่อนหน้าช่วงด้วย แต่ไม่นับของหลังช่วง", async () => {
    const rows = await accountTotalsForPeriod(shopId, AUGUST);

    // เงินสด: 1000 ตั้งต้น + 500 เดือนก่อน + 1500 - 104 - 165 - 500 โอนออก
    expect(n(byName(rows, "เงินสด").closing)).toBe(2231);
    // ไทยพลัส: 10000 ตั้งต้น + 900 + 500 โอนเข้า
    expect(n(byName(rows, "ไทยพลัส").closing)).toBe(11400);
  });

  it("ช่วงที่ไม่มีอะไรเกิดขึ้นเลย ได้ศูนย์ทุกคอลัมน์ แต่คงเหลือยังเท่ายอดตั้งต้น", async () => {
    const rows = await accountTotalsForPeriod(shopId, { month: "2026-01" });
    const cash = byName(rows, "เงินสด");

    expect(n(cash.income)).toBe(0);
    expect(n(cash.expense)).toBe(0);
    expect(n(cash.transferNet)).toBe(0);
    expect(n(cash.closing)).toBe(1000);
  });
});

/* ------------------------------------------------------------------ */

describe("ชีตโอนระหว่างบัญชี", () => {
  it("บอกชื่อบัญชีทั้งสองฝั่ง ไม่ใช่ id", async () => {
    const rows = await exportTransfersFlat(shopId, AUGUST);

    expect(rows).toHaveLength(1);
    expect(rows[0].fromName).toBe("เงินสด");
    expect(rows[0].toName).toBe("ไทยพลัส");
    expect(n(rows[0].amount)).toBe(500);
    expect(rows[0].note).toBe("ฝากเข้าธนาคาร");
  });

  it("วันที่เป็น YYYY-MM-DD ไม่ใช่ Date ที่เลื่อนเขตเวลาได้", async () => {
    const rows = await exportTransfersFlat(shopId, AUGUST);
    expect(rows[0].txnDate).toBe("2026-08-03");
  });

  it("การโอนที่ลบแล้วไม่หลุดออกไปในไฟล์", async () => {
    const rows = await exportTransfersFlat(shopId, AUGUST);
    expect(rows.map((r) => r.note)).not.toContain("โอนผิดแล้วลบ");
  });

  it("กรองตามช่วงจริง ไม่ได้ส่งทุกอันออกมาเสมอ", async () => {
    const august = await exportTransfersFlat(shopId, AUGUST);
    const september = await exportTransfersFlat(shopId, { month: "2026-09" });

    expect(august).toHaveLength(1);
    expect(september).toHaveLength(1);
    expect(september[0].txnDate).toBe("2026-09-10");
  });
});
