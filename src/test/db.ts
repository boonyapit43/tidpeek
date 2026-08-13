import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * ฐานข้อมูลจริงสำหรับเทส — Postgres ใน Docker ไม่ใช่ของปลอมในหน่วยความจำ
 *
 *   docker run -d --name tidpeek-test -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=tidpeek_test -p 55432:5432 postgres:16-alpine
 *
 * ที่ต้องเป็นของจริงเพราะสิ่งที่อยากพิสูจน์คือ SQL ที่เขียนไว้ทำงานถูกจริง
 * ทั้งการรวมยอด numeric การ cascade ของ foreign key และ check constraint
 * ของปลอมจะผ่านหมดโดยไม่ได้บอกอะไรเลย
 *
 * ใช้ supabase/schema.sql ไฟล์เดียวกับที่เอาไปรันบน Supabase จริง
 * ทุกครั้งที่รันเทสจึงเท่ากับพิสูจน์ว่าไฟล์นั้นยังสร้างฐานที่ใช้งานได้อยู่
 */

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:test@127.0.0.1:55432/tidpeek_test";

const admin = postgres(TEST_DATABASE_URL, { ssl: false, max: 1 });

/** สร้างตารางใหม่ทั้งหมดจากศูนย์ เรียกครั้งเดียวก่อนเริ่มเทส */
export async function createSchema(): Promise<void> {
  await admin.unsafe("drop schema public cascade; create schema public;");
  await admin.unsafe(readFileSync("supabase/schema.sql", "utf8"));
}

/**
 * ล้างข้อมูลทุกตารางแต่เก็บโครงไว้ เรียกก่อนเทสแต่ละข้อ
 *
 * truncate cascade ทีเดียวเร็วกว่าไล่ delete และไม่ต้องสนใจลำดับ foreign key
 * แต่ละเทสจึงเริ่มจากฐานว่างเสมอ ไม่มีทางที่เทสข้อหนึ่งจะไปทำให้อีกข้อผ่าน
 * หรือตกเพราะข้อมูลตกค้าง
 */
export async function resetData(): Promise<void> {
  await admin.unsafe(
    "truncate table transactions, categories, accounts, shops restart identity cascade",
  );
}

export async function closeTestDb(): Promise<void> {
  await admin.end();
}

/** ไว้ถามฐานตรงๆ ตอนอยากยืนยันว่าข้อมูลลงจริงตามที่คาด */
export const raw = admin;
