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

/**
 * ตัดทุกอย่างที่ไม่ใช่ตัวเลขออกจากสิ่งที่คนพิมพ์ลงช่องจำนวนเงิน
 *
 * ที่ต้องมีเพราะช่องจำนวนเงินเป็น type=text ไม่ใช่ type=number ซึ่งจงใจ
 * (type=number เปิดคีย์บอร์ดไม่มีจุดทศนิยมบน Android บางเครื่อง และแปลงค่า
 * เป็น number ไปแล้วหนึ่งรอบ ซึ่งขัดกฎที่ว่าเงินต้องเป็น string ตลอดทาง)
 * ผลข้างเคียงคือไม่มีอะไรห้ามพิมพ์ตัวอักษรลงไป
 *
 * เดิมปล่อยให้พิมพ์ได้แล้วไปดักตอนกดบันทึก ซึ่งทำงานถูกแต่คนใช้เจอกล่อง
 * ข้อความภาษาอังกฤษของเบราว์เซอร์ ("Please match the requested format.")
 * ส่วนข้อความไทยที่เขียนไว้ไม่มีวันได้แสดงเลยเพราะโดนดักก่อนถึงเซิร์ฟเวอร์
 * ตัดตั้งแต่ตอนพิมพ์ดีกว่า — ตัวอักษรไม่ติดตั้งแต่แรก ไม่มีอะไรให้ต้องเตือน
 *
 * กติกา
 *   • เก็บเฉพาะตัวเลขกับจุดทศนิยม
 *   • คอมมากับเว้นวรรคทิ้ง — ในแอปนี้มันคือตัวคั่นหลักพัน ไม่ใช่จุดทศนิยม
 *     (amountSchema ก็ทิ้งแบบเดียวกัน สองที่นี้ต้องคิดตรงกันเสมอ)
 *   • จุดได้จุดเดียว ทศนิยมไม่เกินสองตำแหน่ง เท่ากับ numeric(12,2) ในฐานข้อมูล
 *   • ขึ้นต้นด้วยจุดให้เติม 0 ให้ ".5" จึงกลายเป็น "0.5" ที่ผ่านการตรวจ
 *
 * ⚠️ allowNegative มีไว้สำหรับยอดตั้งต้นของบัญชีเท่านั้น ซึ่งติดลบได้จริง
 *    (บัตรเครดิต) ห้ามเปิดให้ช่องจำนวนเงินของรายการ — รายรับติดลบคือรายจ่าย
 *    ซึ่งมีฝั่งของมันอยู่แล้ว ถ้าปนกันยอดสรุปจะเล่าคนละเรื่องกับความจริง
 */
export function cleanMoneyInput(raw: string, allowNegative = false): string {
  const negative = allowNegative && raw.trimStart().startsWith("-");
  const kept = raw.replace(/[^\d.]/g, "");

  const [whole, ...afterDots] = kept.split(".");
  /**
   * จุดที่เกินมาถูกยุบ ไม่ใช่ตัดทิ้งทั้งท่อน — คนพิมพ์ "1.2.3" ตั้งใจได้
   * "1.23" มากกว่า "1.2" และมากกว่าการที่ตัวเลขหายไปเฉยๆ
   */
  const body =
    afterDots.length === 0
      ? whole
      : `${whole || "0"}.${afterDots.join("").slice(0, 2)}`;

  return negative ? `-${body}` : body;
}
