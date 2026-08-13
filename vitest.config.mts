import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",

    /**
     * .tsx = เทสคอมโพเนนต์ ต้องมี DOM จึงประกาศ environment ไว้หัวไฟล์
     * ด้วย `// @vitest-environment happy-dom` เป็นรายไฟล์
     *
     * รวมไว้กับเทสหน่วยชุดเดียวกันเพราะไม่ต้องใช้ Docker เหมือนกัน
     * `npm test` จึงยังรันได้ทุกที่โดยไม่ต้องเตรียมอะไร
     */
    include: ["src/**/*.test.{ts,tsx}"],

    /**
     * ตรึงเขตเวลาของเครื่องที่รันเทสไว้ที่ UTC โดยตั้งใจ
     *
     * เพราะสิ่งที่ต้องพิสูจน์คือ "วันนี้" ของแอปมาจาก Asia/Bangkok เสมอ
     * ไม่ใช่จากเครื่อง ถ้าปล่อยให้เทสรันบนเครื่องที่ตั้งเวลาไทยอยู่แล้ว
     * เทสจะผ่านทั้งที่โค้ดพัง แล้วไปพังจริงบน Vercel ซึ่งรันเป็น UTC
     */
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
