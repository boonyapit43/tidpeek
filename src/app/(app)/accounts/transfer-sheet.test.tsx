// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActionState } from "@/actions/shared";
import type { AccountWithBalance } from "@/db/queries";
import { TransferSheet } from "./transfer-sheet";

/**
 * ฟอร์มโอนเงิน
 *
 * ฝั่งเซิร์ฟเวอร์กันไว้ครบแล้วว่าโอนเข้าบัญชีตัวเองไม่ได้ (ทั้ง Zod และ
 * check constraint ของฐานข้อมูล) เทสชุดนี้จึงไม่ได้ทดสอบซ้ำว่ากันได้ไหม
 * แต่ทดสอบว่า **หน้าจอไม่ปล่อยให้สถานะที่ผิดเกิดขึ้นได้ตั้งแต่แรก**
 *
 * ต่างกันตรงที่อย่างแรกคือ "ผิดแล้วฟ้อง" อย่างหลังคือ "ไม่มีทางผิด"
 * ซึ่งดีกว่าสำหรับของที่ใช้ตอนยืนหน้าร้านมีลูกค้ารออยู่
 */

const createTransfer = vi.fn<(prev: ActionState, form: FormData) => Promise<ActionState>>();
const updateTransfer = vi.fn<(prev: ActionState, form: FormData) => Promise<ActionState>>();

vi.mock("@/actions/transfers", () => ({
  createTransfer: (p: ActionState, f: FormData) => createTransfer(p, f),
  updateTransfer: (p: ActionState, f: FormData) => updateTransfer(p, f),
  deleteTransfer: vi.fn(async () => ({ status: "ok" as const })),
}));

const stamp = new Date("2026-08-13T00:00:00Z");

const account = (id: string, name: string, balance: string): AccountWithBalance => ({
  id,
  shopId: "shop-1",
  name,
  kind: "bank",
  bank: null,
  accountNo: null,
  openingBalance: "0",
  sortOrder: 1,
  isActive: true,
  isDeleted: false,
  createdAt: stamp,
  updatedAt: stamp,
  balance,
});

const ACCOUNTS = [
  account("acc-scb", "SCB", "10000"),
  account("acc-kt", "กรุงไทย", "2000"),
  account("acc-cash", "เงินสด", "500"),
];

beforeEach(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };

  createTransfer.mockReset();
  updateTransfer.mockReset();
  createTransfer.mockResolvedValue({ status: "ok", message: "โอนแล้ว" });
  updateTransfer.mockResolvedValue({ status: "ok", message: "แก้ไขแล้ว" });
});

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof TransferSheet>> = {}) {
  render(
    <TransferSheet
      open
      onClose={() => undefined}
      shopId="shop-1"
      accounts={ACCOUNTS}
      {...props}
    />,
  );

  const dialog = document.querySelector("dialog") as HTMLDialogElement;

  return {
    form: dialog.querySelector("form") as HTMLFormElement,
    amount: screen.getByLabelText("จำนวนเงิน") as HTMLInputElement,
    from: screen.getByLabelText("จากบัญชี") as HTMLSelectElement,
    to: screen.getByLabelText("ไปบัญชี") as HTMLSelectElement,
    submit: within(dialog).getByRole("button", {
      name: /โอนเงิน|บันทึกการแก้ไข/,
    }) as HTMLButtonElement,
  };
}

const keysOf = (form: HTMLFormElement) => [...new FormData(form).keys()];
const valueOf = (form: HTMLFormElement, key: string) => new FormData(form).get(key);

/* ------------------------------------------------------------------ */

describe("โอนเงินใหม่", () => {
  it("เลือกสองบัญชีแรกไว้ให้ กดโอนได้เลยโดยไม่ต้องเลือกเอง", () => {
    const { from, to } = setup();

    expect(from.value).toBe("acc-scb");
    expect(to.value).toBe("acc-kt");
  });

  it("บัญชีต้นทางไม่โผล่ในตัวเลือกปลายทาง — เลือกซ้ำกันไม่ได้ตั้งแต่แรก", () => {
    const { to } = setup();

    expect([...to.options].map((o) => o.value)).not.toContain("acc-scb");
    expect([...to.options]).toHaveLength(2);
  });

  it("เปลี่ยนต้นทางไปทับปลายทาง ปลายทางเลื่อนหนีเอง", async () => {
    const user = userEvent.setup();
    const { from, to } = setup();

    // ตอนแรก SCB → กรุงไทย · เปลี่ยนต้นทางเป็นกรุงไทย
    await user.selectOptions(from, "acc-kt");

    expect(from.value).toBe("acc-kt");
    expect(to.value).not.toBe("acc-kt");
    expect([...to.options].map((o) => o.value)).not.toContain("acc-kt");
  });

  it("ตัวเลือกโชว์ยอดคงเหลือ จะได้รู้ว่าบัญชีไหนพอโอน", () => {
    const { from } = setup();
    const labels = [...from.options].map((o) => o.textContent);

    expect(labels.some((l) => l?.includes("SCB") && l.includes("10,000"))).toBe(true);
  });

  it("ไม่มีตัวเลือก — ไม่ระบุ — เพราะการโอนต้องรู้ทั้งต้นทางและปลายทาง", () => {
    const { from, to } = setup();

    expect([...from.options].map((o) => o.value)).not.toContain("");
    expect([...to.options].map((o) => o.value)).not.toContain("");
  });

  it("ส่งคีย์ครบตามที่ action ต้องการ และไม่มี note ตอนไม่ได้พิมพ์", () => {
    const { form } = setup();
    const keys = keysOf(form);

    expect(keys).toContain("shopId");
    expect(keys).toContain("fromAccountId");
    expect(keys).toContain("toAccountId");
    expect(keys).toContain("txnDate");
    expect(keys).toContain("amount");
    // ช่องหมายเหตุอยู่ในหน้าเสมอสำหรับการโอน จึงมีคีย์แต่เป็นค่าว่าง
    expect(valueOf(form, "note")).toBe("");
    // ไม่มี id เพราะเป็นการสร้างใหม่
    expect(keys).not.toContain("id");
  });

  it("ยังไม่ใส่จำนวนเงิน กดโอนไม่ได้", async () => {
    const user = userEvent.setup();
    const { amount, submit } = setup();

    expect(submit.disabled).toBe(true);

    await user.type(amount, "3000");
    expect(submit.disabled).toBe(false);
  });

  it("ส่งค่าที่เลือกไปให้ action ตรงตามหน้าจอ", async () => {
    const user = userEvent.setup();
    const { amount, from, to, submit } = setup();

    await user.type(amount, "3000");
    await user.selectOptions(to, "acc-cash");
    await user.click(submit);

    await waitFor(() => expect(createTransfer).toHaveBeenCalled());

    const sent = createTransfer.mock.calls[0][1];
    expect(sent.get("amount")).toBe("3000");
    expect(sent.get("fromAccountId")).toBe(from.value);
    expect(sent.get("toAccountId")).toBe("acc-cash");
  });

  /**
   * กดโอนจากหน้าของบัญชีใดบัญชีหนึ่ง
   *
   * คนกดตั้งใจจะโอน "ออกจากบัญชีนี้" อยู่แล้ว ไม่ควรต้องเลือกซ้ำว่าเงินออกจากไหน
   * เทสข้อนี้กันไม่ให้ปุ่มนั้นหลุดกลับไปเป็นฟอร์มเปล่าที่เลือกบัญชีแรกให้เสมอ
   */
  it("เปิดจากหน้าบัญชีไหน ต้นทางต้องเป็นบัญชีนั้น", () => {
    const { from, to } = setup({ defaultFromId: "acc-cash" });

    expect(from.value).toBe("acc-cash");
    expect(to.value).not.toBe("acc-cash");
  });

  it("ส่ง defaultFromId ที่ไม่มีในรายการมา ให้ตกกลับไปบัญชีแรก", () => {
    const { from } = setup({ defaultFromId: "acc-ที่ถูกลบไปแล้ว" });

    expect(from.value).toBe("acc-scb");
  });

  it("มีบัญชีเดียว โอนไม่ได้ และบอกว่าต้องทำอะไรต่อ", () => {
    render(
      <TransferSheet
        open
        onClose={() => undefined}
        shopId="shop-1"
        accounts={[ACCOUNTS[0]]}
      />,
    );

    expect(screen.getByText(/ต้องมีอย่างน้อยสองบัญชี/)).toBeTruthy();
    expect(screen.queryByLabelText("จำนวนเงิน")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("แก้ไขการโอนเดิม", () => {
  const EXISTING = {
    id: "tr-1",
    fromAccountId: "acc-kt",
    toAccountId: "acc-cash",
    txnDate: "2026-08-01",
    amount: "1250.50",
    note: "สำรองจ่ายค่าของ",
  };

  it("ใส่ค่าเดิมไว้ให้ครบ", () => {
    const { amount, from, to } = setup({ editing: EXISTING });

    expect(amount.value).toBe("1250.50");
    expect(from.value).toBe("acc-kt");
    expect(to.value).toBe("acc-cash");
    expect((screen.getByLabelText(/โอนไปทำไม/) as HTMLInputElement).value).toBe(
      "สำรองจ่ายค่าของ",
    );
  });

  it("ส่ง id ไปด้วย และเรียก action ตัวแก้ไข ไม่ใช่ตัวสร้าง", async () => {
    const user = userEvent.setup();
    const { form, submit } = setup({ editing: EXISTING });

    expect(valueOf(form, "id")).toBe("tr-1");

    await user.click(submit);

    await waitFor(() => expect(updateTransfer).toHaveBeenCalled());
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("มีปุ่มลบ ซึ่งโหมดสร้างใหม่ไม่มี", () => {
    setup({ editing: EXISTING });
    expect(screen.getByRole("button", { name: "ลบการโอนนี้" })).toBeTruthy();

    cleanup();

    setup();
    expect(screen.queryByRole("button", { name: "ลบการโอนนี้" })).toBeNull();
  });

  it("ต้องกดสองครั้งถึงจะลบจริง", async () => {
    const user = userEvent.setup();
    setup({ editing: EXISTING });

    await user.click(screen.getByRole("button", { name: "ลบการโอนนี้" }));

    expect(screen.getByRole("button", { name: "ยืนยันลบถาวร" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeTruthy();
  });
});
