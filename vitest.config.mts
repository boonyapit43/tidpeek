import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],

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
