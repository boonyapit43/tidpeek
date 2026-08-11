import "server-only";
import { z } from "zod";

/**
 * ตรวจ env ทั้งหมดตอนบูตครั้งเดียว
 *
 * เหตุผลที่ทำแบบนี้: env ที่หายหรือพิมพ์ผิดควรทำให้แอปไม่ขึ้นตั้งแต่แรก
 * ไม่ใช่ปล่อยให้ไปพังตอนคนกำลังบันทึกรายการ แล้วเจอ error หน้าตาไม่รู้เรื่อง
 */
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "ต้องตั้ง DATABASE_URL — คัดลอกจาก .env.example")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL ต้องเป็น connection string ของ Postgres ไม่ใช่ API key ของ Supabase",
    ),

  DATABASE_SSL: z
    .enum(["0", "1"])
    .default("1")
    .transform((v) => v === "1"),

  APP_PIN: z.string().min(4, "APP_PIN ต้องยาวอย่างน้อย 4 หลัก"),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร — สร้างด้วย crypto.randomBytes(32)"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function load() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
    throw new Error(`ตั้งค่า environment ไม่ครบ:\n${lines.join("\n")}\n`);
  }

  return parsed.data;
}

export const env = load();
