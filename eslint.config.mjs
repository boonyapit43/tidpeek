import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // โฟลเดอร์ที่ npm run pack ประกอบขึ้นมา — เป็นโค้ดที่ Next.js สร้าง
    // ไม่ใช่โค้ดที่เราเขียน จึงไม่มีประโยชน์ที่จะ lint
    "deploy/**",
    // ไฟล์ SQL ที่ drizzle-kit สร้าง
    "drizzle/**",
  ]),
]);

export default eslintConfig;
