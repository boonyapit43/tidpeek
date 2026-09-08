import { defineConfig } from "drizzle-kit";

// drizzle-kit เป็นเครื่องมือ CLI จึงไม่ผ่าน src/lib/env.ts ที่ import "server-only"
// อ่าน .env.local เองตรงนี้แทน
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

// `drizzle-kit generate` สร้างไฟล์ migration จาก schema อย่างเดียว ไม่ต้องต่อฐานข้อมูล
// จึงใส่ค่าหลอกไว้ให้รันได้แม้ยังไม่ได้ตั้ง .env.local
// ส่วน migrate/push/studio ที่ต้องต่อจริงจะล้มเองพร้อมข้อความที่อ่านรู้เรื่อง
const url = process.env.DATABASE_URL ?? "postgresql://localhost:5432/__not_configured__";

/**
 * กัน `drizzle-kit push` ไม่ให้ยิงใส่ฐานข้อมูลจริงโดยไม่ตั้งใจ
 *
 * ⚠️ ที่ต้องมีเพราะเคยเกิดขึ้นมาแล้ว
 *
 * ไฟล์นี้อ่าน .env.local ซึ่งชี้ไป production เสมอ ส่วน `next dev` อ่าน
 * .env.development.local ก่อน คนที่เพิ่งเขียน .env.development.local ให้ชี้ไป
 * ฐานข้อมูลในเครื่อง แล้วรัน `npx drizzle-kit push` ต่อ จะเชื่อว่ากำลังยิงใส่
 * ฐานข้อมูลในเครื่อง ทั้งที่มันวิ่งเข้า production — ไม่มีอะไรบอกเลย
 * ขึ้นแค่ "[✓] Changes applied" เหมือนกันทุกประการ
 *
 * push เทียบ schema แล้วแก้ฐานข้อมูลให้ตรงทันทีโดยไม่ผ่านไฟล์ migration
 * ถ้าเผลอรันตอน schema ในเครื่องต่างจาก production มันลบคอลัมน์ได้จริง
 * และ --force ข้ามคำถามยืนยันตรงนั้นไปเลย
 *
 * ทางที่ถูกสำหรับ production คือ generate แล้ว migrate ซึ่งเดินตามไฟล์ที่
 * ตรวจทานแล้ว ไม่ใช่ push
 *
 * ปลดล็อกได้ด้วย DRIZZLE_ALLOW_REMOTE=1 เมื่อจงใจจริงๆ — ต้องพิมพ์เอง
 * ทุกครั้ง ไม่มีทางติดมากับ .env ไฟล์ไหน
 */
const localHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
const isLocal = (() => {
  try {
    return localHosts.includes(new URL(url).hostname);
  } catch {
    // อ่าน URL ไม่ออกก็ถือว่าไม่ใช่เครื่องตัวเอง ปลอดภัยกว่าเดาว่าใช่
    return false;
  }
})();

// argv ของ `npx drizzle-kit push` คือ [node, drizzle-kit, "push", ...]
const command = process.argv[2];

if (command === "push" && !isLocal && process.env.DRIZZLE_ALLOW_REMOTE !== "1") {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "(อ่าน DATABASE_URL ไม่ออก)";
    }
  })();

  throw new Error(
    [
      "",
      `หยุดไว้ก่อน — drizzle-kit push กำลังจะยิงใส่ ${host} ซึ่งไม่ใช่เครื่องตัวเอง`,
      "",
      "push แก้ฐานข้อมูลให้ตรงกับ schema ทันทีโดยไม่ผ่านไฟล์ migration",
      "ถ้า schema ในเครื่องต่างจากปลายทาง มันลบคอลัมน์ได้จริง",
      "",
      "ต้องการยิงใส่ฐานข้อมูลในเครื่อง (sandbox) ให้ตั้ง DATABASE_URL ก่อน:",
      "  DATABASE_URL=postgres://postgres:test@localhost:55432/tidpeek_test npx drizzle-kit push",
      "  (dotenv ไม่เขียนทับตัวแปรที่ตั้งไว้แล้ว ค่านี้จึงชนะ .env.local)",
      "",
      "ต้องการแก้ฐานข้อมูลจริง ให้ใช้ generate แล้ว migrate ไม่ใช่ push:",
      "  npm run db:generate   # สร้างไฟล์ migration ไว้ตรวจทานก่อน",
      "  npm run db:migrate    # เดินตามไฟล์ที่ตรวจแล้ว",
      "",
      "ยืนยันว่าจงใจ push ใส่ปลายทางนี้จริง:",
      "  DRIZZLE_ALLOW_REMOTE=1 npx drizzle-kit push",
      "",
    ].join("\n"),
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: process.env.DATABASE_SSL === "0" ? false : "require",
  },
  // กันไม่ให้ drizzle-kit ไปยุ่งกับ schema ภายในของ Supabase
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
