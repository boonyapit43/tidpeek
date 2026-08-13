// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountWithBalance, TxnRow } from "@/db/queries";
import type { Category } from "@/db/schema";
import { TxnList } from "./txn-list";

/**
 * รายการของวัน
 *
 * เทสสำคัญของไฟล์นี้คือ ?t= — หน้าเคลื่อนไหวของบัญชีลิงก์มาที่หน้ารายวัน
 * พร้อม id ของรายการ เพราะคนแตะที่นั่นเพราะอยากแก้รายการนั้น
 * ถ้าพามาถึงแล้วปล่อยให้ไล่หาเองในลิสต์ทั้งวัน ก็เท่ากับไม่ได้พามา
 */

vi.mock("@/actions/transactions", () => ({
  updateTransaction: vi.fn(async () => ({ status: "ok" as const })),
  deleteTransaction: vi.fn(async () => ({ status: "ok" as const })),
}));

const stamp = new Date("2026-08-12T03:00:00Z");

const txn = (id: string, title: string): TxnRow => ({
  id,
  shopId: "shop-1",
  txnDate: "2026-08-12",
  direction: "in",
  categoryId: "cat-1",
  accountId: "acc-1",
  title,
  amount: "1500.00",
  note: null,
  createdAt: stamp,
  categoryName: "ขายหน้าร้าน",
  accountName: "SCB",
  counts: true,
});

const ITEMS = [txn("t1", "ยอดขายเช้า"), txn("t2", "ยอดขายบ่าย")];

const ACCOUNTS: AccountWithBalance[] = [
  {
    id: "acc-1",
    shopId: "shop-1",
    name: "SCB",
    kind: "bank",
    bank: null,
    accountNo: null,
    openingBalance: "0",
    sortOrder: 1,
    isActive: true,
    isDeleted: false,
    createdAt: stamp,
    updatedAt: stamp,
    balance: "1500",
  },
];

const CATEGORIES: Category[] = [
  {
    id: "cat-1",
    shopId: null,
    direction: "in",
    name: "ขายหน้าร้าน",
    counts: true,
    sortOrder: 1,
    isActive: true,
    isDeleted: false,
    createdAt: stamp,
    updatedAt: stamp,
  },
];

beforeEach(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(cleanup);

const setup = (openTxnId?: string) =>
  render(
    <TxnList
      items={ITEMS}
      shopId="shop-1"
      accounts={ACCOUNTS}
      categories={CATEGORIES}
      openTxnId={openTxnId}
    />,
  );

const amountField = () => screen.queryByLabelText("จำนวนเงิน") as HTMLInputElement | null;

describe("เปิดรายการที่ระบุมาจาก URL", () => {
  it("ไม่ส่ง id มา ก็ไม่เปิดอะไร", () => {
    setup();
    expect(amountField()).toBeNull();
  });

  it("ส่ง id มา เปิดหน้าแก้ไขของรายการนั้นให้เลย", () => {
    setup("t2");

    expect(amountField()).not.toBeNull();
    expect((screen.getByLabelText("รายการ") as HTMLInputElement).value).toBe("ยอดขายบ่าย");
  });

  it("id ที่ไม่มีในวันนี้ (วันผิด หรือถูกลบไปแล้ว) ต้องไม่พัง แค่ไม่เปิด", () => {
    setup("ไม่มีรายการนี้");

    expect(amountField()).toBeNull();
    expect(screen.getByText("ยอดขายเช้า")).toBeTruthy();
  });

  /**
   * ปิดแล้วต้องปิดลง
   *
   * ถ้าผูกสถานะไว้กับ openTxnId ตลอดเวลา พอกดปิดมันจะเด้งกลับมาเปิดใหม่ทันที
   * เพราะ URL ยังมี ?t= อยู่เหมือนเดิม ปิดไม่ลงจนกว่าจะเปลี่ยนหน้า
   */
  it("กดปิดแล้วต้องปิดลง ไม่เด้งกลับมาเปิดใหม่", async () => {
    const user = userEvent.setup();
    setup("t1");

    expect(amountField()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ปิด" }));

    expect(amountField()).toBeNull();
  });
});

describe("แตะรายการในลิสต์", () => {
  it("เปิดหน้าแก้ไขของรายการที่แตะ", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("ยอดขายเช้า"));

    expect((screen.getByLabelText("รายการ") as HTMLInputElement).value).toBe("ยอดขายเช้า");
  });
});
