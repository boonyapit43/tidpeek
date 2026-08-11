import { defineConfig } from "drizzle-kit";

// drizzle-kit เป็นเครื่องมือ CLI จึงไม่ผ่าน src/lib/env.ts ที่ import "server-only"
// อ่าน .env.local เองตรงนี้แทน
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

// `drizzle-kit generate` สร้างไฟล์ migration จาก schema อย่างเดียว ไม่ต้องต่อฐานข้อมูล
// จึงใส่ค่าหลอกไว้ให้รันได้แม้ยังไม่ได้ตั้ง .env.local
// ส่วน migrate/push/studio ที่ต้องต่อจริงจะล้มเองพร้อมข้อความที่อ่านรู้เรื่อง
const url = process.env.DATABASE_URL ?? "postgresql://localhost:5432/__not_configured__";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: process.env.DATABASE_SSL === "0" ? false : "require",
  },
  // กันไม่ให้ drizzle-kit ไปยุ่งกับ schema ภายในของ Supabase
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
