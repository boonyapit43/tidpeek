/**
 * เงินในแอปนี้เดินทางเป็น string เสมอ ตั้งแต่ฐานข้อมูลจนถึงตอนแสดงผล
 *
 * เหตุผล: Postgres เก็บเป็น numeric(12,2) ซึ่งแม่นยำระดับสตางค์
 * แต่ number ของ JavaScript เป็น IEEE-754 ที่แทนทศนิยมฐานสิบไม่ได้ครบ
 * พอเอามาบวกกันหลายบรรทัดจะเพี้ยนทีละสตางค์แล้วสะสมจนยอดไม่ตรง
 *
 * กติกาของไฟล์นี้:
 *   • การรวมยอดทั้งหมดเกิดใน SQL — ดู src/db/queries.ts
 *   • ฝั่ง TypeScript แปลง string เป็น number ได้ครั้งเดียวตอนจะแสดงผลเท่านั้น
 *   • ห้าม export ฟังก์ชันบวกลบเงินจากไฟล์นี้ ถ้าอยากบวกให้ไปเขียนใน SQL
 */

/** แปลงเงินที่เป็น string เป็น number — ใช้ตอนแสดงผลเท่านั้น ห้ามเอาไปบวกต่อ */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

const fullFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 1234.5 → "1,234.50" ใช้ตอนที่ต้องเห็นสตางค์ เช่นหน้ารายละเอียด */
export function baht(value: string | number | null | undefined): string {
  return fullFormatter.format(toNumber(value));
}

/**
 * 1234.5 → "1,235"  แต่ 1234.56 ที่มีสตางค์จริงจะยังโชว์ "1,234.56"
 *
 * ใช้บนจอมือถือที่พื้นที่แคบ ตัวเลขกลมๆ อ่านเร็วกว่า แต่ถ้ามีสตางค์
 * ต้องเห็น ไม่งั้นยอดที่โชว์จะไม่ตรงกับที่บันทึกไว้จริงและคนใช้จะสับสน
 */
export function bahtShort(value: string | number | null | undefined): string {
  const n = toNumber(value);
  return Number.isInteger(n) ? compactFormatter.format(n) : fullFormatter.format(n);
}

/**
 * เปอร์เซ็นต์กำไร — เป็นอัตราส่วนสำหรับดูเฉยๆ ไม่ใช่ยอดเงิน
 * จึงคำนวณด้วย number ได้ปลอดภัย
 */
export function profitPercent(profit: string | number, income: string | number): number | null {
  const i = toNumber(income);
  if (i <= 0) return null;
  return (toNumber(profit) / i) * 100;
}
