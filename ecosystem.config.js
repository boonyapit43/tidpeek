/**
 * ตั้งค่า pm2 สำหรับรันบน VPS
 *
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.js && pm2 save && pm2 startup
 *
 * ใช้เฉพาะตอนรันบน VPS ที่คุมเครื่องเอง ถ้า deploy บน Vercel หรือ
 * DirectAdmin ไม่ต้องใช้ไฟล์นี้เลย เพราะสองที่นั้นจัดการ process ให้อยู่แล้ว
 */
module.exports = {
  apps: [
    {
      name: "shop-ledger",
      script: ".next/standalone/server.js",
      cwd: __dirname,

      /**
       * โหมด fork ไม่ใช่ cluster
       *
       * ตัวนับจำนวนครั้งที่กรอก PIN ผิดเก็บอยู่ในหน่วยความจำของ process
       * (ดู src/lib/auth.ts) ถ้ารันหลาย process แต่ละตัวจะนับแยกกัน
       * ทำให้เดารหัสได้มากกว่าที่ตั้งไว้เป็นเท่าตัวของจำนวน process
       *
       * แอปบัญชีร้านมีคนใช้ไม่กี่คน process เดียวเหลือเฟือ
       * ถ้าวันหนึ่งต้องขยายจริง ให้ย้ายตัวนับไปเก็บใน Postgres ก่อน
       */
      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // ฟังเฉพาะ localhost ให้ nginx เป็นตัวเดียวที่รับจากอินเทอร์เน็ต
        HOSTNAME: "127.0.0.1",
      },

      // รีสตาร์ทเองถ้าหน่วยความจำรั่วจนบวมผิดปกติ
      max_memory_restart: "400M",

      error_file: "logs/error.log",
      out_file: "logs/out.log",
      time: true,
    },
  ],
};
