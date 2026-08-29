// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CategoryEntry, CategoryTotal } from "@/db/queries";

/**
 * หน้าเจาะดูรายการข้างในประเภทหนึ่ง
 *
 * เทสชุดนี้คุมกฎข้อเดียวที่สำคัญที่สุดของหน้านี้ — **ตัวเลขบนหัวต้องเป็น
 * ความจริงทั้งหมด ไม่ใช่จำนวนที่โหลดมาแสดง**
 *
 * ก่อนมีการแบ่งหน้า สองอย่างนี้เท่ากันเสมอ โค้ดจึงใช้ entries.length ได้
 * พอใส่เพดานแล้วมันแยกกันทันที และตัวที่ผิดคือตัวที่คนอ่านแล้วเชื่อ —
 * "ปี 2569 · 50 รายการ" ทั้งที่จริงมี 365 คือการรายงานตัวเลขผิด
 * ไม่ใช่แค่ UI ไม่สวย
 *
 * ตรวจด้วย type ไม่ได้ เพราะทั้งสองทางเป็น number เหมือนกัน
 */

const listCategoryEntries = vi.fn<() => Promise<CategoryEntry[]>>();
const listCategoryTotals = vi.fn<() => Promise<CategoryTotal[]>>();

vi.mock("@/db/queries", () => ({
  listCategoryEntries: () => listCategoryEntries(),
  listCategoryTotals: () => listCategoryTotals(),
}));

const { CategoryDetail } = await import("./category-detail");

afterEach(cleanup);

const entry = (id: string, amount: string): CategoryEntry => ({
  id,
  txnDate: "2026-08-15",
  title: "ค่าแรงน้อง",
  amount,
  note: null,
  accountName: "เงินสด",
});

const group = (txnCount: number): CategoryTotal => ({
  categoryId: "cat-wage",
  name: "ค่าแรง",
  direction: "out",
  counts: true,
  total: "18900",
  txnCount,
});

async function show({ loaded, real }: { loaded: number; real: number }) {
  listCategoryEntries.mockResolvedValue(
    Array.from({ length: loaded }, (_, i) => entry(`e${i}`, "1890")),
  );
  listCategoryTotals.mockResolvedValue([group(real)]);

  render(
    await CategoryDetail({
      shopId: "shop-1",
      categoryId: "cat-wage",
      direction: "out",
      period: { year: "2026" },
      periodLabel: "ปี 2569",
      backHref: "/summary?p=year&y=2026",
      shown: loaded,
      moreHref: "?n=100",
    }),
  );
}

describe("จำนวนที่โชว์บนหัว", () => {
  it("โหลดมาไม่ครบ หัวยังบอกจำนวนจริงทั้งหมด", async () => {
    await show({ loaded: 50, real: 365 });

    // เจาะจงที่บรรทัดใต้ชื่อประเภท ไม่ใช่บรรทัดนับท้ายลิสต์
    expect(screen.getByText(/จ่ายออก · ปี 2569 · 365 รายการ/)).toBeTruthy();

    // และต้องไม่มีที่ไหนบอกว่าประเภทนี้มี 50 รายการ ซึ่งเป็นตัวเลขที่โหลดมา
    expect(screen.queryByText(/ปี 2569 · 50 รายการ/)).toBeNull();
  });

  it("โหลดครบแล้ว หัวก็ยังตรงกับความจริงเหมือนเดิม", async () => {
    await show({ loaded: 12, real: 12 });

    expect(screen.getByText(/12 รายการ/)).toBeTruthy();
  });

  /**
   * ท้ายลิสต์ต้องเห็นว่ายังมีอีก ไม่ใช่หยุดเฉยๆ
   * เป็นคู่หูของบรรทัดบน — บอกจำนวนจริงแล้วต้องมีทางไปดูให้ครบด้วย
   */
  it("ยังมีอีก มีทางกดดูต่อ พร้อมบอกว่าเห็นอยู่เท่าไหร่", async () => {
    await show({ loaded: 50, real: 365 });

    expect(screen.getByText(/แสดง 50 จาก 365 รายการ/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /ดูเพิ่มอีก/ })).toBeTruthy();
  });
});
