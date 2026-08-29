import { addDays, monthRange, weekRange } from "./date";

/**
 * คณิตของกราฟแท่งกำไร — แยกออกมาจากคอมโพเนนต์เพื่อให้เทสได้ตรงๆ
 *
 * กราฟนี้บอกกำไร/ขาดทุนด้วย "ตำแหน่ง" เป็นหลัก แท่งบวกอยู่เหนือเส้นศูนย์
 * แท่งลบห้อยลงใต้เส้น สีเขียว/แดงเป็นแค่ตัวเสริม — จำเป็น เพราะคู่เขียวแดง
 * เป็นคู่ที่คนตาบอดสีแยกไม่ออก (ตรวจด้วยเครื่องมือแล้ว ΔE ต่ำกว่าเกณฑ์จริง)
 * ตำแหน่งจึงต้องเล่าเรื่องได้ครบด้วยตัวเองเสมอ ห้ามพึ่งสีอย่างเดียว
 */

export type BarBox = {
  /** ระยะจากขอบบน เป็นเปอร์เซ็นต์ของความสูงกราฟ */
  top: number;
  /** ความสูงแท่ง เป็นเปอร์เซ็นต์ */
  height: number;
  negative: boolean;
};

export type BarChartLayout = {
  /** ตำแหน่งเส้นศูนย์ เป็นเปอร์เซ็นต์จากขอบบน */
  baseline: number;
  bars: BarBox[];
};

/**
 * วางแท่งบนพื้นที่ 100% โดยแบ่งพื้นที่บน/ล่างเส้นศูนย์ตามข้อมูลจริง
 *
 * เดือนที่กำไรทุกวัน เส้นศูนย์จะอยู่ชิดล่างและแท่งได้พื้นที่เต็ม ไม่ใช่ถูก
 * บังคับให้เหลือครึ่งล่างว่างๆ ไว้เผื่อขาดทุนที่ไม่เคยเกิด
 *
 * แท่งที่มีค่าแต่เตี้ยกว่า 2% ถูกดันขึ้นมาเป็น 2% — วันที่มีเงินเดินต้องมองเห็น
 * ว่ามี ไม่ใช่หายไปเหมือนวันที่ไม่มีรายการเลย
 */
export function barLayout(values: number[], minVisible = 2): BarChartLayout {
  const maxPositive = Math.max(0, ...values);
  const maxNegative = Math.max(0, ...values.map((v) => -v));
  const range = maxPositive + maxNegative;

  if (range === 0) {
    return { baseline: 100, bars: values.map(() => ({ top: 100, height: 0, negative: false })) };
  }

  const baseline = (maxPositive / range) * 100;

  const bars = values.map((value): BarBox => {
    if (value === 0) return { top: baseline, height: 0, negative: false };

    const height = Math.max((Math.abs(value) / range) * 100, minVisible);

    return value > 0
      ? { top: Math.max(baseline - height, 0), height, negative: false }
      : { top: baseline, height, negative: true };
  });

  return { baseline, bars };
}

/* ------------------------------------------------------------------ */

/** ทุกวันในช่วง รวมหัวท้าย — ไว้เติมวันที่ไม่มีรายการให้กราฟไม่มีรูโหว่ */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

export function daysOfWeek(weekStart: string): string[] {
  const [from, to] = weekRange(weekStart);
  return eachDay(from, to);
}

export function daysOfMonth(month: string): string[] {
  const [from, to] = monthRange(month);
  return eachDay(from, to);
}

export function monthsOfYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * ตัวอักษรย่อวันในสัปดาห์แบบไทย ใช้เป็นป้ายใต้แท่งของมุมมองสัปดาห์
 *
 * คำนวณจาก Date.UTC ล้วน ไม่แตะ timezone ของเครื่อง — วันที่ในแอปเป็น
 * ข้อความ YYYY-MM-DD ที่ตรึงวันไว้แล้ว แค่ต้องรู้ว่าตรงกับวันอะไรเท่านั้น
 */
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function thaiWeekdayShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
