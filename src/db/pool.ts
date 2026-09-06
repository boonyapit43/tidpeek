/**
 * ตั้งค่า connection ให้เหมาะกับประตูที่ใช้ต่อฐานข้อมูล
 *
 * ไม่มี "server-only" ตรงนี้โดยตั้งใจ เพราะเป็นตรรกะล้วนที่ต้องเทสได้
 * ตัวที่ต่อฐานจริงอยู่ที่ index.ts
 */

export type PoolOptions = {
  /** pgBouncer โหมด transaction ไม่รองรับ prepared statement */
  prepare: boolean;
  /** จำนวน connection ที่เปิดค้างไว้ได้ */
  max: number;
};

/**
 * Supabase มีสองประตู พอร์ตต่างกันและใช้คนละสถานการณ์
 *
 *   6543  transaction pooler (pgBouncer)  — สำหรับ serverless เช่น Vercel
 *   5432  session                          — สำหรับเซิร์ฟเวอร์ที่รันค้างไว้
 */
export const isTransactionPooler = (port: string): boolean => port === "6543";

export function poolOptions(port: string): PoolOptions {
  const pooled = isTransactionPooler(port);

  return {
    /**
     * prepared statement ต้องปิดเมื่อผ่าน pgBouncer โหมด transaction
     * ถ้าลืมปิดจะเจอ "prepared statement already exists" แบบสุ่มๆ ตามยากมาก
     */
    prepare: !pooled,

    /**
     * ⚠️ ห้ามตั้ง max เป็น 1 กับ transaction pooler เด็ดขาด
     *
     * เคยตั้งไว้ 1 ด้วยเหตุผลว่า "pooler จัดคิวให้อยู่แล้ว ฝั่งแอปเปิดค้าง
     * ไว้เยอะไม่มีประโยชน์" ซึ่งฟังดูสมเหตุสมผลแต่ทำให้แอปค้างทั้งใบ
     *
     * เพราะ postgres.js ยัดหลาย query ลง connection เดียวแบบ pipeline
     * ส่วน pgBouncer โหมด transaction รับแบบนั้นไม่ได้ พอเจอ Promise.all
     * มันล็อกตายไม่มีวันตอบกลับ
     *
     * วัดกับฐาน production จริง (อ่านอย่างเดียว) — Promise.all สี่ query
     *   max 1   ค้างเกิน 20 วินาที
     *   max 4   ผ่าน ~1 วินาที
     *   max 10  ผ่าน ~1 วินาที
     *
     * ทุกหน้าในแอปยิง query ขนานกันด้วย Promise.all จึงเจอทันทีทุกหน้า
     * ไม่ใช่เคสหายาก
     *
     * 4 พอสำหรับจำนวน query ที่หน้าหนึ่งยิงพร้อมกันมากที่สุด และยังน้อยพอ
     * ที่ instance หลายตัวรวมกันแล้วไม่ไปกินโควตา connection ของ pooler
     */
    max: pooled ? 4 : 10,
  };
}

/** อ่านพอร์ตจาก connection string คืนค่าว่างถ้าอ่านไม่ออก */
export function portOf(url: string): string {
  try {
    return new URL(url).port;
  } catch {
    return "";
  }
}
