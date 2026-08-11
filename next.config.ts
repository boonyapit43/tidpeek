import type { NextConfig } from "next";

/**
 * ทุกอ็อปชันในไฟล์นี้มีไว้เพื่อให้แอปย้ายโฮสต์ได้โดยไม่ต้องแก้โค้ด
 * อ่าน docs/DEPLOY.md ก่อนแก้
 */
const nextConfig: NextConfig = {
  reactCompiler: true,

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
