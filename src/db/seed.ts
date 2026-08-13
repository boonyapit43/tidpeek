/**
 * ข้อมูลตั้งต้นสำหรับเริ่มใช้งานครั้งแรก
 *
 *   npm run db:seed
 *
 * รันซ้ำได้ปลอดภัย ถ้ามีร้านอยู่แล้วจะไม่ทำอะไรเลย
 *
 * สคริปต์นี้ไม่ใช่ทางเดียวที่ได้ของตั้งต้นแล้ว การเพิ่มร้านจากหน้าเลือกร้าน
 * ก็ใส่ชุดเดียวกันนี้ให้เอง (ดู createShop) สคริปต์เหลือไว้สำหรับตอนตั้ง
 * ฐานข้อมูลใหม่จากบรรทัดคำสั่งโดยยังไม่เปิดเว็บ
 *
 * ไม่ import จาก src/db/index.ts เพราะไฟล์นั้นติด "server-only" ซึ่งตั้งใจ
 * ให้พังเมื่อถูกเรียกนอก React Server Component สคริปต์นี้รันบน Node ตรงๆ
 * จึงเปิด connection ของตัวเอง
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  defaultAccountRows,
  defaultCategoryRows,
} from "./defaults";
import { accounts, categories, shops } from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ไม่พบ DATABASE_URL — ตรวจว่ามีไฟล์ .env.local แล้วหรือยัง");
  process.exit(1);
}

const client = postgres(url, {
  ssl: process.env.DATABASE_SSL === "0" ? false : "require",
  max: 1,
});

const db = drizzle(client, { schema: { shops, accounts, categories } });

async function main() {
  const existing = await db.select({ id: shops.id }).from(shops).limit(1);

  if (existing.length > 0) {
    console.log("มีข้อมูลอยู่แล้ว ข้ามการใส่ข้อมูลตั้งต้น");
    return;
  }

  await db.transaction(async (tx) => {
    const [shop] = await tx
      .insert(shops)
      .values({ name: "ร้านหลัก", sortOrder: 1 })
      .returning({ id: shops.id });

    // บัญชีผูกกับร้าน ส่วนประเภทเป็นของกลาง — เหตุผลอยู่ใน createShop
    await tx.insert(accounts).values(defaultAccountRows(shop.id));
    await tx.insert(categories).values(defaultCategoryRows(null));
  });

  console.log(
    `ใส่ข้อมูลตั้งต้นแล้ว: 1 ร้าน, ${DEFAULT_ACCOUNTS.length} บัญชี, ${DEFAULT_CATEGORIES.length} ประเภท`,
  );
  console.log("ยอดตั้งต้นของบัญชีตั้งเป็น 0 ไว้ — ไปแก้ให้ตรงกับยอดจริงที่หน้าตั้งค่า");
}

main()
  .catch((error) => {
    console.error("ใส่ข้อมูลตั้งต้นไม่สำเร็จ:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
