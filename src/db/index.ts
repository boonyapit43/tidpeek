import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * จุดเดียวในแอปที่ต่อฐานข้อมูล
 *
 * ต่อผ่าน DATABASE_URL ด้วยไดรเวอร์ Postgres มาตรฐาน ไม่ใช้ SDK ของผู้ให้บริการ
 * เจ้าไหนเลย ย้ายจาก Supabase ไป Postgres บน VPS จึงเท่ากับเปลี่ยน env ตัวเดียว
 * ไม่ต้องแตะโค้ด
 */

/**
 * Supabase มี connection string สองแบบ พอร์ตต่างกันและใช้คนละสถานการณ์
 *
 *   6543  transaction pooler (pgBouncer)  — ใช้กับ serverless เช่น Vercel
 *   5432  ต่อตรง                          — ใช้กับเซิร์ฟเวอร์ที่รันค้างไว้ เช่น VPS
 *
 * pgBouncer โหมด transaction ไม่รองรับ prepared statement จึงต้องปิดทิ้ง
 * ถ้าลืมปิดจะเจอ error "prepared statement already exists" แบบสุ่มๆ
 * ซึ่งตามยากมาก เลยตรวจจากพอร์ตให้อัตโนมัติตรงนี้
 */
const port = (() => {
  try {
    return new URL(env.DATABASE_URL).port;
  } catch {
    return "";
  }
})();

const isTransactionPooler = port === "6543";

function createClient() {
  return postgres(env.DATABASE_URL, {
    ssl: env.DATABASE_SSL ? "require" : false,
    prepare: !isTransactionPooler,
    // pooler จัดคิว connection ให้อยู่แล้ว ฝั่งแอปเปิดค้างไว้เยอะไม่มีประโยชน์
    max: isTransactionPooler ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

/**
 * ตอน dev ตัว hot reload ของ Next.js โหลดโมดูลใหม่ทุกครั้งที่แก้ไฟล์
 * ถ้าไม่เก็บ client ไว้บน globalThis จะเปิด connection ใหม่ทิ้งไว้เรื่อยๆ
 * จนฐานข้อมูลปฏิเสธการเชื่อมต่อภายในไม่กี่นาที
 */
const globalForDb = globalThis as unknown as {
  __ledgerClient?: ReturnType<typeof createClient>;
};

const client = globalForDb.__ledgerClient ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForDb.__ledgerClient = client;
}

export const db = drizzle(client, {
  schema,
  logger: env.NODE_ENV === "development",
});

export { schema };
