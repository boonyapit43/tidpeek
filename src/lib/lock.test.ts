import { describe, expect, it } from "vitest";
import { LOCK_AFTER_MS, shouldLock } from "./lock";

/**
 * กติกาการล็อกแอปเมื่อปิดทิ้งไว้นาน
 *
 * ผิดได้สองทางและเจ็บคนละแบบ — ล็อกถี่เกินไปคือต้องกรอก PIN ทุกครั้งที่
 * สลับไปตอบไลน์ ส่วนไม่ล็อกเลยคือใครหยิบเครื่องไปก็เปิดดูยอดทั้งเดือนได้
 */

const NOW = 1_700_000_000_000;
const นาที = (n: number) => n * 60 * 1000;

describe("ล็อกเมื่อไหร่", () => {
  it("เพิ่งเปิดหน้า ยังไม่เคยสลับออกไป ไม่ล็อก", () => {
    expect(shouldLock({ hiddenAt: null, now: NOW })).toBe(false);
  });

  it("สลับออกไปแป๊บเดียวแล้วกลับมา ไม่ล็อก", () => {
    expect(shouldLock({ hiddenAt: NOW - นาที(1), now: NOW })).toBe(false);
  });

  /** สลับไปตอบไลน์แล้วกลับมาต้องไม่โดนล็อก ไม่งั้นกวนจนคนเลิกใช้ */
  it("หายไป 14 นาที ยังไม่ล็อก", () => {
    expect(shouldLock({ hiddenAt: NOW - นาที(14), now: NOW })).toBe(false);
  });

  it("ครบ 15 นาทีพอดี ล็อก", () => {
    expect(shouldLock({ hiddenAt: NOW - LOCK_AFTER_MS, now: NOW })).toBe(true);
  });

  it("หายไปครึ่งวัน ล็อก", () => {
    expect(shouldLock({ hiddenAt: NOW - นาที(720), now: NOW })).toBe(true);
  });

  /**
   * นาฬิกาเครื่องถูกปรับย้อน หรือค่าที่เก็บไว้เพี้ยน
   * เลือกไม่ล็อก เพราะเด้งคนที่กำลังใช้งานอยู่ออกแย่กว่าไม่ล็อกหนึ่งครั้ง
   */
  it("เวลาที่เก็บไว้อยู่ในอนาคต ไม่ล็อก", () => {
    expect(shouldLock({ hiddenAt: NOW + นาที(60), now: NOW })).toBe(false);
  });

  it("ตั้งเวลาเองได้ เผื่อวันหนึ่งอยากเปลี่ยน", () => {
    expect(shouldLock({ hiddenAt: NOW - นาที(3), now: NOW, afterMs: นาที(2) })).toBe(true);
    expect(shouldLock({ hiddenAt: NOW - นาที(3), now: NOW, afterMs: นาที(5) })).toBe(false);
  });
});

describe("ค่าที่ตั้งไว้", () => {
  it("15 นาที", () => {
    expect(LOCK_AFTER_MS).toBe(15 * 60 * 1000);
  });
});
