// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TrendChart, pointTitle, type TrendPoint } from "./trend-chart";

/**
 * กราฟกำไร — เทสสิ่งที่คณิตใน chart.test.ts มองไม่เห็น
 * คือ "สิ่งที่ถูกวาดลง DOM จริง" ทั้งตำแหน่งแท่ง สี ป้าย และลิงก์
 */

afterEach(cleanup);

const point = (key: string, profit: string, label = key): TrendPoint => ({
  key,
  label,
  title: pointTitle(label, profit),
  profit,
  href: `/summary?p=day&d=${key}`,
});

const barsOf = (container: HTMLElement) =>
  [...container.querySelectorAll("span[aria-hidden]")].filter(
    (el) => el.className.includes("bg-income") || el.className.includes("bg-expense"),
  ) as HTMLElement[];

describe("TrendChart", () => {
  it("แท่งกำไรอยู่เหนือเส้นศูนย์ แท่งขาดทุนห้อยลงใต้เส้น", () => {
    const { container } = render(
      <TrendChart
        heading="กำไรรายวัน"
        points={[point("2026-08-01", "300"), point("2026-08-02", "-100")]}
      />,
    );

    const [gain, loss] = barsOf(container);

    // บวกสุด 300 ลบสุด 100 → เส้นศูนย์ที่ 75%
    expect(gain.style.top).toBe("0%");
    expect(gain.style.height).toBe("75%");
    expect(gain.className).toContain("bg-income");

    expect(loss.style.top).toBe("75%");
    expect(loss.style.height).toBe("25%");
    expect(loss.className).toContain("bg-expense");
  });

  it("แต่ละแท่งเป็นลิงก์ไปหน้าของช่วงนั้น พร้อมคำอธิบายที่อ่านได้", () => {
    render(<TrendChart heading="กำไรรายวัน" points={[point("2026-08-01", "1250", "1 ส.ค.")]} />);

    const link = screen.getByRole("link", { name: "1 ส.ค. กำไร 1,250" });
    expect(link.getAttribute("href")).toBe("/summary?p=day&d=2026-08-01");
  });

  it("วันที่ไม่มีรายการ ช่องยังอยู่แต่ไม่มีแท่ง แกนเวลาจึงไม่บิด", () => {
    const { container } = render(
      <TrendChart
        heading="กำไรรายวัน"
        points={[point("2026-08-01", "100"), point("2026-08-02", "0"), point("2026-08-03", "50")]}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(barsOf(container)).toHaveLength(2);
  });

  it("ทั้งช่วงยังไม่มีเงินเดินเลย ไม่ต้องโชว์กราฟว่างให้สงสัยว่าพัง", () => {
    const { container } = render(
      <TrendChart heading="กำไรรายวัน" points={[point("2026-08-01", "0")]} />,
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("คำอธิบายของแท่ง", () => {
  it("บอกกำไร ขาดทุน หรือไม่มีรายการ เป็นคำ ไม่ใช่แค่เครื่องหมายลบ", () => {
    expect(pointTitle("1 ส.ค.", "1250")).toBe("1 ส.ค. กำไร 1,250");
    expect(pointTitle("2 ส.ค.", "-40.50")).toBe("2 ส.ค. ขาดทุน 40.50");
    expect(pointTitle("3 ส.ค.", "0")).toBe("3 ส.ค. ไม่มีรายการ");
  });
});
