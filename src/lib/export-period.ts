import type { Period } from "@/db/queries";
import {
  currentMonth,
  thaiDateLong,
  thaiMonth,
  thaiWeek,
  thaiYear,
  today,
  weekOf,
  weekRange,
} from "./date";
import { dateSchema, monthSchema, weekSchema, yearSchema } from "./validation";

export type ExportPeriod = {
  period: Period;
  /** ชื่อช่วงที่คนอ่านออก ไปโผล่ในชีตสรุป */
  label: string;
  /** ส่วนของชื่อไฟล์ที่บอกช่วง */
  slug: string;
};

/**
 * แปลงพารามิเตอร์ใน URL เป็นช่วงเวลาที่จะส่งออก
 *
 * แยกออกจาก route.ts เพราะสองเหตุผล
 *   • ไฟล์ route ของ Next ห้าม export อย่างอื่นนอกจาก handler กับ config
 *     ที่มันรู้จัก ถ้า export ฟังก์ชันนี้ไว้ที่นั่น build จะไม่ผ่าน
 *   • ตรงนี้คือที่ที่ "ลิงก์ที่คนแก้มือแล้ว" วิ่งเข้ามาชน จึงควรมีเทสตรงๆ
 *
 * ค่าที่ไม่ผ่านการตรวจจะตกกลับมาเป็นเดือนปัจจุบัน ไม่ใช่โยน error
 * เพราะลิงก์ส่งออกถูกแชร์และแก้มือได้ การได้ไฟล์ของเดือนนี้ยังมีประโยชน์
 * มากกว่าได้หน้าจอแดง
 */
export function resolvePeriod(params: URLSearchParams): ExportPeriod {
  const view = params.get("p");

  if (view === "day") {
    const day = dateSchema.safeParse(params.get("d")).data ?? today();
    return { period: { day }, label: thaiDateLong(day), slug: day };
  }

  if (view === "week") {
    // ดึงกลับไปหาวันจันทร์เสมอ ส่งวันไหนของสัปดาห์มาก็ได้สัปดาห์เดียวกัน
    const parsed = weekSchema.safeParse(params.get("w")).data;
    if (parsed) {
      const week = weekOf(parsed);
      const [from, to] = weekRange(week);
      return { period: { week }, label: `สัปดาห์ ${thaiWeek(week)}`, slug: `${from}_ถึง_${to}` };
    }
  }

  if (view === "year") {
    const year = yearSchema.safeParse(params.get("y")).data;
    if (year) {
      return { period: { year }, label: `ปี ${thaiYear(year)}`, slug: year };
    }
  }

  // ช่วงกำหนดเอง — ต้องมีครบทั้งสองฝั่งและเรียงถูกทาง
  // ถ้าสลับกันมาแล้วเราแอบสลับกลับให้ คนจะได้ไฟล์ที่ไม่ตรงกับที่กรอกโดยไม่รู้ตัว
  const from = dateSchema.safeParse(params.get("from")).data;
  const to = dateSchema.safeParse(params.get("to")).data;
  if (from && to && from <= to) {
    return {
      period: { from, to },
      label: `${thaiDateLong(from)} ถึง ${thaiDateLong(to)}`,
      slug: `${from}_ถึง_${to}`,
    };
  }

  const month = monthSchema.safeParse(params.get("m")).data ?? currentMonth();
  return { period: { month }, label: `เดือน${thaiMonth(month)}`, slug: month };
}
