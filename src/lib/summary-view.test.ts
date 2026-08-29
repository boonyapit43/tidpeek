import { describe, expect, it } from "vitest";
import { defaultSummaryView } from "./summary-view";

/**
 * กติกาเลือกมุมมองตั้งต้นของหน้าแรก — ผิดแล้วคนเปิดแอปมาเจอหน้าว่าง
 * ทั้งที่มีข้อมูลอยู่ ซึ่งคือสิ่งที่เคยเกิดจริงและถูกทักมา
 */

const TODAY = "2026-08-29";

describe("เลือกช่วงที่แคบสุดที่มีข้อมูล", () => {
  it("วันนี้มีรายการแล้ว เปิดมุมมองวัน", () => {
    expect(defaultSummaryView("2026-08-29", TODAY)).toBe("day");
  });

  it("วันนี้ยังว่าง แต่เดือนนี้มี เปิดมุมมองเดือน", () => {
    expect(defaultSummaryView("2026-08-15", TODAY)).toBe("month");
  });

  it("เช้าวันที่ 1 ของเดือน — เดือนนี้ยังว่าง เปิดมุมมองปี", () => {
    expect(defaultSummaryView("2026-08-31", "2026-09-01")).toBe("year");
  });

  it("ร้านใหม่ยังไม่มีรายการเลย เปิดมุมมองเดือน", () => {
    expect(defaultSummaryView(null, TODAY)).toBe("month");
  });

  it("รายการล่าสุดลงไว้ล่วงหน้า (พรุ่งนี้) นับเหมือนวันนี้มีของ", () => {
    expect(defaultSummaryView("2026-08-30", TODAY)).toBe("day");
  });

  it("หยุดใช้ข้ามปี ปีนี้ว่าง เปิดเดือนไว้เป็นจุดเริ่มใหม่", () => {
    expect(defaultSummaryView("2025-12-30", "2026-08-29")).toBe("month");
  });
});
