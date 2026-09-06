/**
 * สร้างไฟล์ไอคอนทุกขนาดจากภาพต้นฉบับไฟล์เดียว
 *
 *   node scripts/gen-icons.mjs
 *
 * ต้นฉบับคือ assets/app-icon.png — ภาพจัตุรัสเต็มขอบ ไม่มีมุมโค้ง ไม่มีขอบขาว
 * แก้ลายที่ไฟล์นั้นแล้วรันสคริปต์นี้ใหม่ อย่าแก้ไฟล์ PNG ปลายทางโดยตรง
 *
 * ⚠️ ต้นฉบับต้องเต็มขอบเสมอ ห้ามมีมุมโค้งติดมาในภาพ
 *    ทั้ง iOS และ Android โค้งมุมให้เองตอนแสดงผล ถ้าภาพมีมุมโค้งมาแล้ว
 *    จะโดนโค้งซ้อนอีกชั้นจนเห็นขอบพื้นหลังเป็นกรอบคั่นรอบไอคอน
 *
 * sharp ไม่ได้อยู่ใน dependencies ของโปรเจกต์ แต่ next ลากมาให้อยู่แล้ว
 * สำหรับ next/image ถ้าวันหนึ่งมันหายไป ให้ลง `npm i -D sharp` ชั่วคราว
 * ผลลัพธ์เป็นไฟล์ PNG ที่ commit ไว้ ตอน build ปกติจึงไม่ต้องมีอะไรเพิ่ม
 *
 * ทำไมไม่ generate ตอน runtime ด้วย next/og: เพราะจะกลายเป็น route ที่ต้อง
 * ประมวลผลทุกครั้งที่มีคนขอไอคอน ซึ่งเปลืองโดยไม่จำเป็นสำหรับภาพที่ไม่เคย
 * เปลี่ยน และเพิ่มของที่ต้องทำงานได้บนโฮสต์ปลายทาง
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const { default: sharp } = await import("sharp").catch(() => {
  console.error("ไม่พบ sharp — รัน `npm i -D sharp` ก่อน แล้วค่อยรันสคริปต์นี้");
  process.exit(1);
});

const root = process.cwd();
const SOURCE = join(root, "assets", "app-icon.png");

const master = sharp(SOURCE);
const { width, height } = await master.metadata();
if (width !== height) {
  console.error(`ต้นฉบับต้องเป็นจัตุรัส แต่ได้ ${width}×${height}`);
  process.exit(1);
}

/**
 * แบบ maskable สำหรับ Android
 *
 * Android ตัดไอคอนเป็นทรงอะไรก็ได้ตามธีมของเครื่อง — วงกลม สี่เหลี่ยม หยดน้ำ
 * มาตรฐานรับประกันแค่วงกลมกลางภาพขนาด 80% ของด้านว่าจะไม่โดนตัด
 *
 * ลายของร้านกางปีกออกเกือบเต็มความกว้าง ถ้าส่งภาพเต็มไปตรงๆ ปลายปีกทั้ง
 * สองข้างหายแน่นอน จึงย่อทั้งภาพลงเหลือ 76% แล้ววางกลาง
 *
 * ส่วนที่เหลือรอบนอกเติมด้วยการยืดพิกเซลริมสุดออกไป (clamp to edge)
 * ไม่ใช่ทาสีพื้นทับ เพราะพื้นแดงของต้นฉบับไล่เฉดอยู่ ถ้าทาสีเดียวจะเห็น
 * เป็นกรอบสี่เหลี่ยมซ้อนอยู่ในไอคอน
 */
async function maskable(size) {
  const SAFE = 0.76;
  const inner = Math.round(size * SAFE);
  const pad = Math.round((size - inner) / 2);

  const small = await sharp(SOURCE).resize(inner, inner).removeAlpha().raw().toBuffer();

  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(inner - 1, Math.max(0, y - pad));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(inner - 1, Math.max(0, x - pad));
      const s = (sy * inner + sx) * 3;
      const o = (y * size + x) * 3;
      out[o] = small[s];
      out[o + 1] = small[s + 1];
      out[o + 2] = small[s + 2];
    }
  }

  return sharp(out, { raw: { width: size, height: size, channels: 3 } }).png(PNG).toBuffer();
}

/**
 * บีบเป็น PNG แบบจานสี 128 สี
 *
 * ลายนี้เป็นภาพไล่เฉด ไม่ใช่รูปทรงสีแบน เก็บสีเต็มแล้วไฟล์ 512px โตถึง
 * 282 KB จานสี 128 เหลือ 35 KB โดยดูด้วยตาแยกไม่ออก ทั้งเฉดแดงที่พื้น
 * และไล่ทองบนลาย ตรวจแล้วด้วยการซูมมุมพื้นเรียบ ไม่พบแถบสีจากการลดสี
 */
const PNG = { compressionLevel: 9, palette: true, colors: 128 };

/** แบบปกติ — ย่อจากต้นฉบับตรงๆ */
const plain = (size) => sharp(SOURCE).resize(size, size).png(PNG).toBuffer();

const TARGETS = [
  { make: () => plain(192), out: ["public", "icon-192.png"] },
  { make: () => plain(512), out: ["public", "icon-512.png"] },
  { make: () => maskable(512), out: ["public", "icon-maskable-512.png"] },
  // iOS ไม่อ่าน manifest จึงต้องมีไฟล์นี้แยก Next.js หยิบไปใส่ให้เองจาก app/
  { make: () => plain(180), out: ["src", "app", "apple-icon.png"] },
  /**
   * ไอคอนบนแท็บเบราว์เซอร์ — 64px ให้เบราว์เซอร์ย่อลงเหลือ 16 หรือ 32 เอง
   *
   * เคยเป็น SVG ซึ่งคมทุกขนาด แต่ลายใหม่เป็นภาพ ไม่ใช่เส้น จึงต้องเป็น PNG
   * ที่ 16px ลายจะเหลือแค่รอยทองบนพื้นแดง ซึ่งยังพอแยกออกจากแท็บอื่นได้
   */
  { make: () => plain(64), out: ["src", "app", "icon.png"] },
];

for (const { make, out } of TARGETS) {
  const png = await make();
  await writeFile(join(root, ...out), png);
  const { width: w } = await sharp(png).metadata();
  console.log(`  ${out.join("/").padEnd(32)} ${w}×${w}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log("\nสร้างไอคอนครบแล้ว");
