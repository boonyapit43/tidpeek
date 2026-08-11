/**
 * ข้อมูลตั้งต้นสำหรับเริ่มใช้งานครั้งแรก
 *
 *   npm run db:seed
 *
 * รันซ้ำได้ปลอดภัย ถ้ามีร้านอยู่แล้วจะไม่ทำอะไรเลย
 *
 * ไม่ import จาก src/db/index.ts เพราะไฟล์นั้นติด "server-only" ซึ่งตั้งใจ
 * ให้พังเมื่อถูกเรียกนอก React Server Component สคริปต์นี้รันบน Node ตรงๆ
 * จึงเปิด connection ของตัวเอง
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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

/** ประเภทชุดกลาง — shopId ว่างแปลว่าทุกร้านเห็นเหมือนกันหมด */
const DEFAULT_CATEGORIES: {
  direction: "in" | "out";
  name: string;
  counts: boolean;
}[] = [
  /* ---------- ฝั่งรับ: นับเป็นรายได้ ---------- */
  { direction: "in", name: "ขายหน้าร้าน", counts: true },
  { direction: "in", name: "ขายออนไลน์", counts: true },
  { direction: "in", name: "ขายส่ง", counts: true },
  { direction: "in", name: "ค่าส่งที่เก็บจากลูกค้า", counts: true },
  { direction: "in", name: "รับจ้าง/บริการ", counts: true },
  { direction: "in", name: "ขายของเก่า/ทรัพย์สิน", counts: true },
  { direction: "in", name: "ดอกเบี้ยรับ", counts: true },
  { direction: "in", name: "รายได้อื่น", counts: true },

  /* ---------- ฝั่งรับ: เงินเข้าจริงแต่ไม่ใช่กำไรของร้าน ---------- */
  { direction: "in", name: "เติมทุน", counts: false },
  { direction: "in", name: "เงินกู้", counts: false },
  { direction: "in", name: "รับเงินคืนจากผู้ขาย", counts: false },
  { direction: "in", name: "รับคืนเงินยืม", counts: false },
  { direction: "in", name: "โอนย้ายบัญชี (เข้า)", counts: false },

  /* ---------- ฝั่งจ่าย: นับเป็นรายจ่าย ---------- */
  { direction: "out", name: "ซื้อของเข้าร้าน", counts: true },
  { direction: "out", name: "ค่าแรง", counts: true },
  { direction: "out", name: "ค่าเช่าที่", counts: true },
  { direction: "out", name: "ค่าน้ำค่าไฟ", counts: true },
  { direction: "out", name: "ค่าเน็ต/ค่าโทรศัพท์", counts: true },
  { direction: "out", name: "ค่าส่ง", counts: true },
  { direction: "out", name: "ค่าน้ำมัน/ค่าเดินทาง", counts: true },
  { direction: "out", name: "ค่าบรรจุภัณฑ์/ถุง", counts: true },
  { direction: "out", name: "ของใช้ในร้าน", counts: true },
  { direction: "out", name: "ค่าซ่อมบำรุง/อุปกรณ์", counts: true },
  { direction: "out", name: "ค่าโฆษณา/การตลาด", counts: true },
  { direction: "out", name: "ค่าธรรมเนียมธนาคาร", counts: true },
  { direction: "out", name: "ภาษี/ค่าธรรมเนียมราชการ", counts: true },
  { direction: "out", name: "ของเสีย/ของหาย", counts: true },
  { direction: "out", name: "รายจ่ายอื่น", counts: true },

  /* ---------- ฝั่งจ่าย: เงินออกจริงแต่ไม่ใช่ขาดทุนของร้าน ---------- */
  { direction: "out", name: "ถอนใช้ส่วนตัว", counts: false },
  { direction: "out", name: "คืนเงินกู้", counts: false },
  { direction: "out", name: "ให้ยืม", counts: false },
  { direction: "out", name: "ยืมข้ามร้าน", counts: false },
  { direction: "out", name: "โอนย้ายบัญชี (ออก)", counts: false },
];

/** บัญชีตั้งต้น — shopId ว่างแปลว่าเป็นบัญชีกลางที่ทุกร้านใช้ร่วมกัน */
const DEFAULT_ACCOUNTS = [
  { name: "เงินสดหน้าร้าน", kind: "cash" as const, bank: null, openingBalance: "0" },
  { name: "บัญชีธนาคาร", kind: "bank" as const, bank: null, openingBalance: "0" },
];

async function main() {
  const existing = await db.select({ id: shops.id }).from(shops).limit(1);

  if (existing.length > 0) {
    console.log("มีข้อมูลอยู่แล้ว ข้ามการใส่ข้อมูลตั้งต้น");
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(shops).values({ name: "ร้านหลัก", sortOrder: 1 });

    await tx.insert(accounts).values(
      DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, shopId: null, sortOrder: i + 1 })),
    );

    // sortOrder นับแยกฝั่งรับกับฝั่งจ่าย เพื่อให้ลำดับในแต่ละ dropdown เริ่มที่ 1
    let inOrder = 0;
    let outOrder = 0;

    await tx.insert(categories).values(
      DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        shopId: null,
        sortOrder: c.direction === "in" ? ++inOrder : ++outOrder,
      })),
    );
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
