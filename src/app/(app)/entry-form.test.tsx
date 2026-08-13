// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountWithBalance } from "@/db/queries";
import type { Category } from "@/db/schema";
import { EntryForm } from "./entry-form";

/**
 * ฟอร์มบันทึกรายการ — หน้าจอที่ถูกใช้บ่อยที่สุดและพังมาแล้วสองครั้ง
 *
 * เทสในนี้ทดสอบสิ่งที่เทสหน่วยกับเทสฐานข้อมูลมองไม่เห็นเลย คือ
 * "ฟอร์มส่งอะไรออกไปจริง" และ "กดแล้วค่าที่เลือกอยู่เปลี่ยนเป็นอะไร"
 *
 * บั๊กสองตัวที่หลุดไปถึงมือคนใช้ อยู่ตรงนี้ทั้งคู่
 *   • เลือก "ไม่ระบุ" แล้วเด้งกลับไปประเภทแรกทันที เลือกค้างไว้ไม่ได้
 *   • ช่องหมายเหตุที่ยุบไว้ไม่ส่งคีย์มาเลย ทำให้บันทึกไม่ได้ทั้งแอป
 */

vi.mock("@/actions/transactions", () => ({
  createTransaction: vi.fn(async () => ({ status: "ok" as const })),
}));

vi.mock("@/actions/settings", () => ({
  createCategory: vi.fn(async () => ({ status: "ok" as const })),
}));

const stamp = new Date("2026-08-13T00:00:00Z");

const account = (id: string, name: string, extra: Partial<AccountWithBalance> = {}) =>
  ({
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
    balance: "0",
    ...extra,
  }) satisfies AccountWithBalance;

const category = (id: string, name: string, direction: "in" | "out", counts = true) =>
  ({
    id,
    shopId: null,
    direction,
    name,
    counts,
    sortOrder: 1,
    isActive: true,
    isDeleted: false,
    createdAt: stamp,
    updatedAt: stamp,
  }) satisfies Category;

const ACCOUNTS = [
  account("acc-cash", "เงินสด", { balance: "1500" }),
  account("acc-bank", "ไทยพลัส", { balance: "4000" }),
];

const CATEGORIES = [
  category("cat-sale", "ขายหน้าร้าน", "in"),
  category("cat-topup", "เติมทุน", "in", false),
  category("cat-cost", "ซื้อของเข้าร้าน", "out"),
];

function setup(props: Partial<React.ComponentProps<typeof EntryForm>> = {}) {
  render(
    <EntryForm
      shopId="shop-1"
      accounts={ACCOUNTS}
      categories={CATEGORIES}
      lastAccountId={null}
      titleHints={{ in: [], out: [] }}
      {...props}
    />,
  );

  return {
    form: document.querySelector("form") as HTMLFormElement,
    amount: screen.getByLabelText("จำนวนเงิน"),
    title: screen.getByLabelText("รายการ"),
    categorySelect: screen.getByLabelText("ประเภท") as HTMLSelectElement,
    accountSelect: screen.getByLabelText(/บัญชี/) as HTMLSelectElement,
    save: screen.getByRole("button", { name: "บันทึกรายการ" }) as HTMLButtonElement,
  };
}

/** คีย์ที่ฟอร์มจะส่งออกไปจริงตอนนี้ */
const keysSentBy = (form: HTMLFormElement) => [...new FormData(form).keys()];
const valueSentBy = (form: HTMLFormElement, key: string) => new FormData(form).get(key);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

/* ------------------------------------------------------------------ */

describe("สิ่งที่ฟอร์มส่งออกไปจริง", () => {
  it("ตอนยังไม่ได้กดเปิดช่องหมายเหตุ ต้องไม่มีคีย์ note ติดไปด้วย", () => {
    // ไม่ใช่ "มีคีย์แล้วเป็นค่าว่าง" — ความต่างตรงนี้คือบั๊กที่ทำให้
    // บันทึกรายการไม่ได้ทั้งแอป ฝั่ง Zod ต้องเผื่อกรณีนี้ไว้
    const { form } = setup();

    expect(keysSentBy(form)).not.toContain("note");
  });

  it("กดเปิดหมายเหตุแล้วถึงจะมีคีย์ note", async () => {
    const user = userEvent.setup();
    const { form } = setup();

    await user.click(screen.getByRole("button", { name: "เพิ่มหมายเหตุ" }));

    expect(keysSentBy(form)).toContain("note");
  });

  it("ส่งร้าน ฝั่ง และวันที่ไปด้วยเสมอ แม้จะไม่มีช่องให้เห็น", () => {
    const { form } = setup();
    const keys = keysSentBy(form);

    expect(keys).toContain("shopId");
    expect(keys).toContain("direction");
    expect(keys).toContain("txnDate");
    expect(valueSentBy(form, "shopId")).toBe("shop-1");
  });
});

/* ------------------------------------------------------------------ */

describe("ช่องประเภท", () => {
  it("เลือกประเภทแรกของฝั่งนั้นไว้ให้ตั้งแต่เปิดหน้า", () => {
    const { categorySelect } = setup();
    expect(categorySelect.value).toBe("cat-sale");
  });

  /**
   * บั๊กที่คนใช้รายงานมาเอง — "จะเลือกไม่ระบุ ก็เลือกกลับไม่ได้"
   *
   * เดิมใช้ "" แทนทั้ง "ยังไม่ได้เลือก" และ "เลือกไม่ระบุไว้เอง" พอเลือก
   * ไม่ระบุ ระบบนึกว่ายังไม่ได้เลือกแล้วเด้งกลับไปตัวแรกทันที
   */
  it("เลือก — ไม่ระบุ — แล้วต้องค้างอยู่ ไม่เด้งกลับไปตัวแรก", async () => {
    const user = userEvent.setup();
    const { categorySelect, form } = setup();

    await user.selectOptions(categorySelect, "");

    expect(categorySelect.value).toBe("");
    expect(valueSentBy(form, "categoryId")).toBe("");
  });

  it("สลับไปฝั่งจ่าย แล้วเห็นเฉพาะประเภทของฝั่งจ่าย", async () => {
    const user = userEvent.setup();
    const { categorySelect } = setup();

    await user.click(screen.getByRole("button", { name: "จ่ายออก" }));

    const names = [...categorySelect.options].map((o) => o.textContent?.trim());
    expect(names).toContain("ซื้อของเข้าร้าน");
    expect(names).not.toContain("ขายหน้าร้าน");
    expect(categorySelect.value).toBe("cat-cost");
  });

  it("ประเภทที่ไม่นับเป็นกำไรมีวงเล็บกำกับ ไม่ได้ใช้สีบอกอย่างเดียว", () => {
    const { categorySelect } = setup();
    const topUp = [...categorySelect.options].find((o) => o.value === "cat-topup");

    expect(topUp?.textContent).toContain("ไม่นับเป็นกำไร");
  });
});

/* ------------------------------------------------------------------ */

describe("ช่องบัญชี", () => {
  it("ไม่มีประวัติ ให้เลือกบัญชีแรกไว้ ไม่ใช่ปล่อยเป็นไม่ระบุ", () => {
    // ถ้าปล่อยเป็นไม่ระบุ รายการที่ลงเร็วๆ จะไม่ผูกบัญชี
    // แล้วยอดคงเหลือไม่ขยับทั้งที่เงินเข้าออกจริง
    const { accountSelect } = setup();
    expect(accountSelect.value).toBe("acc-cash");
  });

  it("มีประวัติ ให้เลือกบัญชีที่ใช้ล่าสุด", () => {
    const { accountSelect } = setup({ lastAccountId: "acc-bank" });
    expect(accountSelect.value).toBe("acc-bank");
  });

  it("บัญชีที่ใช้ล่าสุดถูกปิดไปแล้ว ให้ตกกลับไปบัญชีแรก", () => {
    // ถ้าส่งค่าที่ไม่มีในตัวเลือก เบราว์เซอร์จะเด้งไปตัวแรกเงียบๆ
    // แล้วสิ่งที่ React คิดว่าเลือกอยู่กับสิ่งที่ส่งจริงจะไม่ตรงกัน
    const { accountSelect } = setup({ lastAccountId: "acc-ที่ถูกลบไปแล้ว" });
    expect(accountSelect.value).toBe("acc-cash");
  });

  it("เลือกไม่ระบุเองได้ และค้างอยู่", async () => {
    const user = userEvent.setup();
    const { accountSelect, form } = setup();

    await user.selectOptions(accountSelect, "");

    expect(accountSelect.value).toBe("");
    expect(valueSentBy(form, "accountId")).toBe("");
  });

  it("ยอดคงเหลือติดอยู่ในชื่อตัวเลือก จะได้เห็นตอนกำลังเลือก", () => {
    const { accountSelect } = setup();
    const names = [...accountSelect.options].map((o) => o.textContent);

    expect(names.some((n) => n?.includes("เงินสด") && n.includes("1,500"))).toBe(true);
    expect(names.some((n) => n?.includes("ไทยพลัส") && n.includes("4,000"))).toBe(true);
  });

  it("ร้านที่ยังไม่มีบัญชีเลย ยังเปิดหน้าได้ และเหลือแค่ไม่ระบุ", () => {
    const { accountSelect } = setup({ accounts: [] });

    expect(accountSelect.value).toBe("");
    expect(accountSelect.options).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */

describe("ปุ่มบันทึก", () => {
  it("กดไม่ได้จนกว่าจะมีทั้งจำนวนเงินและชื่อรายการ", async () => {
    const user = userEvent.setup();
    const { amount, title, save } = setup();

    expect(save.disabled).toBe(true);

    await user.type(amount, "120");
    expect(save.disabled).toBe(true);

    await user.type(title, "ขายของ");
    expect(save.disabled).toBe(false);
  });

  it("ชื่อรายการที่มีแต่ช่องว่าง ยังกดไม่ได้", async () => {
    const user = userEvent.setup();
    const { amount, title, save } = setup();

    await user.type(amount, "120");
    await user.type(title, "   ");

    expect(save.disabled).toBe(true);
  });

  it("ไม่ได้ลอยติดขอบจอแล้ว — ไหลไปตามฟอร์มตามปกติ", () => {
    const { save } = setup();
    const wrapper = save.parentElement;

    expect(save.className).not.toContain("sticky");
    expect(wrapper?.className ?? "").not.toContain("sticky");
  });
});
