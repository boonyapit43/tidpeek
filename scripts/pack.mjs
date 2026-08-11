/**
 * ประกอบโฟลเดอร์ deploy/ ที่อัปโหลดขึ้นโฮสต์แล้วสั่ง `node server.js` ได้เลย
 *
 *   npm run build && npm run pack
 *
 * ผลลัพธ์รันได้โดยไม่ต้อง npm install ที่ปลายทาง เพราะ output standalone
 * ของ Next.js คัดมาเฉพาะไฟล์ใน node_modules ที่โค้ดเรียกใช้จริง
 * ซึ่งสำคัญมากบนแชร์โฮสติ้งที่ RAM จำกัดจน npm install มักถูกฆ่ากลางคัน
 *
 * ทำไมต้องมีสคริปต์นี้: Next.js ไม่ได้ก๊อบ .next/static กับ public/ เข้าไป
 * ใน standalone ให้เอง (เพราะปกติ CDN เสิร์ฟสองอย่างนี้แทน) บนโฮสต์ธรรมดา
 * ที่ไม่มี CDN ถ้าไม่ก๊อบเข้าไปจะได้หน้าเว็บที่ไม่มี CSS และไม่มีรูปเลย
 */
import { cp, mkdir, rm, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
const out = join(root, "deploy");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error("ไม่พบ .next/standalone — รัน `npm run build` ก่อน");
  console.error('และตรวจว่า next.config.ts ตั้ง output: "standalone" ไว้');
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// server.js, node_modules ที่คัดแล้ว และโค้ดฝั่งเซิร์ฟเวอร์
await cp(standalone, out, { recursive: true });

// ไฟล์ JavaScript และ CSS ที่ browser โหลด — ขาดอันนี้หน้าเว็บจะไม่มีสไตล์เลย
await cp(join(root, ".next", "static"), join(out, ".next", "static"), { recursive: true });

// ไอคอนและไฟล์สาธารณะอื่นๆ
if (await exists(join(root, "public"))) {
  await cp(join(root, "public"), join(out, "public"), { recursive: true });
}

// เตือนไม่ให้ลืมสร้าง .env ที่ปลายทาง ซึ่งเป็นสาเหตุอันดับหนึ่งที่แอปไม่ขึ้น
await writeFile(
  join(out, "README-DEPLOY.txt"),
  [
    "อัปโหลดทั้งโฟลเดอร์นี้ขึ้นโฮสต์ แล้วสร้างไฟล์ .env ไว้ในโฟลเดอร์เดียวกับ server.js",
    "",
    "เนื้อหาใน .env ต้องมีอย่างน้อยสี่บรรทัดนี้",
    "",
    "  DATABASE_URL=postgresql://...",
    "  DATABASE_SSL=1",
    "  APP_PIN=รหัสที่ตั้งเอง",
    "  AUTH_SECRET=สุ่มมาอย่างน้อย 32 ตัวอักษร",
    "",
    "แล้วสั่งรันด้วย  node server.js",
    "หรือถ้าใช้ DirectAdmin ให้ตั้ง Application startup file เป็น server.js",
    "",
    "หมายเหตุ: BASE_PATH ถูกฝังไว้ตั้งแต่ตอน build แล้ว",
    "ถ้าจะเปลี่ยน path ต้อง build ใหม่ที่เครื่องแล้ว pack ใหม่",
  ].join("\n"),
  "utf8",
);

console.log("ประกอบโฟลเดอร์ deploy/ เรียบร้อย");
console.log("ขั้นต่อไป: อัปโหลด deploy/ ขึ้นโฮสต์ แล้วสร้างไฟล์ .env ในนั้น");
