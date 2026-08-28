import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  currentMonth,
  currentYear,
  monthOf,
  monthRange,
  relativeDayLabel,
  thaiDate,
  thaiDateLong,
  thaiMonth,
  thaiMonthShort,
  thaiTimestamp,
  thaiYear,
  today,
  yearOf,
  yearRange,
  addWeeks,
  currentWeek,
  thaiWeek,
  weekOf,
  weekRange,
} from "./date";

afterEach(() => {
  vi.useRealTimers();
});

/** ตรึงเวลาของระบบไว้ที่ช่วงเวลาหนึ่ง (ระบุเป็น UTC) */
function freeze(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("today — วันนี้ต้องมาจากเวลาไทยเสมอ", () => {
  /**
   * เทสสำคัญที่สุดในไฟล์นี้
   *
   * เครื่องที่รันเทสถูกตั้งเป็น UTC (ดู vitest.config.ts) เหมือนกับ Vercel
   * ถ้า today() ไปอ่านเวลาเครื่อง ห้าทุ่มครึ่งของไทยจะกลายเป็นวันถัดไป
   * แล้วรายการที่บันทึกตอนกลางคืนจะลงผิดวันทุกคืนโดยไม่มีใครสังเกต
   */
  it("ห้าทุ่มครึ่งของไทยยังเป็นวันเดิม ไม่ใช่วันถัดไป", () => {
    // 2026-08-11 23:30 ไทย = 2026-08-11 16:30 UTC
    freeze("2026-08-11T16:30:00Z");
    expect(today()).toBe("2026-08-11");
  });

  it("เที่ยงคืนครึ่งของไทยเป็นวันใหม่แล้ว", () => {
    // 2026-08-12 00:30 ไทย = 2026-08-11 17:30 UTC
    freeze("2026-08-11T17:30:00Z");
    expect(today()).toBe("2026-08-12");
  });

  it("ตีหนึ่งของ UTC ยังเป็นวันเดิมของไทย (ไทยเป็นเช้าแปดโมง)", () => {
    freeze("2026-08-11T01:00:00Z");
    expect(today()).toBe("2026-08-11");
  });

  it("ข้ามปีตอนสิ้นปีของไทย", () => {
    // 2027-01-01 00:30 ไทย = 2026-12-31 17:30 UTC
    freeze("2026-12-31T17:30:00Z");
    expect(today()).toBe("2027-01-01");
    expect(currentMonth()).toBe("2027-01");
    expect(currentYear()).toBe("2027");
  });
});

describe("monthRange", () => {
  it("เดือน 31 วัน", () => {
    expect(monthRange("2026-08")).toEqual(["2026-08-01", "2026-08-31"]);
  });

  it("เดือน 30 วัน", () => {
    expect(monthRange("2026-04")).toEqual(["2026-04-01", "2026-04-30"]);
  });

  it("กุมภาพันธ์ปีปกติ", () => {
    expect(monthRange("2026-02")).toEqual(["2026-02-01", "2026-02-28"]);
  });

  it("กุมภาพันธ์ปีอธิกสุรทิน", () => {
    expect(monthRange("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
  });

  it("เดือนธันวาคม ต้องไม่ล้นไปปีถัดไป", () => {
    expect(monthRange("2026-12")).toEqual(["2026-12-01", "2026-12-31"]);
  });
});

describe("yearRange", () => {
  it("ครอบทั้งปี", () => {
    expect(yearRange("2026")).toEqual(["2026-01-01", "2026-12-31"]);
  });
});

describe("addDays", () => {
  it("บวกวันปกติ", () => {
    expect(addDays("2026-08-11", 1)).toBe("2026-08-12");
  });

  it("ลบข้ามเดือน", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("ลบข้ามเดือนในปีอธิกสุรทิน", () => {
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("บวกข้ามปี", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("ลบข้ามปี", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("addMonths", () => {
  it("ถอยจากมกราคมไปธันวาคมปีก่อน", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("เดินจากธันวาคมไปมกราคมปีหน้า", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("เดินหลายเดือนข้ามปี", () => {
    expect(addMonths("2026-08", 6)).toBe("2027-02");
  });

  it("เลขเดือนมีศูนย์นำหน้าเสมอ", () => {
    expect(addMonths("2026-12", 2)).toBe("2027-02");
  });
});

describe("addYears", () => {
  it("บวกลบปี", () => {
    expect(addYears("2026", 1)).toBe("2027");
    expect(addYears("2026", -1)).toBe("2025");
  });
});

describe("ตัดส่วนของวันที่", () => {
  it("monthOf และ yearOf", () => {
    expect(monthOf("2026-08-11")).toBe("2026-08");
    expect(yearOf("2026-08-11")).toBe("2026");
    expect(yearOf("2026-08")).toBe("2026");
  });
});

describe("แสดงผลเป็นพุทธศักราช", () => {
  it("thaiDate ใช้ปีสองหลัก", () => {
    expect(thaiDate("2026-08-11")).toBe("11 ส.ค. 69");
  });

  it("thaiDate เติมศูนย์เมื่อปีลงท้ายด้วยเลขหลักเดียว", () => {
    // 2025 + 543 = 2568 → "68"  ส่วน 1957+543 = 2500 → ต้องเป็น "00" ไม่ใช่ "0"
    expect(thaiDate("1957-01-05")).toBe("5 ม.ค. 00");
  });

  it("thaiDateLong มีชื่อวันในสัปดาห์", () => {
    // 11 สิงหาคม 2026 ตรงกับวันอังคาร
    expect(thaiDateLong("2026-08-11")).toBe("อังคาร 11 สิงหาคม 2569");
  });

  it("thaiMonth และ thaiMonthShort", () => {
    expect(thaiMonth("2026-08")).toBe("สิงหาคม 2569");
    expect(thaiMonthShort("2026-08")).toBe("ส.ค.");
    expect(thaiMonthShort("2026-01")).toBe("ม.ค.");
    expect(thaiMonthShort("2026-12")).toBe("ธ.ค.");
  });

  it("thaiYear", () => {
    expect(thaiYear("2026")).toBe("2569");
  });
});

describe("thaiTimestamp — เวลาสำหรับไฟล์ที่ส่งออก", () => {
  /**
   * คุมบั๊กที่เคยเกิดจริง
   *
   * เดิมไฟล์ CSV เขียนเวลาด้วย String(date) ตรงๆ ได้ออกมาเป็น
   * "Tue Aug 11 2026 23:46:15 GMT+0700 (เวลาอินโดจีน)"
   * ซึ่ง Excel อ่านเป็นวันที่ไม่ออก และเปลี่ยนหน้าตาตามภาษาของเครื่อง
   */
  it("แปลงเป็นรูปแบบที่ Excel อ่านออก ตามเวลาไทย", () => {
    // 2026-08-11 16:46 UTC = 2026-08-11 23:46 ไทย
    expect(thaiTimestamp(new Date("2026-08-11T16:46:15Z"))).toBe("2026-08-11 23:46");
  });

  it("ข้ามเที่ยงคืนของไทยแล้วเป็นวันใหม่", () => {
    // 2026-08-11 17:30 UTC = 2026-08-12 00:30 ไทย
    expect(thaiTimestamp(new Date("2026-08-11T17:30:00Z"))).toBe("2026-08-12 00:30");
  });

  it("ไม่มีคอมมาปนมา ไม่งั้นจะทำให้คอลัมน์ใน CSV เพี้ยน", () => {
    expect(thaiTimestamp(new Date("2026-08-11T16:46:15Z"))).not.toContain(",");
  });

  it("ค่าว่างหรือไม่ถูกต้องคืนช่องว่าง ไม่ใช่ Invalid Date", () => {
    expect(thaiTimestamp(null)).toBe("");
    expect(thaiTimestamp(undefined)).toBe("");
    expect(thaiTimestamp(new Date("ไม่ใช่วันที่"))).toBe("");
  });
});

describe("relativeDayLabel", () => {
  it("บอกวันนี้ เมื่อวาน พรุ่งนี้ ตามเวลาไทย", () => {
    freeze("2026-08-11T16:30:00Z"); // ห้าทุ่มครึ่งของวันที่ 11 ตามเวลาไทย

    expect(relativeDayLabel("2026-08-11")).toBe("วันนี้");
    expect(relativeDayLabel("2026-08-10")).toBe("เมื่อวาน");
    expect(relativeDayLabel("2026-08-12")).toBe("พรุ่งนี้");
    expect(relativeDayLabel("2026-08-09")).toBeNull();
  });
});

describe("สัปดาห์", () => {
  /**
   * สัปดาห์เริ่มวันจันทร์ เพราะ "สัปดาห์นี้" ต้องหมายถึงช่วงเดียวกันทุกครั้ง
   * ที่เปิดดู ไม่ใช่เลื่อนตามวันที่บังเอิญกดเข้ามา
   */
  it("ทุกวันในสัปดาห์เดียวกัน ได้วันจันทร์ตัวเดียวกัน", () => {
    const monday = "2026-08-31";
    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.UTC(2026, 7, 31 + i)).toISOString().slice(0, 10);
      expect(weekOf(day)).toBe(monday);
    }
  });

  it("วันจันทร์ถัดไปขึ้นสัปดาห์ใหม่", () => {
    expect(weekOf("2026-09-06")).toBe("2026-08-31");
    expect(weekOf("2026-09-07")).toBe("2026-09-07");
  });

  it("คร่อมปีได้ถูกต้อง", () => {
    // 1 ม.ค. 2026 เป็นวันพฤหัส สัปดาห์จึงเริ่มที่ 29 ธ.ค. 2025
    expect(weekOf("2026-01-01")).toBe("2025-12-29");
    expect(weekRange("2025-12-29")).toEqual(["2025-12-29", "2026-01-04"]);
  });

  it("ช่วงของสัปดาห์ยาวเจ็ดวันเสมอ", () => {
    const [from, to] = weekRange("2026-08-31");
    expect(from).toBe("2026-08-31");
    expect(to).toBe("2026-09-06");
  });

  it("บวกลบสัปดาห์ทีละเจ็ดวัน", () => {
    expect(addWeeks("2026-08-31", 1)).toBe("2026-09-07");
    expect(addWeeks("2026-08-31", -1)).toBe("2026-08-24");
  });

  it("สัปดาห์ปัจจุบันเป็นวันจันทร์เสมอ", () => {
    expect(weekOf(currentWeek())).toBe(currentWeek());
  });

  it("แสดงผลเป็นภาษาไทย และย่อเมื่ออยู่เดือนเดียวกัน", () => {
    expect(thaiWeek("2026-08-24")).toBe("24–30 ส.ค. 69");
  });

  it("คร่อมเดือนต้องบอกทั้งสองเดือน", () => {
    expect(thaiWeek("2026-08-31")).toBe("31 ส.ค. – 6 ก.ย. 69");
  });
});
