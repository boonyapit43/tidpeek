/**
 * ด่านตรวจ env ตอน build — ให้ deploy ที่ตั้งค่าผิดตายตั้งแต่ตอน build
 *
 * ทำไมต้องมี: ทุกหน้าของแอปเป็น force-dynamic ตัวตรวจใน src/lib/env.ts
 * จึงไม่เคยถูกรันตอน build เลย ถ้า AUTH_SECRET สะกดผิดบน Vercel
 * build จะเขียวสวยงาม แล้วทุกหน้าค่อยพัง 500 ตอนมีคนเปิดจริง
 * ซึ่งกว่าจะรู้ก็คือหน้าร้านเปิดแอปไม่ได้ตอนกำลังขายของ
 *
 * กติกาตรงนี้จงใจหลวมกว่า env.ts เล็กน้อย (เช็คแค่มีครบและรูปร่างถูก)
 * ตัวจริงยังเป็น env.ts เหมือนเดิม ที่นี่แค่ดักของที่ลืมตั้งแน่ๆ
 */
import { readFileSync, existsSync } from "node:fs";

// โหลด .env.local เองแบบง่ายๆ สำหรับ build บนเครื่อง — บน Vercel ค่ามากับ
// process.env อยู่แล้ว (next build โหลดไฟล์นี้ให้ทีหลัง แต่สคริปต์นี้รันก่อน)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const problems = [];

const url = process.env.DATABASE_URL;
if (!url) problems.push("DATABASE_URL ยังไม่ได้ตั้ง");
else if (!url.startsWith("postgres")) problems.push("DATABASE_URL ไม่ใช่ที่อยู่ Postgres");

const secret = process.env.AUTH_SECRET;
if (!secret) problems.push("AUTH_SECRET ยังไม่ได้ตั้ง");
else if (secret.length < 32) problems.push("AUTH_SECRET สั้นกว่า 32 ตัวอักษร");

const pin = process.env.APP_PIN;
if (!pin) problems.push("APP_PIN ยังไม่ได้ตั้ง");
else if (!/^\d{4,10}$/.test(pin)) problems.push("APP_PIN ต้องเป็นตัวเลข 4-10 หลัก");

if (problems.length > 0) {
  console.error("\n✗ ตั้งค่า env ไม่ครบ — หยุด build ไว้ก่อนจะได้ไม่ deploy ของที่เปิดไม่ขึ้น\n");
  for (const p of problems) console.error("  • " + p);
  console.error("");
  process.exit(1);
}

console.log("✓ env ครบ " + ["DATABASE_URL", "AUTH_SECRET", "APP_PIN"].join(" · "));
