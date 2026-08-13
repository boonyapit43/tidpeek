import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * เทสที่ต่อฐานข้อมูลจริง — แยกไฟล์ config ออกจากเทสหน่วย
 *
 *   npm test       เทสหน่วย รันได้ทุกที่ ไม่ต้องมีอะไรเพิ่ม
 *   npm run test:db  เทสนี้ ต้องมี Postgres ใน Docker รันอยู่ก่อน
 *
 * ที่แยกกันเพราะเทสหน่วยต้องรันได้เสมอแม้ไม่มี Docker แต่เทสชุดนี้ต้องมี
 * ฐานจริงถึงจะบอกอะไรได้ ถ้ารวมไฟล์เดียวกัน คนที่ไม่ได้เปิด Docker
 * จะเห็นเทสตกแดงเต็มจอแล้วเลิกรันเทสไปเลย ซึ่งแย่กว่าไม่มีเทส
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    setupFiles: ["src/test/setup.ts"],

    // เทสชุดนี้ใช้ฐานเดียวกันทุกไฟล์และล้างข้อมูลก่อนทุกเทส
    // ถ้ารันขนานกันจะล้างข้อมูลทับกันเอง
    fileParallelism: false,

    env: {
      TZ: "UTC",
      DATABASE_URL: "postgres://postgres:test@127.0.0.1:55432/tidpeek_test",
      DATABASE_SSL: "0",
      APP_PIN: "0000",
      AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
