// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";

/**
 * ปุ่มสลับธีมบนแถบหัวแอป
 *
 * มีสามสถานะจริง — ตามเครื่อง / เลือกสว่าง / เลือกเข้ม แต่ปุ่มมีปุ่มเดียว
 * กติกาคือ "กดแล้วไปทางตรงข้ามกับที่เห็นอยู่ตอนนี้" ซึ่งแปลว่าปุ่มต้องรู้ว่า
 * ตอนนี้เห็นอะไรอยู่ ทั้งกรณีที่เคยเลือกไว้แล้วและกรณีที่ยังตามเครื่อง
 */

const saveTheme = vi.fn<(theme: "light" | "dark") => Promise<void>>();

vi.mock("@/actions/theme", () => ({
  saveTheme: (theme: "light" | "dark") => saveTheme(theme),
}));

/** ปลอม matchMedia ให้ตอบว่าเครื่องตั้งเป็นมืดหรือสว่าง */
function systemIsDark(dark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: dark,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  saveTheme.mockReset();
  saveTheme.mockResolvedValue(undefined);
  delete document.documentElement.dataset.theme;
  systemIsDark(false);
});

afterEach(cleanup);

const button = () => screen.getByRole("button");

describe("ยังไม่เคยเลือกธีม — ตามเครื่อง", () => {
  it("เครื่องสว่าง ปุ่มพาไปเข้ม", () => {
    systemIsDark(false);
    render(<ThemeToggle saved={null} />);

    expect(button().getAttribute("aria-label")).toBe("เปลี่ยนเป็นพื้นเข้ม");
  });

  /**
   * ถ้าปุ่มไม่ถามเครื่อง คนที่ตั้งมือถือเป็นธีมมืดจะเห็นปุ่มบอกว่า
   * "เปลี่ยนเป็นพื้นเข้ม" ทั้งที่จอมืดอยู่แล้ว กดแล้วไม่มีอะไรเปลี่ยน
   */
  it("เครื่องมืด ปุ่มพาไปสว่าง", () => {
    systemIsDark(true);
    render(<ThemeToggle saved={null} />);

    expect(button().getAttribute("aria-label")).toBe("เปลี่ยนเป็นพื้นสว่าง");
  });
});

describe("เคยเลือกไว้แล้ว — ค่าที่เลือกทับค่าของเครื่อง", () => {
  it("เลือกสว่างไว้ทั้งที่เครื่องมืด ปุ่มยังพาไปเข้ม", () => {
    systemIsDark(true);
    render(<ThemeToggle saved="light" />);

    expect(button().getAttribute("aria-label")).toBe("เปลี่ยนเป็นพื้นเข้ม");
  });

  it("เลือกเข้มไว้ทั้งที่เครื่องสว่าง ปุ่มยังพาไปสว่าง", () => {
    systemIsDark(false);
    render(<ThemeToggle saved="dark" />);

    expect(button().getAttribute("aria-label")).toBe("เปลี่ยนเป็นพื้นสว่าง");
  });
});

describe("กดแล้วเกิดอะไรขึ้น", () => {
  /**
   * จอต้องเปลี่ยนทันทีที่กด ไม่รอเซิร์ฟเวอร์
   *
   * การเปลี่ยนสีทั้งจอที่หน่วงแม้ครึ่งวินาที รู้สึกเหมือนปุ่มไม่ติด
   * แล้วคนจะกดซ้ำจนสลับไปกลับ
   */
  it("ปั๊ม data-theme ลง html ทันที", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle saved="light" />);

    await user.click(button());

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("จำค่าที่เลือกไว้ให้การเปิดครั้งหน้า", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle saved="light" />);

    await user.click(button());

    await waitFor(() => expect(saveTheme).toHaveBeenCalledWith("dark"));
  });

  it("กดสองครั้งกลับมาที่เดิม ไม่ค้างอยู่ข้างเดียว", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle saved="light" />);

    await user.click(button());
    await user.click(button());

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(saveTheme).toHaveBeenLastCalledWith("light");
  });

  /**
   * กดครั้งแรกตอนยังตามเครื่องอยู่ ต้องไปทางตรงข้ามกับที่เครื่องให้
   * ไม่ใช่ไปทางเข้มเสมอ
   */
  it("เครื่องมืดอยู่ กดครั้งแรกได้สว่าง", async () => {
    const user = userEvent.setup();
    systemIsDark(true);
    render(<ThemeToggle saved={null} />);

    await user.click(button());

    expect(document.documentElement.dataset.theme).toBe("light");
    await waitFor(() => expect(saveTheme).toHaveBeenCalledWith("light"));
  });
});
