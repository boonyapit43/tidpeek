import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import { listShopsWithToday } from "./queries";

/**
 * หน้าเลือกร้าน
 *
 * ตัวเลขสองตัวในนี้ไม่ได้มีไว้ดูเล่น
 *   todayProfit  กำไรวันนี้ที่โชว์บนการ์ด
 *   totalCount   จำนวนรายการทั้งหมด ใช้เตือนก่อนลบร้าน
 *                ("ลบร้านนี้ พร้อมรายการทั้งหมด 248 รายการ")
 *                ถ้าตัวเลขนี้ผิดเป็น 0 คำเตือนจะหายไปเงียบๆ
 *                แล้วคนจะกดลบร้านที่มีข้อมูลอยู่โดยไม่รู้ว่ากำลังลบอะไร
 */

const TODAY = "2026-08-13";

beforeAll(async () => {
  await createSchema();
});

beforeEach(async () => {
  await resetData();
});

afterAll(async () => {
  await closeTestDb();
});

async function seedShop(name: string) {
  const [shop] = await raw`insert into shops (name) values (${name}) returning id`;
  return shop.id as string;
}

async function addTxn(
  shopId: string,
  date: string,
  direction: string,
  amount: string,
  categoryId: string | null = null,
) {
  await raw`
    insert into transactions (shop_id, txn_date, direction, amount, title, category_id)
    values (${shopId}, ${date}, ${direction}, ${amount}, 'รายการ', ${categoryId})`;
}

describe("การ์ดร้าน", () => {
  it("totalCount นับรายการทั้งหมดของร้าน ไม่ใช่แค่ของวันนี้", async () => {
    const shopId = await seedShop("ร้านหลัก");

    await addTxn(shopId, TODAY, "in", "100");
    await addTxn(shopId, "2026-01-05", "in", "200");
    await addTxn(shopId, "2025-12-31", "out", "50");

    const [card] = await listShopsWithToday(TODAY);

    expect(card.totalCount).toBe(3);
    expect(card.todayCount).toBe(1);
  });

  it("totalCount ไม่นับรายการของร้านอื่น", async () => {
    const a = await seedShop("ร้านหนึ่ง");
    const b = await seedShop("ร้านสอง");

    await addTxn(a, TODAY, "in", "100");
    await addTxn(b, TODAY, "in", "100");
    await addTxn(b, TODAY, "in", "100");

    const cards = await listShopsWithToday(TODAY);
    const cardA = cards.find((c) => c.name === "ร้านหนึ่ง")!;
    const cardB = cards.find((c) => c.name === "ร้านสอง")!;

    expect(cardA.totalCount).toBe(1);
    expect(cardB.totalCount).toBe(2);
  });

  it("totalCount ไม่นับรายการที่ลบไปแล้ว", async () => {
    const shopId = await seedShop("ร้านหลัก");

    await addTxn(shopId, TODAY, "in", "100");
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, is_deleted)
      values (${shopId}, ${TODAY}, 'in', 999, 'ลบแล้ว', true)`;

    const [card] = await listShopsWithToday(TODAY);
    expect(card.totalCount).toBe(1);
  });

  it("กำไรวันนี้นับเฉพาะของวันนี้ และเคารพธง counts", async () => {
    const shopId = await seedShop("ร้านหลัก");

    const [topUp] = await raw`
      insert into categories (shop_id, direction, name, counts)
      values (${shopId}, 'in', 'เติมทุน', false) returning id`;

    await addTxn(shopId, TODAY, "in", "500");
    await addTxn(shopId, TODAY, "in", "9000", topUp.id); // ไม่นับเป็นกำไร
    await addTxn(shopId, TODAY, "out", "200");
    await addTxn(shopId, "2026-08-12", "in", "1000"); // เมื่อวาน ไม่นับ

    const [card] = await listShopsWithToday(TODAY);

    expect(Number(card.todayProfit)).toBe(300);
    expect(card.todayCount).toBe(3);
  });

  it("ร้านที่วันนี้ยังไม่มีรายการ ยังต้องโผล่ในรายการ", async () => {
    const shopId = await seedShop("ร้านเงียบ");
    await addTxn(shopId, "2026-01-01", "in", "100");

    const [card] = await listShopsWithToday(TODAY);

    expect(card.name).toBe("ร้านเงียบ");
    expect(card.todayCount).toBe(0);
    expect(Number(card.todayProfit)).toBe(0);
    expect(card.totalCount).toBe(1);
  });
});
