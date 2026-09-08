// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AWAKE_COOKIE } from "@/lib/lock";
import { AwakeBeacon } from "./awake-beacon";

/**
 * ตัวต่ออายุ cookie "แอปยังตื่นอยู่"
 *
 * ตัวนี้ไม่ได้ล็อกอะไร มันคือสิ่งที่กันไม่ให้ล็อก ซึ่งแปลว่าถ้ามันทำงาน
 * มากเกินไปสักนิดเดียว ฟีเจอร์ทั้งอันจะตายโดยไม่มีอะไรฟ้อง — แอปจะดูปกติ
 * ทุกอย่าง แค่ไม่ล็อกเท่านั้น เหมือนบั๊กสามรอบก่อนหน้านี้เป๊ะ
 *
 * เทสต์ที่สำคัญที่สุดในไฟล์นี้จึงเป็นข้อ "ห้ามต่ออายุตอนที่หน้าถูกซ่อน"
 */
const hasCookie = () => document.cookie.includes(`${AWAKE_COOKIE}=1`);

const clearCookie = () => {
  document.cookie = `${AWAKE_COOKIE}=; path=/; max-age=0`;
};

const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers();
  clearCookie();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearCookie();
});

describe("AwakeBeacon", () => {
  it("ต่ออายุทันทีตอนขึ้น — ผ่านด่านเซิร์ฟเวอร์มาแล้วแปลว่ายังตื่นอยู่", () => {
    render(<AwakeBeacon />);
    expect(hasCookie()).toBe(true);
  });

  it("ต่ออายุเรื่อยๆ ระหว่างเปิดค้างไว้ ไม่ให้หมดอายุคาที่ตอนกำลังใช้งาน", () => {
    render(<AwakeBeacon />);
    clearCookie();

    vi.advanceTimersByTime(60 * 1000);

    expect(hasCookie()).toBe(true);
  });

  /**
   * ข้อที่ห้ามพลาด
   *
   * เบราว์เซอร์เดสก์ท็อปหน่วงตัวจับเวลาของแท็บที่ถูกซ่อน แต่ไม่ได้หยุดมัน
   * ถ้าต่ออายุโดยไม่ดูว่าหน้าถูกซ่อนอยู่ แท็บที่เปิดค้างข้ามคืนจะต่ออายุ
   * ตัวเองไปเรื่อยๆ แล้วจะไม่มีวันล็อกเลย
   */
  it("ห้ามต่ออายุตอนที่หน้าถูกซ่อนอยู่ ไม่งั้นแท็บที่เปิดค้างไว้จะไม่มีวันล็อก", () => {
    render(<AwakeBeacon />);
    setVisibility("hidden");
    clearCookie();

    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(hasCookie()).toBe(false);
  });

  it("ต่ออายุตอนกลับมาเห็นหน้าจอ", () => {
    render(<AwakeBeacon />);
    setVisibility("hidden");
    clearCookie();

    setVisibility("visible");

    expect(hasCookie()).toBe(true);
  });

  /**
   * เขียนครั้งสุดท้ายตอนกำลังจะถูกซ่อน เพื่อให้ 15 นาทีเริ่มนับจากวินาที
   * ที่วางเครื่องพอดี ไม่ใช่จากการต่ออายุรอบก่อนซึ่งอาจผ่านมาแล้ว 59 วินาที
   */
  it("ต่ออายุตอนกำลังจะถูกซ่อน ให้ 15 นาทีเริ่มนับตรงจังหวะที่วางเครื่อง", () => {
    render(<AwakeBeacon />);
    clearCookie();

    setVisibility("hidden");

    expect(hasCookie()).toBe(true);
  });

  it("ต่ออายุตอน pagehide ด้วย เพราะ iOS ไม่ได้ยิง visibilitychange เสมอไป", () => {
    render(<AwakeBeacon />);
    clearCookie();

    window.dispatchEvent(new Event("pagehide"));

    expect(hasCookie()).toBe(true);
  });

  it("เลิกต่ออายุเมื่อถูกถอดออก", () => {
    const { unmount } = render(<AwakeBeacon />);
    unmount();
    clearCookie();

    vi.advanceTimersByTime(10 * 60 * 1000);
    window.dispatchEvent(new Event("pagehide"));

    expect(hasCookie()).toBe(false);
  });
});
