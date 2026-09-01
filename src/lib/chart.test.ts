import { describe, expect, it } from "vitest";
import {
  barLayout,
  daysOfMonth,
  daysOfWeek,
  eachDay,
  monthsOfYear,
  donutSlices,
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

/* ------------------------------------------------------------------ */

/**
 * โดนัทสัดส่วนของภาพสรุป
 *
 * หน่วยที่คืนออกมาเป็น 1/100 ของเส้นรอบวง เพราะฝั่ง SVG ตั้ง pathLength="100"
 * เทสจึงตรวจได้ว่าทุกชิ้นบวกกับร่องแล้วลงตัวพอดีหนึ่งวง ไม่มีชิ้นล้นไปทับกัน
 */
describe("แบ่งวงแหวนตามสัดส่วน", () => {
  const totalDrawn = (slices: { length: number }[], gap: number) =>
    slices.reduce((sum, s) => sum + s.length, 0) + gap * slices.filter((s) => s.length > 0).length;

  it("สองชิ้นเท่ากัน ได้ส่วนโค้งเท่ากันและอยู่คนละครึ่งวง", () => {
    const [a, b] = donutSlices([100, 100], 0);

    expect(a.fraction).toBe(0.5);
    expect(b.fraction).toBe(0.5);
    expect(a.length).toBe(50);
    expect(b.length).toBe(50);
    expect(a.offset).toBe(0);
    expect(b.offset).toBe(50);
  });

  /**
   * ร่องระหว่างชิ้นต้องถูกหักออกจากพื้นที่ก่อนแบ่ง
   *
   * ถ้าไม่หัก ผลรวมของส่วนโค้งบวกร่องจะเกินหนึ่งวง แล้วชิ้นสุดท้ายจะวนไป
   * ทับชิ้นแรก ซึ่งบนจอเห็นเป็นสีผิดตรงหัววง
   */
  it("รวมส่วนโค้งกับร่องแล้วพอดีหนึ่งวง ไม่ล้น", () => {
    const gap = 1.5;
    const slices = donutSlices([50, 30, 15, 5], gap);

    expect(totalDrawn(slices, gap)).toBeCloseTo(100, 6);
  });

  it("ชิ้นเดียวเต็มวง ไม่เว้นร่องให้ขาดวิ่น", () => {
    const [only] = donutSlices([1234.56]);

    expect(only.fraction).toBe(1);
    expect(only.length).toBe(100);
    expect(only.offset).toBe(0);
  });

  /**
   * ชิ้นจิ๋วต้องยังเห็นว่ามีอยู่ ไม่ใช่หายไปกลืนกับร่อง
   * ประเภทที่จ่ายไปยี่สิบบาทจากแสนบาท ยังต้องมีเส้นบางๆ ให้เห็น
   */
  it("ชิ้นที่เล็กมาก ยังวาดให้เห็น", () => {
    const [big, tiny] = donutSlices([100000, 20]);

    expect(tiny.fraction).toBeLessThan(0.001);
    expect(tiny.length).toBeGreaterThan(0);
    // และไม่ไปเบียดชิ้นใหญ่จนสัดส่วนดูผิด
    expect(big.length).toBeGreaterThan(90);
  });

  it("ไม่มีเงินเลย ไม่ต้องวาดวง", () => {
    expect(donutSlices([])).toEqual([]);
    expect(donutSlices([0, 0])).toEqual([]);
  });

  /**
   * ค่าติดลบไม่มีที่ยืนในวงกลม — ปัดเป็นศูนย์ ไม่ใช่ลากส่วนโค้งย้อนกลับ
   * ซึ่งจะทำให้ชิ้นถัดไปเริ่มผิดที่ทั้งวง
   */
  it("ค่าติดลบถูกปัดทิ้ง ไม่ทำให้ทั้งวงเพี้ยน", () => {
    const slices = donutSlices([100, -50, 100], 0);

    expect(slices[1].length).toBe(0);
    expect(slices[0].fraction).toBeCloseTo(0.5, 6);
    expect(slices[2].fraction).toBeCloseTo(0.5, 6);
    expect(slices[2].offset).toBeCloseTo(50, 6);
  });

  it("ชิ้นที่เป็นศูนย์ไม่กินร่อง ชิ้นถัดไปจึงต่อกันพอดี", () => {
    const gap = 2;
    const slices = donutSlices([60, 0, 40], gap);

    expect(totalDrawn(slices, gap)).toBeCloseTo(100, 6);
  });
});
