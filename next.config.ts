import type { NextConfig } from "next";

/**
 * ทุกอ็อปชันในไฟล์นี้มีไว้เพื่อให้แอปย้ายโฮสต์ได้โดยไม่ต้องแก้โค้ด
 * อ่าน docs/DEPLOY.md ก่อนแก้
 */
/**
 * รหัสประจำรุ่นที่ build ออกมา — ใช้บอกหน้าที่เปิดค้างว่ามีของใหม่ขึ้นแล้ว
 * (ดู src/components/version-watch.tsx ว่าทำไมต้องมี)
 *
 * ⚠️ ห้ามใช้ Date.now() หรืออะไรที่ไม่คงที่มาเป็นค่านี้เด็ดขาด
 *    ไฟล์นี้ถูกอ่านได้มากกว่าหนึ่งครั้งต่อการ build หนึ่งรอบ ถ้าค่าที่ฝัง
 *    ไปกับหน้าไม่เท่ากับค่าที่ฝั่งเซิร์ฟเวอร์ตอบ หน้าจะเห็นว่ามีรุ่นใหม่
 *    ตลอดเวลาแล้วรีโหลดตัวเองวนไม่จบ ซึ่งแย่กว่าการเห็นของเก่าหลายเท่า
 *
 * ไม่มีค่าให้ = ปิดฟีเจอร์นี้ไปเลย ไม่ใช่เดาค่าขึ้นมาเอง
 * ฝั่งหน้าจอเช็กแล้วว่าค่าว่างแปลว่าไม่ต้องทำอะไร
 *
 * โฮสต์ที่ไม่ใช่ Vercel ตั้ง BUILD_ID เองตอน build ได้ เช่นใส่ commit sha
 */
const buildId =
  process.env.BUILD_ID?.slice(0, 12) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // ฝังลงไปในโค้ดฝั่งหน้าจอตอน build หน้าที่เปิดค้างไว้จึงรู้ว่าตัวเองรุ่นไหน
  env: { NEXT_PUBLIC_BUILD_ID: buildId },

  /**
   * standalone สร้าง .next/standalone ที่รันด้วย `node server.js` ได้เลย
   * จำเป็นสำหรับ DirectAdmin/Passenger และ VPS
   *
   * แต่ปิดเมื่ออยู่บน Vercel เพราะ Vercel มีวิธีแพ็กผลลัพธ์ของตัวเอง
   * (Build Output API) การสั่ง standalone ทับไปด้วยเป็นการทำงานซ้อนกัน
   * ทำให้ build ช้าลงและขนาดผลลัพธ์บวมโดยไม่ได้ประโยชน์
   *
   * VERCEL เป็นตัวแปรที่ Vercel ตั้งให้เองตอน build ไม่ต้องไปตั้งเพิ่ม
   */
  output: process.env.VERCEL ? undefined : "standalone",

  // ถ้าจะวางแอปไว้ใต้ path ย่อย เช่น example.com/ledger ให้ตั้ง BASE_PATH=/ledger
  // ตอน build (ค่านี้ถูกฝังตอน build ไม่ใช่ตอน runtime)
  basePath: process.env.BASE_PATH || undefined,

  // ไม่พึ่ง image optimizer ของ Vercel — บนแชร์โฮสติ้งไม่มี sharp ให้ใช้
  images: { unoptimized: true },

  // ให้ build ล้มถ้า type ไม่ผ่าน แทนที่จะไปพังตอน deploy
  // (Next.js 16 เลิกรัน ESLint ตอน build แล้ว จึงต้องเรียก `npm run check` แยกใน CI)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
