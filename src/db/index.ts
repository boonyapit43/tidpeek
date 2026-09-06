import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";
import { poolOptions, portOf } from "./pool";

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
 *   5432  session                          — ใช้กับเซิร์ฟเวอร์ที่รันค้างไว้ เช่น VPS
 *
 * ตรวจจากพอร์ตแล้วตั้งค่าให้เองที่ src/db/pool.ts ซึ่งแยกออกไปเพื่อให้เทสได้
 * และมีคำอธิบายว่าทำไม max ห้ามเป็น 1
 */
function createClient() {
  return postgres(env.DATABASE_URL, {
    ssl: env.DATABASE_SSL ? "require" : false,
    ...poolOptions(portOf(env.DATABASE_URL)),
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
