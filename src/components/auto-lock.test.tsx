// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { AutoLock, LockReset } from "./auto-lock";

/**
 * ตัวล็อกแอปเมื่อปิดทิ้งไว้เกิน 15 นาที
 *
 * ตัวนี้เคยพังเงียบๆ มาสามรอบ และทุกรอบพังในทางที่เห็นด้วยตาไม่ได้ —
 * แอปดูปกติทุกอย่าง แค่ไม่ล็อกเท่านั้น กว่าจะรู้ก็ต่อเมื่อไปลองจับเวลาจริง
 *
 *   รอบแรก  ใช้ sessionStorage ซึ่ง iOS ล้างทิ้งตอนปิดแอปที่ค้างอยู่
 *           ยิ่งทิ้งไว้นานยิ่งไม่ล็อก ตรงข้ามกับที่ต้องการเป๊ะ
 *   รอบสอง  ฟังแต่ visibilitychange ซึ่งไม่ยิงตอนเปิดแอปใหม่หลังถูกปิดทิ้ง
 *   รอบสาม  หน้า PIN กับหน้าเลือกร้านไม่มีใครล้างเวลาที่ค้างอยู่
 *           วางเครื่องคาหน้า PIN เกิน 15 นาทีแล้วกรอก จะโดนเด้งกลับทันที
 *
 * เทสต์ชุดนี้จึงล็อกพฤติกรรมไว้ทั้งสามรอบ ไม่ใช่แค่ "ล็อกได้"
 */

const logout = vi.fn<() => Promise<void>>();

vi.mock("@/actions/auth", () => ({
  logout: () => logout(),
}));

const KEY = "ledger_hidden_at";
const นาที = 60 * 1000;

/** ปลอมสถานะว่าหน้าถูกมองเห็นอยู่หรือถูกซ่อน แล้วยิงเหตุการณ์ตามจริง */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

const นาทีที่แล้ว = (n: number) => String(Date.now() - n * นาที);

beforeEach(() => {
  logout.mockReset();
  logout.mockResolvedValue(undefined);
  localStorage.clear();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(cleanup);

describe("AutoLock", () => {
  it("ล็อกเมื่อเปิดแอปใหม่หลังทิ้งไว้เกินกำหนด แม้ visibilitychange ไม่เคยยิง", async () => {
    // นี่คือกรณีที่ iOS ปิดแอปทิ้งแล้วเปิดใหม่ หน้าโหลดมาในสภาพมองเห็นอยู่แล้ว
    localStorage.setItem(KEY, นาทีที่แล้ว(20));

    render(<AutoLock />);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("ไม่ล็อกเมื่อเปิดใหม่หลังทิ้งไว้ไม่ถึงกำหนด", async () => {
    localStorage.setItem(KEY, นาทีที่แล้ว(5));

    render(<AutoLock />);
    await Promise.resolve();

    expect(logout).not.toHaveBeenCalled();
  });

  it("ไม่ล็อกเมื่อไม่มีเวลาที่จดไว้เลย (เพิ่งกรอก PIN เข้ามา)", async () => {
    render(<AutoLock />);
    await Promise.resolve();

    expect(logout).not.toHaveBeenCalled();
  });

  it("จดเวลาตอนถูกซ่อน แล้วล็อกตอนกลับมาถ้าหายไปนาน", async () => {
    render(<AutoLock />);

    setVisibility("hidden");
    expect(localStorage.getItem(KEY)).not.toBeNull();

    // ย้อนเวลาที่จดไว้ให้เป็นเมื่อ 20 นาทีก่อน = หายไปนาน
    localStorage.setItem(KEY, นาทีที่แล้ว(20));
    setVisibility("visible");

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("สลับไปแอปอื่นแล้วกลับมาเร็วๆ ไม่ล็อก", async () => {
    render(<AutoLock />);

    setVisibility("hidden");
    setVisibility("visible");
    await Promise.resolve();

    expect(logout).not.toHaveBeenCalled();
  });

  it("จดเวลาตอน pagehide ด้วย เพราะ iOS ไม่ได้ยิง visibilitychange เสมอไป", () => {
    render(<AutoLock />);

    window.dispatchEvent(new Event("pagehide"));

    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("ล้างเวลาที่จดไว้ทิ้งหลังตรวจ กันวนล็อกซ้ำหลังกรอก PIN ใหม่", async () => {
    localStorage.setItem(KEY, นาทีที่แล้ว(20));

    render(<AutoLock />);
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ไม่ล็อกตอนที่หน้ายังถูกซ่อนอยู่ รอให้กลับมามองเห็นก่อน", async () => {
    // ล็อกตอนหน้าถูกซ่อนแปลว่า logout วิ่งอยู่เบื้องหลังทั้งที่ไม่มีใครดู
    // แล้วพอกลับมาจะเจอหน้า PIN โดยไม่รู้ว่าเกิดอะไรขึ้น
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    localStorage.setItem(KEY, นาทีที่แล้ว(20));

    render(<AutoLock />);
    await Promise.resolve();

    expect(logout).not.toHaveBeenCalled();
    // ต้องไม่กินค่าทิ้งด้วย ไม่งั้นพอกลับมาจริงจะไม่เหลืออะไรให้เทียบ
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("เลิกฟังเหตุการณ์เมื่อถูกถอดออก", () => {
    const { unmount } = render(<AutoLock />);
    unmount();

    window.dispatchEvent(new Event("pagehide"));

    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("LockReset", () => {
  it("ล้างเวลาที่ค้างอยู่ เพื่อไม่ให้หน้าถัดไปโดนเด้ง", () => {
    // จังหวะจริง — ตอนถูกล็อกออกมา pagehide จดเวลาไว้อีกครั้งก่อนเด้งมาหน้า PIN
    // ถ้าวางเครื่องคาหน้านี้เกิน 15 นาที ค่านั้นจะแก่พอที่จะเด้งซ้ำทันทีที่เข้าได้
    localStorage.setItem(KEY, นาทีที่แล้ว(20));

    render(<LockReset />);

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ไม่เรียก logout ซ้ำ หน้ากรอก PIN ออกจากระบบไปแล้ว", () => {
    localStorage.setItem(KEY, นาทีที่แล้ว(20));

    render(<LockReset />);

    expect(logout).not.toHaveBeenCalled();
  });
});
