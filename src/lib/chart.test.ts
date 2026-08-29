import { describe, expect, it } from "vitest";
import {
  barLayout,
  daysOfMonth,
  daysOfWeek,
  eachDay,
  monthsOfYear,
  thaiWeekdayShort,
} from "./chart";

/**
 * คณิตของกราฟกำไร — ผิดตรงนี้แล้วกราฟโกหกทั้งแผง
 *
 * ที่ต้องระวังเป็นพิเศษคือเส้นศูนย์ เพราะกราฟนี้ใช้ "ตำแหน่งเทียบเส้นศูนย์"
 * เป็นตัวบอกกำไร/ขาดทุนหลัก (สีเขียวแดงเป็นแค่ตัวเสริม คนตาบอดสีแยกไม่ออก)
 * ถ้าเส้นศูนย์วางผิด วันขาดทุนจะดูเหมือนกำไรทั้งที่ตัวเลขถูกทุกตัว
 */

describe("การวางแท่ง", () => {
  it("กำไรล้วน เส้นศูนย์อยู่ชิดล่าง แท่งได้พื้นที่เต็ม", () => {
    const { baseline, bars } = barLayout([100, 50]);

    expect(baseline).toBe(100);
    expect(bars[0]).toEqual({ top: 0, height: 100, negative: false });
    expect(bars[1]).toEqual({ top: 50, height: 50, negative: false });
  });

  it("ขาดทุนล้วน เส้นศูนย์อยู่ชิดบน แท่งห้อยลงทั้งหมด", () => {
    const { baseline, bars } = barLayout([-100, -25]);

    expect(baseline).toBe(0);
    expect(bars[0]).toEqual({ top: 0, height: 100, negative: true });
    expect(bars[1]).toEqual({ top: 0, height: 25, negative: true });
  });

  it("ปนกัน เส้นศูนย์แบ่งพื้นที่ตามสัดส่วนของฝั่งที่มากกว่า", () => {
    // บวกสุด 300 ลบสุด 100 → ข้างบนได้ 75% ข้างล่าง 25%
    const { baseline, bars } = barLayout([300, -100]);

    expect(baseline).toBe(75);
    expect(bars[0]).toEqual({ top: 0, height: 75, negative: false });
    expect(bars[1]).toEqual({ top: 75, height: 25, negative: true });
  });

  it("วันที่เป็นศูนย์ ไม่มีแท่ง แต่ช่องยังอยู่", () => {
    const { bars } = barLayout([100, 0, -50]);

    expect(bars[1].height).toBe(0);
    expect(bars).toHaveLength(3);
  });

  it("ทุกวันเป็นศูนย์ ไม่พัง และไม่มีแท่งหลอน", () => {
    const { bars } = barLayout([0, 0]);
    expect(bars.every((b) => b.height === 0)).toBe(true);
  });

  /**
   * วันที่ขายได้ 20 บาทในเดือนที่วันอื่นขายเป็นหมื่น ต้องยังมองเห็น
   * ว่ามีเงินเดิน ไม่ใช่หายไปกลืนกับวันที่ไม่มีรายการเลย
   */
  it("แท่งจิ๋วถูกดันขึ้นมาให้มองเห็น ไม่หายไปเฉยๆ", () => {
    const { bars } = barLayout([10000, 20]);

    expect(bars[1].height).toBe(2);
    expect(bars[1].negative).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("การเติมช่วงให้ครบทุกช่อง", () => {
  it("ทุกวันในช่วง รวมหัวท้าย", () => {
    expect(eachDay("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("สัปดาห์ได้เจ็ดวันเสมอ เริ่มวันจันทร์", () => {
    const days = daysOfWeek("2026-08-24");

    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-24");
    expect(days[6]).toBe("2026-08-30");
  });

  it("เดือนได้ครบตามจำนวนวันจริง รวมกุมภาปีอธิกสุรทิน", () => {
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2028-02")).toHaveLength(29);
    expect(daysOfMonth("2026-08")).toHaveLength(31);
  });

  it("ปีได้สิบสองเดือน เลขเดือนมีศูนย์นำ", () => {
    const months = monthsOfYear("2026");

    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-01");
    expect(months[11]).toBe("2026-12");
  });
});

/* ------------------------------------------------------------------ */

describe("ตัวย่อวันในสัปดาห์", () => {
  it("ตรงกับปฏิทินจริง", () => {
    expect(thaiWeekdayShort("2026-08-24")).toBe("จ"); // จันทร์
    expect(thaiWeekdayShort("2026-08-28")).toBe("ศ"); // ศุกร์
    expect(thaiWeekdayShort("2026-08-30")).toBe("อา"); // อาทิตย์
  });

  it("ไม่เลื่อนวันตาม timezone ของเครื่องที่รัน", () => {
    // เทสรันบน TZ=UTC โดยตั้งใจ ถ้าคำนวณผ่านเวลาท้องถิ่นจะเพี้ยนบนเครื่องไทย
    expect(thaiWeekdayShort("2026-01-01")).toBe("พฤ");
  });
});
