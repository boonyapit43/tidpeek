/**
 * สร้างไฟล์ไอคอน PNG ทั้งหมดจากต้นฉบับ SVG ไฟล์เดียว
 *
 *   npm i -D sharp
 *   node scripts/gen-icons.mjs
 *   npm uninstall sharp
 *
 * ตั้งใจไม่เก็บ sharp ไว้ใน devDependencies ถาวร เพราะมันมี binary ของ
 * ระบบปฏิบัติการติดมาด้วยราว 30MB และใช้แค่ตอนแก้ไอคอนซึ่งนานๆ ครั้ง
 * ผลลัพธ์เป็นไฟล์ PNG ที่ commit ไว้แล้ว ตอน build ปกติจึงไม่ต้องมีอะไรเพิ่ม
 *
 * ทำไมไม่ generate ตอน runtime ด้วย next/og: เพราะจะกลายเป็น route ที่ต้อง
 * ประมวลผลทุกครั้งที่มีคนขอไอคอน ซึ่งเปลืองโดยไม่จำเป็นสำหรับภาพที่ไม่เคย
 * เปลี่ยน และเพิ่มของที่ต้องทำงานได้บนโฮสต์ปลายทาง
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { default: sharp } = await import("sharp").catch(() => {
  console.error("ไม่พบ sharp — รัน `npm i -D sharp` ก่อน แล้วค่อยรันสคริปต์นี้");
  process.exit(1);
});

const root = process.cwd();

const GRADIENT = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4F46E5" />
      <stop offset="1" stop-color="#7C3AED" />
    </linearGradient>
  </defs>`;

/** ปีก — ชิ้นเดียวกับใน src/app/icon.svg */
const MARK = `
  <path fill="#fff" d="M104 352
    C 112 254 178 174 288 136
    C 246 192 224 246 218 292
    C 268 222 326 182 400 162
    C 356 222 328 274 314 318
    C 352 284 384 268 418 262
    C 372 336 268 374 138 374
    C 112 374 102 368 104 352 Z" />`;

/** แบบปกติ — มุมโค้งในตัว ใช้กับ favicon และไอคอนของ iOS */
const standard = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT}
  <rect width="512" height="512" rx="120" fill="url(#g)" />
  ${MARK}
</svg>`;

/**
 * แบบ maskable — พื้นเต็มขอบไม่มีมุมโค้ง
 *
 * Android จะตัดไอคอนเป็นทรงอะไรก็ได้ตามธีมของเครื่อง (วงกลม สี่เหลี่ยม หยดน้ำ)
 * ถ้าส่งแบบมุมโค้งไปให้ จะโดนตัดซ้อนอีกชั้นจนมุมกุด
 * แบบนี้จึงให้พื้นเต็มผืนแล้วย่อลายให้อยู่ในวงปลอดภัยตรงกลาง 80%
 * ไม่ว่าเครื่องจะตัดเป็นทรงไหน ลายก็ไม่โดนบั่น
 */
const maskable = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT}
  <rect width="512" height="512" fill="url(#g)" />
  <g transform="translate(64 64) scale(0.75)">${MARK}</g>
</svg>`;

const TARGETS = [
  { svg: standard, size: 192, out: ["public", "icon-192.png"] },
  { svg: standard, size: 512, out: ["public", "icon-512.png"] },
  { svg: maskable, size: 512, out: ["public", "icon-maskable-512.png"] },
  // iOS ไม่อ่าน manifest จึงต้องมีไฟล์นี้แยก Next.js หยิบไปใส่ให้เองจาก app/
  { svg: standard, size: 180, out: ["src", "app", "apple-icon.png"] },
];

await mkdir(join(root, "public"), { recursive: true });

for (const { svg, size, out } of TARGETS) {
  const path = join(root, ...out);

  const png = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(path, png);
  console.log(`  ${out.join("/")}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log("\nสร้างไอคอนครบแล้ว");
