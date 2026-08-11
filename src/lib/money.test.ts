import { describe, expect, it } from "vitest";
import { baht, bahtShort, profitPercent, toNumber } from "./money";

describe("toNumber", () => {
  it("แปลง string ที่มาจาก numeric ของ Postgres", () => {
    expect(toNumber("1234.56")).toBe(1234.56);
    expect(toNumber("0")).toBe(0);
    expect(toNumber("-500.25")).toBe(-500.25);
  });

  it("ค่าว่างถือเป็นศูนย์ ไม่ใช่ NaN", () => {
    // เกิดได้จริงเมื่อ left join ไม่เจอแถว ถ้าปล่อยเป็น NaN
    // หน้าจอจะขึ้นคำว่า NaN ให้คนใช้เห็น
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber("ไม่ใช่ตัวเลข")).toBe(0);
  });
});

describe("baht — แสดงสตางค์เสมอ", () => {
  it("ใส่จุลภาคและทศนิยมสองตำแหน่ง", () => {
    expect(baht("1234.5")).toBe("1,234.50");
    expect(baht("1000000")).toBe("1,000,000.00");
    expect(baht("0")).toBe("0.00");
  });

  it("ค่าติดลบ", () => {
    expect(baht("-1234.56")).toBe("-1,234.56");
  });
});

describe("bahtShort — ซ่อนสตางค์เมื่อเป็นจำนวนเต็ม", () => {
  it("จำนวนเต็มไม่ต้องโชว์ .00 ให้รกตา", () => {
    expect(bahtShort("1234")).toBe("1,234");
    expect(bahtShort("1234.00")).toBe("1,234");
    expect(bahtShort("0")).toBe("0");
  });

  it("มีสตางค์จริงต้องโชว์ครบ ไม่ปัดทิ้ง", () => {
    // สำคัญ: ถ้าปัดทิ้ง ยอดบนจอจะไม่ตรงกับที่บันทึกไว้จริง
    // แล้วคนจะกระทบยอดกับสมุดธนาคารไม่ได้
    expect(bahtShort("1234.56")).toBe("1,234.56");
    expect(bahtShort("0.25")).toBe("0.25");
    expect(bahtShort("1234.50")).toBe("1,234.50");
  });

  it("ค่าติดลบ", () => {
    expect(bahtShort("-1250.75")).toBe("-1,250.75");
    expect(bahtShort("-1250")).toBe("-1,250");
  });
});

describe("profitPercent", () => {
  it("คิดเป็นสัดส่วนของรายรับ", () => {
    expect(profitPercent("250", "1000")).toBe(25);
    expect(profitPercent("1000", "1000")).toBe(100);
  });

  it("ขาดทุนได้เปอร์เซ็นต์ติดลบ", () => {
    expect(profitPercent("-500", "1000")).toBe(-50);
  });

  it("ไม่มีรายรับคืน null ไม่ใช่หารด้วยศูนย์", () => {
    // ถ้าปล่อยให้หารด้วยศูนย์จะได้ Infinity แล้วหน้าจอขึ้น "Infinity%"
    expect(profitPercent("0", "0")).toBeNull();
    expect(profitPercent("-300", "0")).toBeNull();
  });
});

describe("ความแม่นยำของเงิน", () => {
  /**
   * เทสนี้เป็นเหตุผลที่ทั้งแอปให้ SQL รวมยอดแทน JavaScript
   *
   * แสดงให้เห็นว่าถ้าเผลอเอา string ของเงินมาบวกกันใน JS ผลจะเพี้ยน
   * ตัวเลขข้างล่างคือ 0.1 + 0.2 ซึ่งใน IEEE-754 ได้ 0.30000000000000004
   */
  it("การบวกทศนิยมใน JavaScript เพี้ยนจริง — จึงต้องรวมใน SQL", () => {
    const wrong = toNumber("0.1") + toNumber("0.2");
    expect(wrong).not.toBe(0.3);
    expect(wrong.toFixed(20)).toBe("0.30000000000000004441");
  });

  it("ค่าที่รวมมาจาก SQL แล้วแสดงผลได้ตรงเป๊ะ", () => {
    // SQL คืน numeric(12,2) มาเป็น string ที่แม่นยำอยู่แล้ว
    // แปลงเป็น number ครั้งเดียวตอนแสดงผลจึงไม่มีปัญหา
    expect(bahtShort("0.30")).toBe("0.30");
  });

  it("รองรับยอดสูงสุดที่ numeric(12,2) เก็บได้", () => {
    expect(baht("9999999999.99")).toBe("9,999,999,999.99");
  });
});
