// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CategoryTotal } from "@/db/queries";
import { CategoryBreakdown } from "./category-breakdown";

/**
 * การ์ดแยกประเภท — จุดที่คนกดเจาะเข้าไปดูว่ายอดแต่ละก้อนคืออะไรบ้าง
 * ลิงก์ผิดช่วงหรือผิดประเภท = เจาะเข้าไปเจอตัวเลขคนละก้อนกับที่กดมา
 */

afterEach(cleanup);

const row = (
  categoryId: string | null,
  name: string,
  direction: "in" | "out",
  total: string,
  txnCount: number,
): CategoryTotal => ({ categoryId, name, direction, counts: true, total, txnCount });

const TOTALS = [
  row("cat-wage", "ค่าแรง", "out", "1890.00", 3),
  row(null, "ไม่ระบุประเภท", "out", "110.00", 1),
  row("cat-sale", "ขายหน้าร้าน", "in", "5465.00", 2),
];

describe("CategoryBreakdown", () => {
  it("แต่ละแถวเป็นลิงก์เจาะดู ที่พกช่วงเวลาเดิมไปด้วย", () => {
    render(<CategoryBreakdown totals={TOTALS} detailQs="p=month&m=2026-08" />);

    const wage = screen.getByRole("link", { name: /ค่าแรง/ });
    expect(wage.getAttribute("href")).toBe("/summary?p=month&m=2026-08&c=cat-wage&cd=out");
  });

  it("กลุ่มไม่ระบุประเภทใช้รหัส none ไม่ใช่ค่าว่างที่หายไปจาก URL", () => {
    render(<CategoryBreakdown totals={TOTALS} detailQs="p=day&d=2026-08-29" />);

    const none = screen.getByRole("link", { name: /ไม่ระบุประเภท/ });
    expect(none.getAttribute("href")).toBe("/summary?p=day&d=2026-08-29&c=none&cd=out");
  });

  /**
   * คำตอบแรกของ "ค่าแรง 1,890 คืออะไรบ้าง" อยู่ตรงนี้เลย —
   * เห็นจำนวนรายการกับสัดส่วนตั้งแต่ยังไม่ต้องกดเข้าไป
   */
  it("บอกจำนวนรายการและสัดส่วนของฝั่งไว้ใต้แถบ", () => {
    render(<CategoryBreakdown totals={TOTALS} detailQs="p=month&m=2026-08" />);

    // ค่าแรง 1890 จาก 2000 ของฝั่งจ่าย = 95% (ปัดเต็มหน่วย)
    expect(screen.getByText("3 รายการ · 95% ของฝั่งนี้")).toBeTruthy();
    expect(screen.getByText("1 รายการ · 6% ของฝั่งนี้")).toBeTruthy();
    // ฝั่งรับมีก้อนเดียว = 100%
    expect(screen.getByText("2 รายการ · 100% ของฝั่งนี้")).toBeTruthy();
  });
});
