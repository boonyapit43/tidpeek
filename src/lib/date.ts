/**
 * วันที่ทั้งแอปเป็น string รูปแบบ "YYYY-MM-DD" ตรงกับชนิด date ของ Postgres
 * ไม่ใช้ Date object ส่งไปมาเพราะมันพก timezone ติดมาด้วยแล้วเพี้ยนง่าย
 */

/**
 * เขตเวลาที่ใช้ตัดสินว่า "วันนี้" คือวันไหน
 *
 * ต้องตรึงไว้ ห้ามพึ่งเวลาเครื่องเซิร์ฟเวอร์ เพราะ Vercel และโฮสต์ต่างประเทศ
 * รันเป็น UTC ถ้าปล่อยตามเครื่อง รายการที่บันทึกตอนห้าทุ่มครึ่งของไทย
 * จะถูกลงเป็นวันถัดไป แล้วยอดสรุปรายวันจะผิดทุกคืน
 */
export const TIME_ZONE = "Asia/Bangkok";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** วันนี้ตามเวลาไทย เช่น "2026-08-11" */
export function today(): string {
  return isoFormatter.format(new Date());
}

/** เดือนของวันที่ที่ให้มา เช่น "2026-08-11" → "2026-08" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** เดือนนี้ตามเวลาไทย */
export function currentMonth(): string {
  return monthOf(today());
}

/** ปีของวันที่หรือเดือนที่ให้มา เช่น "2026-08-11" → "2026" */
export function yearOf(dateOrMonth: string): string {
  return dateOrMonth.slice(0, 4);
}

/** ปีนี้ตามเวลาไทย */
export function currentYear(): string {
  return yearOf(today());
}

/** วันแรกและวันสุดท้ายของเดือน เช่น "2026-08" → ["2026-08-01", "2026-08-31"] */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(lastDay).padStart(2, "0")}`];
}

/** วันแรกและวันสุดท้ายของปี เช่น "2026" → ["2026-01-01", "2026-12-31"] */
export function yearRange(year: string): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}

/** บวกลบปี เช่น ("2026", -1) → "2025" */
export function addYears(year: string, delta: number): string {
  return String(Number(year) + delta);
}

/** บวกลบวัน โดยไม่ให้ timezone เข้ามาเกี่ยว */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** บวกลบเดือน เช่น ("2026-08", -1) → "2026-07" */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** "2026-08-11" → "11 ส.ค. 69" (พ.ศ. สองหลัก ประหยัดที่บนจอมือถือ) */
export function thaiDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
}

/** "2026-08-11" → "อังคาร 11 สิงหาคม 2569" ใช้ตอนมีที่ให้แสดงเต็ม */
export function thaiDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = THAI_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

/** "2026-08" → "สิงหาคม 2569" */
export function thaiMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

/** "2026-08" → "ส.ค." ใช้ในตารางรายปีที่ช่องแคบ */
export function thaiMonthShort(month: string): string {
  return THAI_MONTHS_SHORT[Number(month.slice(5, 7)) - 1];
}

/** "2026" → "2569" (พ.ศ.) */
export function thaiYear(year: string): string {
  return String(Number(year) + 543);
}

/** ป้ายกำกับสั้นๆ ที่คนอ่านแล้วเข้าใจทันทีว่าใกล้แค่ไหน */
export function relativeDayLabel(date: string): string | null {
  const now = today();
  if (date === now) return "วันนี้";
  if (date === addDays(now, -1)) return "เมื่อวาน";
  if (date === addDays(now, 1)) return "พรุ่งนี้";
  return null;
}
