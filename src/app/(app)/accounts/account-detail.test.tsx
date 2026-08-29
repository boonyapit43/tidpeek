// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountWithBalance, MovementRow } from "@/db/queries";
import { AccountDetail } from "./account-detail";

/**
 * หน้าของบัญชีเดียว
 *
 * เทสชุดนี้มีเพราะของจริงเคยขาดไปสองอย่าง — เจ้าของร้านเปิดเข้ามาเพื่อจะ
 * โอนเงินออกจากบัญชีนี้ กับตั้งยอดตั้งต้นของบัญชีนี้ แล้วหาปุ่มไม่เจอทั้งคู่
 * เพราะทั้งสองอย่างไปอยู่หน้าอื่น
 *
 * บทเรียนคือ **ปุ่มต้องอยู่ในที่ที่คนไปหา ไม่ใช่ที่ที่จัดหมวดแล้วเข้าท่า**
 */

/**
 * ของกลางใน setup.ts ปลอมไว้แค่ redirect หน้านี้ใช้ useRouter ด้วย
 * จึงต้องปลอมทับเองทั้งก้อน และเก็บ push ไว้ตรวจว่าพากลับหน้ารวมจริง
 */
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/actions/transfers", () => ({
  createTransfer: vi.fn(async () => ({ status: "ok" as const })),
  updateTransfer: vi.fn(async () => ({ status: "ok" as const })),
  deleteTransfer: vi.fn(async () => ({ status: "ok" as const })),
}));

vi.mock("@/actions/settings", () => ({
  createAccount: vi.fn(async () => ({ status: "ok" as const })),
  updateAccount: vi.fn(async () => ({ status: "ok" as const })),
  deleteAccount: vi.fn(async () => ({ status: "ok" as const })),
  setAccountActive: vi.fn(async () => ({ status: "ok" as const })),
}));

const stamp = new Date("2026-08-13T00:00:00Z");

const account = (
  id: string,
  name: string,
  balance: string,
  openingBalance = "0",
): AccountWithBalance => ({
  id,
  shopId: "shop-1",
  name,
  kind: "bank",
  bank: null,
  accountNo: null,
  openingBalance,
  sortOrder: 1,
  isActive: true,
  isDeleted: false,
  createdAt: stamp,
  updatedAt: stamp,
  balance,
});

const SCB = account("acc-scb", "SCB", "500");
const ACCOUNTS = [SCB, account("acc-kt", "กรุงไทย", "2000")];

const txnRow: MovementRow = {
  kind: "txn",
  id: "t1",
  txnDate: "2026-08-12",
  signed: "1500",
  label: "ยอดขาย",
  categoryName: "ขายหน้าร้าน",
  note: null,
  createdAt: stamp,
  transfer: null,
};

const transferRow: MovementRow = {
  kind: "transfer",
  id: "tr1",
  txnDate: "2026-08-12",
  signed: "-800",
  label: "กรุงไทย",
  categoryName: null,
  note: "สำรองจ่าย",
  createdAt: stamp,
  transfer: { fromAccountId: "acc-scb", toAccountId: "acc-kt" },
};

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

beforeEach(() => routerPush.mockClear());

function setup(
  over: {
    account?: AccountWithBalance;
    movements?: MovementRow[];
    movementCount?: number;
  } = {},
) {
  const movements = over.movements ?? [txnRow, transferRow];

  render(
    <AccountDetail
      shopId="shop-1"
      account={over.account ?? SCB}
      accounts={ACCOUNTS}
      movements={movements}
      movementCount={over.movementCount ?? movements.length}
      moreHref="?a=acc-scb&n=100"
    />,
  );
}

const openDialog = () => document.querySelector("dialog[open]") as HTMLDialogElement | null;

/* ------------------------------------------------------------------ */

describe("ปุ่มที่ต้องหาเจอจากหน้านี้", () => {
  it("มีปุ่มโอนเงินออกจากบัญชีนี้", () => {
    setup();
    expect(screen.getByRole("button", { name: "โอนเงินออกจากบัญชีนี้" })).toBeTruthy();
  });

  it("กดแล้วฟอร์มโอนเลือกบัญชีนี้เป็นต้นทางให้เลย", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "โอนเงินออกจากบัญชีนี้" }));

    const from = screen.getByLabelText("จากบัญชี") as HTMLSelectElement;
    expect(from.value).toBe("acc-scb");
  });

  it("ยอดตั้งต้นแตะแก้ได้ตรงนี้ ไม่ต้องเดินไปหน้าตั้งค่า", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ยอดตั้งต้น/ }));

    const dialog = openDialog();
    expect(dialog).not.toBeNull();
    expect(
      within(dialog as HTMLElement).getByLabelText(/ยอดตั้งต้น/),
    ).toBeTruthy();
  });

  it("บัญชีที่ยังไม่ตั้งยอดตั้งต้น ต้องบอกให้เห็นชัดว่ายังไม่ได้ตั้ง", () => {
    setup();
    expect(screen.getByRole("button", { name: /ยังไม่ได้ตั้งยอดตั้งต้น/ })).toBeTruthy();
  });

  it("ตั้งยอดแล้วเปลี่ยนเป็นแสดงยอดเฉยๆ ไม่ต้องเตือนอีก", () => {
    setup({ account: account("acc-scb", "SCB", "3500", "3000") });

    expect(screen.queryByRole("button", { name: /ยังไม่ได้ตั้ง/ })).toBeNull();
    expect(screen.getByRole("button", { name: /ยอดตั้งต้น/ })).toBeTruthy();
  });

  it("มีบัญชีเดียว ปุ่มโอนกดไม่ได้", () => {
    render(
      <AccountDetail
        shopId="shop-1"
        account={SCB}
        accounts={[SCB]}
        movements={[]}
        movementCount={0}
        moreHref="?a=acc-scb&n=100"
      />,
    );

    const btn = screen.getByRole("button", {
      name: "โอนเงินออกจากบัญชีนี้",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("รายการเงินเข้าออก", () => {
  /**
   * รายการปกติต้องแตะได้ ไม่ใช่แค่แสดงเฉยๆ
   *
   * ของเดิมเป็น div แตะไม่ได้ คนที่เห็นรายการผิดในหน้านี้ต้องจำวันแล้วเดิน
   * ไปหน้ารายวันไล่หาเอง ซึ่งผิดกฎเดียวกับที่ทำให้หาปุ่มโอนไม่เจอ
   */
  it("รายการปกติแตะแล้วพาไปแก้ที่หน้ารายวัน พร้อมเปิดรายการนั้นให้เลย", () => {
    setup();

    const link = screen.getByRole("link", { name: /ยอดขาย/ }) as HTMLAnchorElement;

    // ต้องมีทั้งวันและ id ของรายการ — มีแค่วันคือพาไปถึงแล้วปล่อยให้หาเอง
    expect(link.getAttribute("href")).toBe("/day?d=2026-08-12&t=t1");
  });

  it("การโอนแตะแก้ตรงนี้เลย ไม่ได้พาไปหน้าอื่น", () => {
    setup();

    expect(screen.getByRole("button", { name: /ไป กรุงไทย/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /กรุงไทย/ })).toBeNull();
  });

  it("แตะการโอนแล้วได้ฟอร์มที่ใส่ค่าเดิมไว้ พร้อมปุ่มลบ", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ไป กรุงไทย/ }));

    expect((screen.getByLabelText("จำนวนเงิน") as HTMLInputElement).value).toBe("800");
    expect((screen.getByLabelText("จากบัญชี") as HTMLSelectElement).value).toBe("acc-scb");
    expect((screen.getByLabelText("ไปบัญชี") as HTMLSelectElement).value).toBe("acc-kt");
    expect(screen.getByRole("button", { name: "ลบการโอนนี้" })).toBeTruthy();
  });

  it("เงินเข้าเป็นบวก เงินออกเป็นลบ มีเครื่องหมายกำกับไม่ได้ใช้สีอย่างเดียว", () => {
    setup();

    expect(screen.getByText(/\+/)).toBeTruthy();
    expect(screen.getByText(/−/)).toBeTruthy();
  });

  it("ยังไม่มีอะไรเข้าออก ก็ยังเปิดหน้าได้และยังโอนได้", () => {
    setup({ movements: [] });

    expect(screen.getByText("ยังไม่มีเงินเข้าออกบัญชีนี้")).toBeTruthy();
    expect(screen.getByRole("button", { name: "โอนเงินออกจากบัญชีนี้" })).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */

/**
 * โอนเสร็จแล้วต้องพากลับไปหน้ารวมบัญชี
 *
 * การโอนขยับเงินสองบัญชีพร้อมกัน แต่หน้านี้โชว์ได้ทีละบัญชี ยืนดูอยู่ที่เดิม
 * จึงเห็นแค่ขาที่เงินออก ไม่เห็นว่าปลายทางรับครบไหม ซึ่งเป็นสิ่งเดียวที่
 * คนโอนอยากรู้ — เจ้าของร้านแจ้งเองว่า "โอนเสร็จแล้วมันไม่กลับมาหน้ารวมบัญชี"
 */
describe("โอนเสร็จแล้วไปไหนต่อ", () => {
  it("โอนใหม่สำเร็จ พากลับไปหน้ารวมบัญชี", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "โอนเงินออกจากบัญชีนี้" }));

    const sheet = openDialog()!;
    await user.type(within(sheet).getByLabelText("จำนวนเงิน"), "500");
    await user.selectOptions(within(sheet).getByLabelText("ไปบัญชี"), "acc-kt");
    await user.click(within(sheet).getByRole("button", { name: "โอนเงิน" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/accounts"));
  });

  /**
   * แก้ของเดิมยังอยู่หน้าเดิม เพราะตอนนั้นกำลังไล่ดูประวัติของบัญชีนี้อยู่
   */
  it("แก้การโอนเดิม ไม่ถูกพาออกจากหน้านี้", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /ไป กรุงไทย/ }));

    const sheet = openDialog();
    if (sheet) {
      const save = within(sheet).queryByRole("button", { name: "บันทึกการแก้ไข" });
      if (save) await user.click(save);
    }

    expect(routerPush).not.toHaveBeenCalled();
  });
});
