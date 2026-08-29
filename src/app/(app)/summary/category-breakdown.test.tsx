// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryTotal, PeriodEntry } from "@/db/queries";
import { CategoryBreakdown } from "./category-breakdown";

/**
 * การ์ดแยกประเภท — จุดที่คนกดกางดูว่ายอดแต่ละก้อนคืออะไรบ้าง
 *
 * กางในที่ ไม่เปลี่ยนหน้า (คนใช้ขอเอง) รายการมาพร้อมหน้าแล้ว กดปุ๊บกางปั๊บ
 * แม้เน็ตหลุด สิ่งที่ต้องไม่พังคือ: กางแล้วต้องเป็นรายการของประเภทนั้นจริง
 * และประเภทที่รายการเกินโควตาต้องบอกว่าเห็นไม่ครบ ไม่ใช่เงียบแล้วให้เชื่อ
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

const entry = (
  id: string,
  categoryId: string | null,
  direction: "in" | "out",
  title: string,
  amount: string,
): PeriodEntry => ({
  id,
  txnDate: "2026-08-28",
  title,
  amount,
  note: null,
  accountName: "เงินสด",
  categoryId,
  direction,
});

const ENTRIES = [
  entry("t1", "cat-wage", "out", "ค่าแรงกอล์ฟ", "640.00"),
  entry("t2", "cat-wage", "out", "ค่าแรงบอย", "650.00"),
  entry("t3", "cat-wage", "out", "ค่าแรงกอล์ฟ", "600.00"),
  entry("t4", null, "out", "ของเบ็ดเตล็ด", "110.00"),
  entry("t5", "cat-sale", "in", "ขายหน้าร้าน", "5465.00"),
];

const setup = (props: Partial<React.ComponentProps<typeof CategoryBreakdown>> = {}) =>
  render(
    <CategoryBreakdown
      totals={TOTALS}
      entries={ENTRIES}
      detailQs="/summary?p=month&m=2026-08"
      {...props}
    />,
  );

describe("CategoryBreakdown", () => {
  it("เปิดมายังไม่กาง — เห็นแต่ยอดรวม ไม่มีรายการย่อยมาเกะกะ", () => {
    setup();

    expect(screen.queryByText("ค่าแรงบอย")).toBeNull();
    expect(screen.getByRole("button", { name: /ค่าแรง/ }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("กดแล้วกางรายการของประเภทนั้น โดยไม่เปลี่ยนหน้า", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ค่าแรง/ }));

    expect(screen.getByText("ค่าแรงบอย")).toBeTruthy();
    expect(screen.getAllByText("ค่าแรงกอล์ฟ")).toHaveLength(2);
    // ของประเภทอื่นต้องไม่หลุดมาปนในกลุ่มที่กาง
    expect(screen.queryByText("ของเบ็ดเตล็ด")).toBeNull();
  });

  it("กางได้ทีละหลายอันพร้อมกัน ไม่ใช่เปิดใหม่แล้วอันเก่าหุบ", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ค่าแรง/ }));
    await user.click(screen.getByRole("button", { name: /ไม่ระบุประเภท/ }));

    expect(screen.getByText("ค่าแรงบอย")).toBeTruthy();
    expect(screen.getByText("ของเบ็ดเตล็ด")).toBeTruthy();
  });

  it("กดซ้ำแล้วหุบกลับ", async () => {
    const user = userEvent.setup();
    setup();

    const wage = screen.getByRole("button", { name: /ค่าแรง/ });
    await user.click(wage);
    await user.click(wage);

    expect(screen.queryByText("ค่าแรงบอย")).toBeNull();
  });

  it("รายการที่กางแล้ว แตะต่อไปเปิดแผ่นแก้ไขของรายการนั้นได้", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ค่าแรง/ }));

    const link = screen.getByRole("link", { name: /ค่าแรงบอย/ });
    expect(link.getAttribute("href")).toBe("/day?d=2026-08-28&t=t2");
  });

  /**
   * ประเภทที่รายการเยอะเกินโควตาที่แนบมากับหน้า ต้องบอกว่าเห็นไม่ครบ
   * ไม่ใช่โชว์ไปเงียบๆ ให้คนนับแล้วสงสัยว่าทำไมไม่ตรงกับยอดรวม
   */
  it("รายการเกินที่แนบมา บอกว่ามีทั้งหมดกี่รายการ พร้อมทางไปดูเต็ม", async () => {
    const user = userEvent.setup();
    setup({ totals: [row("cat-wage", "ค่าแรง", "out", "1890.00", 42)] });

    await user.click(screen.getByRole("button", { name: /ค่าแรง/ }));

    const more = screen.getByRole("link", { name: /ดูทั้งหมด 42 รายการ/ });
    expect(more.getAttribute("href")).toBe(
      "/summary?p=month&m=2026-08&c=cat-wage&cd=out",
    );
  });

  it("รายการครบตามยอดแล้ว ไม่ต้องมีลิงก์ดูทั้งหมดมากวน", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ค่าแรง/ }));

    expect(screen.queryByRole("link", { name: /ดูทั้งหมด/ })).toBeNull();
  });

  /**
   * คำตอบแรกของ "ค่าแรง 1,890 คืออะไรบ้าง" อยู่ตรงนี้เลย —
   * เห็นจำนวนรายการกับสัดส่วนตั้งแต่ยังไม่ต้องกดเข้าไป
   */
  it("บอกจำนวนรายการและสัดส่วนของฝั่งไว้ใต้แถบ", () => {
    setup();

    // ค่าแรง 1890 จาก 2000 ของฝั่งจ่าย = 95% (ปัดเต็มหน่วย)
    expect(screen.getByText("3 รายการ · 95% ของฝั่งนี้")).toBeTruthy();
    expect(screen.getByText("1 รายการ · 6% ของฝั่งนี้")).toBeTruthy();
    // ฝั่งรับมีก้อนเดียว = 100%
    expect(screen.getByText("2 รายการ · 100% ของฝั่งนี้")).toBeTruthy();
  });
});
