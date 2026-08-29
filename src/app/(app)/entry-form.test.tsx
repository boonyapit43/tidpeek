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
  category("cat-draw", "ถอนใช้ส่วนตัว", "out", false),
];

function setup(props: Partial<React.ComponentProps<typeof EntryForm>> = {}) {
  render(
    <EntryForm
      shopId="shop-1"
      accounts={ACCOUNTS}
      categories={CATEGORIES}
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
  /**
   * ฟอร์มตั้งต้นที่ฝั่งจ่ายออก ไม่ใช่รับเข้า
   *
   * ของจริงร้านลงรายจ่ายทีละรายการตลอดวัน แล้วลงยอดขายครั้งเดียวตอนปิดร้าน
   * เป็นจ่าย 6 ต่อรับ 1 — ตั้งผิดด้านเท่ากับกดสลับเพิ่มวันละหกครั้ง
   *
   * แต่ประเภทไม่ถูกเดาให้ — คนใช้ขอเองว่าต้องขึ้น "เลือกก่อน" ไม่ใช่
   * default เป็นค่าแรกสุด เพราะค่าที่ถูกเดาผิดคือรายงานที่เพี้ยนเงียบๆ
   */
  it("เปิดหน้ามาอยู่ฝั่งจ่ายออก แต่ประเภทขึ้นเลือกก่อน ไม่เดาตัวแรกให้", () => {
    const { categorySelect, form } = setup();

    expect(valueSentBy(form, "direction")).toBe("out");
    expect(categorySelect.value).toBe("");
    expect(categorySelect.options[categorySelect.selectedIndex].textContent).toContain(
      "เลือกประเภทก่อน",
    );
    expect(valueSentBy(form, "categoryId")).toBe("");
  });

  /**
   * บั๊กที่คนใช้รายงานมาเอง — "จะเลือกไม่ระบุ ก็เลือกกลับไม่ได้"
   *
   * เดิมใช้ "" แทนทั้ง "ยังไม่ได้เลือก" และ "เลือกไม่ระบุไว้เอง" พอเลือก
   * ไม่ระบุ ระบบนึกว่ายังไม่ได้เลือกแล้วเด้งกลับไปตัวแรกทันที
   */
  it("เลือกไม่ระบุแล้วต้องค้างอยู่ และส่งออกไปเป็นค่าว่าง", async () => {
    const user = userEvent.setup();
    const { categorySelect, form } = setup();

    await user.selectOptions(categorySelect, "__none__");

    expect(categorySelect.value).toBe("__none__");
    // รหัสภายในถูกแปลงกลับเป็นค่าว่างก่อนถึงเซิร์ฟเวอร์เสมอ
    expect(valueSentBy(form, "categoryId")).toBe("");
  });

  it("สลับไปฝั่งรับ แล้วเห็นเฉพาะประเภทของฝั่งรับ", async () => {
    const user = userEvent.setup();
    const { categorySelect } = setup();

    await user.click(screen.getByRole("button", { name: "รับเข้า" }));

    const names = [...categorySelect.options].map((o) => o.textContent?.trim());
    expect(names).toContain("ขายหน้าร้าน");
    expect(names).not.toContain("ซื้อของเข้าร้าน");
    // สลับฝั่งแล้วก็ยังไม่เดาให้ — กลับมาที่เลือกก่อนเหมือนเปิดหน้าใหม่
    expect(categorySelect.value).toBe("");
  });

  it("ประเภทที่ไม่นับเป็นกำไรมีวงเล็บกำกับ ไม่ได้ใช้สีบอกอย่างเดียว", () => {
    const { categorySelect } = setup();
    const draw = [...categorySelect.options].find((o) => o.value === "cat-draw");

    expect(draw?.textContent).toContain("ไม่นับเป็นกำไร");
  });
});

/* ------------------------------------------------------------------ */

describe("ช่องบัญชี", () => {
  /**
   * ไม่มีประวัติ = ไม่เดา — ขึ้น "เลือกบัญชีก่อน" แล้วล็อกปุ่มบันทึกไว้
   *
   * เดิมเดาบัญชีแรกให้เพื่อกันรายการไม่ผูกบัญชี (ยอดจะไม่ขยับ) แต่การเดา
   * ผิดคือเงินลงผิดบัญชีเงียบๆ — ตอนนี้กันบั๊กเดิมด้วยการล็อกปุ่มแทน
   */
  it("ไม่มีประวัติ ขึ้นเลือกบัญชีก่อน ไม่เดาตัวแรกให้", () => {
    const { accountSelect } = setup();

    expect(accountSelect.value).toBe("");
    expect(accountSelect.options[accountSelect.selectedIndex].textContent).toContain(
      "เลือกบัญชีก่อน",
    );
  });

  /**
   * เคยเติมบัญชีที่ใช้ล่าสุดให้ โดยอ้างว่าไม่ใช่การเดาเพราะคนเลือกเองครั้งก่อน
   * เจ้าของร้านบอกว่ายังไม่ใช่ — ครั้งก่อนเลือกเงินสด ไม่ได้แปลว่าครั้งนี้
   * จะเป็นเงินสด และช่องที่มีค่าค้างอยู่คือช่องที่คนกวาดตาผ่านโดยไม่ได้อ่าน
   */
  it("ไม่เติมบัญชีให้จากประวัติ ต้องเลือกเองทุกครั้ง", () => {
    const { accountSelect } = setup();
    expect(accountSelect.value).toBe("");
  });

  it("ฟอร์มบันทึกใหม่ไม่มีตัวเลือกไม่ระบุบัญชี — เงินทุกรายการต้องมีที่มาที่ไป", () => {
    const { accountSelect } = setup();

    const selectable = [...accountSelect.options].filter((o) => !o.disabled);
    expect(selectable.map((o) => o.value)).not.toContain("");
  });

  it("ยอดคงเหลือติดอยู่ในชื่อตัวเลือก จะได้เห็นตอนกำลังเลือก", () => {
    const { accountSelect } = setup();
    const names = [...accountSelect.options].map((o) => o.textContent);

    expect(names.some((n) => n?.includes("เงินสด") && n.includes("1,500"))).toBe(true);
    expect(names.some((n) => n?.includes("ไทยพลัส") && n.includes("4,000"))).toBe(true);
  });

  it("ร้านที่ยังไม่มีบัญชีเลย บอกตรงๆ ว่าว่างและไปเพิ่มที่ไหน", () => {
    // ไม่ใช่โชว์ "ไม่ระบุ" เฉยๆ ให้คนงงว่าบัญชีหายไปไหน
    const { accountSelect } = setup({ accounts: [] });

    expect(accountSelect.value).toBe("");
    expect(accountSelect.options).toHaveLength(1);
    expect(accountSelect.options[0].textContent).toContain("ยังไม่มีบัญชี");
  });

  it("ฝั่งที่ยังไม่มีประเภทเลย ก็บอกแบบเดียวกัน", async () => {
    const user = userEvent.setup();
    const { categorySelect } = setup({
      categories: [category("cat-sale", "ขายหน้าร้าน", "in")],
    });

    // ฟอร์มเปิดมาที่ฝั่งจ่ายออก ซึ่งชุดนี้ไม่มีประเภทฝั่งนั้นเลย
    expect(categorySelect.options).toHaveLength(1);
    expect(categorySelect.options[0].textContent).toContain("ยังไม่มีประเภทของฝั่งนี้");

    // สลับไปฝั่งรับ ได้ครบสามส่วน: ตัวบอกให้เลือก + ไม่ระบุ + ประเภทที่มี
    await user.click(screen.getByRole("button", { name: "รับเข้า" }));
    expect(categorySelect.options).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------ */

describe("ปุ่มบันทึก", () => {
  /**
   * ต้องครบสี่อย่างถึงจะกดได้: จำนวน ชื่อ ประเภท และบัญชี
   *
   * สองอย่างหลังคือด่านที่มาแทนการเดาค่าแรกให้ — ปุ่มที่กดไม่ได้บอกชัดกว่า
   * รายการที่ถูกบันทึกลงผิดบัญชีผิดหมวดโดยไม่มีใครทันเห็น
   */
  it("กดไม่ได้จนกว่าจะครบ จำนวน ชื่อ ประเภท และบัญชี", async () => {
    const user = userEvent.setup();
    const { amount, title, categorySelect, accountSelect, save } = setup();

    await user.type(amount, "120");
    await user.type(title, "ขายของ");
    // ครบสองช่องบนแล้ว แต่ยังไม่ได้เลือกประเภทกับบัญชี
    expect(save.disabled).toBe(true);

    await user.selectOptions(categorySelect, "cat-cost");
    expect(save.disabled).toBe(true);

    await user.selectOptions(accountSelect, "acc-cash");
    expect(save.disabled).toBe(false);
  });


  it("ชื่อรายการที่มีแต่ช่องว่าง ยังกดไม่ได้", async () => {
    const user = userEvent.setup();
    const { amount, title, categorySelect, accountSelect, save } = setup();

    await user.type(amount, "120");
    await user.type(title, "   ");
    await user.selectOptions(categorySelect, "cat-cost");
    await user.selectOptions(accountSelect, "acc-cash");

    expect(save.disabled).toBe(true);
  });

  it("ไม่ได้ลอยติดขอบจอแล้ว — ไหลไปตามฟอร์มตามปกติ", () => {
    const { save } = setup();
    const wrapper = save.parentElement;

    expect(save.className).not.toContain("sticky");
    expect(wrapper?.className ?? "").not.toContain("sticky");
  });
});
