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
  /**
   * ไม่เดาบัญชีให้ — คนใช้ขอเองว่าต้องขึ้น "เลือกก่อน" ไม่ใช่ default
   * ค่าแรกสุด การย้ายเงินที่ต้นทางถูกเดาผิดคือยอดสองบัญชีเพี้ยนพร้อมกัน
   */
  it("เปิดมาทั้งสองช่องขึ้นเลือกบัญชีก่อน ไม่เดาให้", () => {
    const { from, to } = setup();

    expect(from.value).toBe("");
    expect(to.value).toBe("");
    expect(from.options[from.selectedIndex].textContent).toContain("เลือกบัญชีต้นทาง");
    expect(to.options[to.selectedIndex].textContent).toContain("เลือกบัญชีปลายทาง");
  });

  it("บัญชีต้นทางไม่โผล่ในตัวเลือกปลายทาง — เลือกซ้ำกันไม่ได้ตั้งแต่แรก", async () => {
    const user = userEvent.setup();
    const { from, to } = setup();

    await user.selectOptions(from, "acc-scb");

    expect([...to.options].map((o) => o.value)).not.toContain("acc-scb");
    // สองบัญชีที่เหลือ + ตัวบอกให้เลือก
    expect([...to.options]).toHaveLength(3);
  });

  it("เปลี่ยนต้นทางไปทับปลายทางที่เลือกไว้ ปลายทางถอยกลับไปถามใหม่ ไม่เดาแทน", async () => {
    const user = userEvent.setup();
    const { from, to } = setup();

    await user.selectOptions(from, "acc-scb");
    await user.selectOptions(to, "acc-kt");
    // เปลี่ยนต้นทางเป็นบัญชีเดียวกับปลายทางที่เลือกไว้
    await user.selectOptions(from, "acc-kt");

    expect(from.value).toBe("acc-kt");
    expect(to.value).toBe("");
    expect([...to.options].map((o) => o.value)).not.toContain("acc-kt");
  });

  it("ตัวเลือกโชว์ยอดคงเหลือ จะได้รู้ว่าบัญชีไหนพอโอน", () => {
    const { from } = setup();
    const labels = [...from.options].map((o) => o.textContent);

    expect(labels.some((l) => l?.includes("SCB") && l.includes("10,000"))).toBe(true);
  });

  /**
   * หัวตารางเลือกได้ ไม่ได้ปิดไว้ — จำเป็นเพราะ React 19 รีเซ็ตฟอร์มเอง
   * หลัง action แล้วดันช่องไปที่ตัวเลือกแรกที่เลือกได้ ถ้าปิดหัวตารางไว้
   * มันจะข้ามไปลงบัญชีจริงตัวแรก (ดูคำอธิบายในไฟล์คอมโพเนนต์)
   *
   * ด่านกันการโอนโดยไม่เลือกบัญชีอยู่ที่ปุ่มที่กดไม่ได้ ไม่ใช่ที่การปิดตัวเลือก
   */
  it("มีหัวตารางค่าว่างอันเดียวต่อช่อง และไม่มีตัวเลือกที่แปลว่าไม่ระบุ", () => {
    const { from, to } = setup();

    for (const select of [from, to]) {
      const empties = [...select.options].filter((o) => o.value === "");
      expect(empties).toHaveLength(1);
      expect(empties[0].textContent).toContain("เลือกบัญชี");
      expect([...select.options].some((o) => o.textContent?.includes("ไม่ระบุ"))).toBe(false);
    }
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

  it("กดโอนไม่ได้จนกว่าจะครบ จำนวน ต้นทาง และปลายทาง", async () => {
    const user = userEvent.setup();
    const { amount, from, to, submit } = setup();

    await user.type(amount, "3000");
    expect(submit.disabled).toBe(true);

    await user.selectOptions(from, "acc-scb");
    expect(submit.disabled).toBe(true);

    await user.selectOptions(to, "acc-kt");
    expect(submit.disabled).toBe(false);
  });

  it("ส่งค่าที่เลือกไปให้ action ตรงตามหน้าจอ", async () => {
    const user = userEvent.setup();
    const { amount, from, to, submit } = setup();

    await user.type(amount, "3000");
    await user.selectOptions(from, "acc-scb");
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
  it("เปิดจากหน้าบัญชีไหน ต้นทางต้องเป็นบัญชีนั้น ส่วนปลายทางยังต้องเลือกเอง", () => {
    // อันนี้ไม่ใช่การเดา — คนกดตั้งใจโอนออกจากบัญชีนี้อยู่แล้ว
    const { from, to } = setup({ defaultFromId: "acc-cash" });

    expect(from.value).toBe("acc-cash");
    expect(to.value).toBe("");
  });

  it("ส่ง defaultFromId ที่ไม่มีในรายการมา กลับไปถามใหม่ ไม่เดาบัญชีแรกแทน", () => {
    const { from } = setup({ defaultFromId: "acc-ที่ถูกลบไปแล้ว" });

    expect(from.value).toBe("");
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

/* ------------------------------------------------------------------ */

/**
 * บันทึกไม่สำเร็จแล้วแผ่นยังเปิดอยู่ — สิ่งที่เลือกไว้ต้องไม่ขยับเอง
 *
 * React 19 สั่งรีเซ็ตฟอร์มให้เองหลัง action ทำงานจบ ไม่ว่าจะสำเร็จหรือพลาด
 * ซึ่งดันช่องเลือกกลับไปที่ตัวเลือกแรกที่เลือกได้ ถ้าหัวตารางถูก disabled ไว้
 * มันจะข้ามไปลงที่บัญชีจริงตัวแรกแล้วยิงออกมาเป็นการเลือกจริง
 * ผลคือกดบันทึกพลาดหนึ่งครั้ง ปลายทางเปลี่ยนเองโดยไม่มีใครแตะ
 */
describe("บันทึกไม่สำเร็จ", () => {
  it("บัญชีที่เลือกไว้ต้องอยู่ที่เดิม ไม่เด้งไปตัวแรกเอง", async () => {
    createTransfer.mockResolvedValue({ status: "error", message: "เน็ตหลุด" });

    const user = userEvent.setup();
    const { amount, from, to, submit } = setup();

    await user.type(amount, "3000");
    await user.selectOptions(from, "acc-cash");
    await user.selectOptions(to, "acc-kt");
    await user.click(submit);

    await waitFor(() => expect(createTransfer).toHaveBeenCalled());

    expect(from.value).toBe("acc-cash");
    expect(to.value).toBe("acc-kt");
  });
});

/* ------------------------------------------------------------------ */

/**
 * ปุ่ม "ทั้งหมด" — ท่าที่ร้านทำจริงคือปิดร้านแล้วฝากเงินสดทั้งกระเป๋าเข้าธนาคาร
 *
 * เดิมต้องเลื่อนไปอ่านยอดในตัวเลือกแล้วพิมพ์ตามทีละหลัก พิมพ์พลาดหลักเดียว
 * ยอดสองบัญชีเพี้ยนพร้อมกัน และเป็นความผิดที่หายากเพราะตัวเลขดูสมเหตุสมผล
 */
describe("โอนทั้งจำนวน", () => {
  it("ยังไม่ได้เลือกต้นทาง ยังไม่มีปุ่มให้กด", () => {
    setup();
    expect(screen.queryByRole("button", { name: /ทั้งหมด/ })).toBeNull();
  });

  it("เลือกต้นทางแล้วปุ่มโผล่ พร้อมบอกยอดที่จะเติมให้", async () => {
    const user = userEvent.setup();
    const { from } = setup();

    await user.selectOptions(from, "acc-scb");

    // SCB มียอด 10,000 ตามชุดข้อมูลของไฟล์นี้
    expect(screen.getByRole("button", { name: /ทั้งหมด/ }).textContent).toContain("10,000");
  });

  it("กดแล้วเติมยอดเต็มลงช่องจำนวนเงิน", async () => {
    const user = userEvent.setup();
    const { from, amount } = setup();

    await user.selectOptions(from, "acc-kt");
    await user.click(screen.getByRole("button", { name: /ทั้งหมด/ }));

    // ส่งค่าดิบจากฐานข้อมูล ไม่ใช่ข้อความที่จัดรูปแบบแล้ว
    // เพราะฝั่งเซิร์ฟเวอร์รับเฉพาะตัวเลขล้วน คอมมาทำให้ถูกปฏิเสธ
    expect((amount as HTMLInputElement).value).toBe("2000");
  });

  it("เปลี่ยนต้นทางแล้วยอดในปุ่มเปลี่ยนตาม", async () => {
    const user = userEvent.setup();
    const { from } = setup();

    await user.selectOptions(from, "acc-scb");
    expect(screen.getByRole("button", { name: /ทั้งหมด/ }).textContent).toContain("10,000");

    await user.selectOptions(from, "acc-cash");
    expect(screen.getByRole("button", { name: /ทั้งหมด/ }).textContent).toContain("500");
  });

  /**
   * บัญชีที่ไม่มีเงินเหลือ ปุ่มต้องไม่โผล่
   *
   * ปุ่มที่เติมศูนย์ให้ไม่ได้ช่วยอะไร แถมกดแล้วปุ่มโอนก็ยังกดไม่ได้อยู่ดี
   * (จำนวนเงินต้องมากกว่าศูนย์) กลายเป็นทางตันที่ดูเหมือนใช้ได้
   */
  it("บัญชีที่ยอดเป็นศูนย์ ไม่มีปุ่มให้กด", async () => {
    const user = userEvent.setup();
    render(
      <TransferSheet
        open
        onClose={() => undefined}
        shopId="shop-1"
        accounts={[
          account("acc-empty", "กระปุกเปล่า", "0"),
          account("acc-scb", "SCB", "10000"),
        ]}
      />,
    );

    const from = screen.getByLabelText("จากบัญชี") as HTMLSelectElement;
    await user.selectOptions(from, "acc-empty");

    expect(screen.queryByRole("button", { name: /ทั้งหมด/ })).toBeNull();
  });

  it("แก้การโอนเดิมก็ใช้ปุ่มได้ ไม่ใช่มีแต่ตอนสร้างใหม่", async () => {
    const user = userEvent.setup();
    setup({
      editing: {
        id: "tr-1",
        fromAccountId: "acc-scb",
        toAccountId: "acc-cash",
        txnDate: "2026-08-01",
        amount: "100",
        note: null,
      },
    });

    await user.click(screen.getByRole("button", { name: /ทั้งหมด/ }));
    expect((screen.getByLabelText("จำนวนเงิน") as HTMLInputElement).value).toBe("10000");
  });
});

/* ------------------------------------------------------------------ */

/**
 * สัญญาณบอกว่า "โอนใหม่สำเร็จแล้ว" ที่ส่งออกไปให้หน้าที่เปิดแผ่นนี้
 *
 * แยกจาก onClose เพราะสองอย่างนี้ไม่ใช่เรื่องเดียวกัน — ปิดแผ่นเกิดตอน
 * กดกากบาททิ้งไปเฉยๆ ก็ได้ ส่วนอันนี้แปลว่าเงินขยับจริงแล้ว
 */
describe("บอกหน้าที่เรียกใช้ ว่าโอนใหม่สำเร็จแล้ว", () => {
  it("โอนใหม่สำเร็จแล้วส่งสัญญาณ", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    createTransfer.mockResolvedValue({ status: "ok" });

    render(
      <TransferSheet
        open
        onClose={() => undefined}
        onCreated={onCreated}
        shopId="shop-1"
        accounts={ACCOUNTS}
      />,
    );

    await user.type(screen.getByLabelText("จำนวนเงิน"), "500");
    await user.selectOptions(screen.getByLabelText("จากบัญชี"), "acc-cash");
    await user.selectOptions(screen.getByLabelText("ไปบัญชี"), "acc-scb");
    await user.click(screen.getByRole("button", { name: "โอนเงิน" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  /**
   * แก้ของเดิมไม่ใช่การโอนใหม่
   *
   * ถ้าส่งสัญญาณตรงนี้ด้วย คนที่กำลังไล่ดูประวัติของบัญชีแล้วแตะแก้
   * ตัวเลขผิดสักบรรทัด จะถูกพาออกจากหน้าที่ดูอยู่โดยไม่ได้ขอ
   */
  it("แก้ของเดิมสำเร็จ ไม่ส่งสัญญาณ", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    updateTransfer.mockResolvedValue({ status: "ok" });

    render(
      <TransferSheet
        open
        onClose={() => undefined}
        onCreated={onCreated}
        shopId="shop-1"
        accounts={ACCOUNTS}
        editing={{
          id: "tr-1",
          fromAccountId: "acc-scb",
          toAccountId: "acc-cash",
          txnDate: "2026-08-01",
          amount: "100",
          note: null,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));

    await waitFor(() => expect(updateTransfer).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("โอนไม่สำเร็จ ไม่ส่งสัญญาณ", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    createTransfer.mockResolvedValue({ status: "error", message: "โอนไม่สำเร็จ" });

    render(
      <TransferSheet
        open
        onClose={() => undefined}
        onCreated={onCreated}
        shopId="shop-1"
        accounts={ACCOUNTS}
      />,
    );

    await user.type(screen.getByLabelText("จำนวนเงิน"), "500");
    await user.selectOptions(screen.getByLabelText("จากบัญชี"), "acc-cash");
    await user.selectOptions(screen.getByLabelText("ไปบัญชี"), "acc-scb");
    await user.click(screen.getByRole("button", { name: "โอนเงิน" }));

    await waitFor(() => expect(createTransfer).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
  });
});
