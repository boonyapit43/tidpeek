// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateField } from "./date-field";

/**
 * ช่องวันที่ — ป้ายที่คนอ่านกับค่าที่ส่งออกไปเป็นคนละรูปแบบกันโดยตั้งใจ
 *
 * ป้ายเป็นไทย พ.ศ. ส่วนค่าที่ส่งต้องเป็น "YYYY-MM-DD" ที่ฝั่งเซิร์ฟเวอร์ตรวจ
 * ถ้าวันหนึ่งใครเผลอเอาป้ายไปเป็นค่าที่ส่ง ฟอร์มจะพังทั้งแอปแบบเงียบๆ
 */

const showPicker = vi.fn();
let coarsePointer = false;

beforeEach(() => {
  showPicker.mockReset();
  coarsePointer = false;

  // jsdom ไม่มีสองอย่างนี้ ต้องปลอมเอง
  (window.HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker =
    showPicker;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("coarse") ? coarsePointer : !coarsePointer,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

const setup = (value = "2026-08-29", onChange = vi.fn()) => {
  render(<DateField value={value} onChange={onChange} label="วันที่" name="d" />);
  return {
    input: screen.getByLabelText("วันที่") as HTMLInputElement,
    onChange,
  };
};

describe("ช่องวันที่", () => {
  it("ป้ายที่คนเห็นเป็นวันไทย พ.ศ. ไม่ใช่รูปแบบของเครื่อง", () => {
    setup();
    expect(screen.getByText("29 ส.ค. 69")).toBeTruthy();
  });

  it("ค่าที่ส่งออกไปยังเป็น YYYY-MM-DD ตามที่เซิร์ฟเวอร์ตรวจ", () => {
    const { input } = setup();

    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-08-29");
    expect(input.name).toBe("d");
  });

  /**
   * เบราว์เซอร์ส่ง "" มาเมื่อคนกดล้างค่าในปฏิทิน ปล่อยผ่านแล้วฟอร์มจะส่ง
   * วันว่างไปให้เซิร์ฟเวอร์ปฏิเสธ ทั้งที่คนแค่กดผิดปุ่มเดียว
   */
  it("กดล้างค่าในปฏิทินแล้ววันเดิมยังอยู่ ไม่กลายเป็นค่าว่าง", () => {
    const { input, onChange } = setup();

    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("เลือกวันใหม่แล้วส่งค่าต่อให้ฟอร์ม", () => {
    const { input, onChange } = setup();

    fireEvent.change(input, { target: { value: "2026-09-01" } });

    expect(onChange).toHaveBeenCalledWith("2026-09-01");
  });
});

describe("การเปิดปฏิทิน", () => {
  it("จอที่ใช้เมาส์ — คลิกแล้วสั่งเปิดปฏิทินให้ เพราะไม่เปิดเอง", async () => {
    const user = userEvent.setup();
    const { input } = setup();

    await user.click(input);

    expect(showPicker).toHaveBeenCalled();
  });

  /**
   * มือถือแตะแล้วปฏิทินของเครื่องเด้งเองอยู่แล้ว สั่งซ้ำคือไปยุ่งกับ UI
   * ของระบบระหว่างทำงาน ไม่ได้อะไรเพิ่มแต่มีโอกาสค้าง — และมือถือคือเครื่อง
   * ที่แอปนี้ถูกใช้จริงเกือบทั้งหมด
   */
  it("มือถือ — ไม่สั่งซ้ำ ปล่อยให้ปฏิทินของเครื่องทำงานเอง", async () => {
    coarsePointer = true;
    const user = userEvent.setup();
    const { input } = setup();

    await user.click(input);

    expect(showPicker).not.toHaveBeenCalled();
  });
});
