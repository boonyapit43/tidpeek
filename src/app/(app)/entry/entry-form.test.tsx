// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  /**
   * ฟอร์มบันทึกใหม่ไม่มีตัวเลือก "ไม่ระบุบัญชี" — เงินทุกรายการต้องมีที่มาที่ไป
   *
   * ค่าว่างที่มีอยู่คือหัวตาราง "เลือกบัญชีก่อน" ซึ่งแปลว่ายังไม่ได้เลือก
   * ไม่ใช่เลือกว่าไม่ระบุ ข้อบังคับจริงจึงอยู่ที่ปุ่มบันทึกที่กดไม่ได้
   * ไม่ใช่ที่การมี/ไม่มีตัวเลือกค่าว่างในลิสต์
   */

  it("ไม่มีตัวเลือกที่แปลว่าไม่ระบุบัญชี มีแต่หัวตารางกับบัญชีจริง", () => {
    const { accountSelect } = setup();
    const labels = [...accountSelect.options].map((o) => o.textContent ?? "");

    expect(labels.some((l) => l.includes("ไม่ระบุ"))).toBe(false);
    expect(labels[0]).toContain("เลือกบัญชีก่อน");
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

/* ------------------------------------------------------------------ */

/**
 * สถานะของฟอร์มหลัง "บันทึกสำเร็จ" — ไม่เคยมีเทสคุมมาก่อน ซึ่งเป็นเหตุผล
 * ที่บั๊กนี้หลุดไปถึงมือคนใช้: ล้างจำนวนเงินกับชื่อรายการให้ แต่ปล่อยประเภท
 * กับบัญชีค้างไว้ พอลงรายการที่สองจึงเหลือค่าเก่าอยู่สองช่องท่ามกลางช่องว่าง
 *
 * เทสก่อนหน้านี้หยุดที่ "กดปุ่มแล้วเรียก action ถูกไหม" ไม่ได้ดูต่อว่า
 * หลังจากนั้นฟอร์มอยู่ในสภาพพร้อมลงรายการถัดไปจริงหรือเปล่า
 */
describe("หลังบันทึกสำเร็จ ฟอร์มต้องพร้อมลงรายการถัดไป", () => {
  /**
   * ต้องดึงช่องเลือกใหม่หลังบันทึก ห้ามใช้ตัวที่หยิบไว้ตอนแรก
   *
   * เพราะช่องเลือกถูกสร้างใหม่ทุกครั้งที่ action จบ (ดู formRound ในฟอร์ม)
   * ตัวเดิมกลายเป็นก้อนที่หลุดออกจากหน้าไปแล้ว ค่าที่อ่านได้จึงเป็นของเก่า
   * ค้างอยู่ ไม่ใช่สิ่งที่คนใช้เห็นบนจอ
   */
  const selects = () => ({
    category: screen.getByLabelText("ประเภท") as HTMLSelectElement,
    account: screen.getByLabelText(/บัญชี/) as HTMLSelectElement,
  });

  const saveOne = async (user: ReturnType<typeof userEvent.setup>) => {
    const f = setup();

    await user.type(f.amount, "120");
    await user.type(f.title, "ซื้อของ");
    await user.selectOptions(f.categorySelect, "cat-cost");
    await user.selectOptions(f.accountSelect, "acc-cash");
    await user.click(f.save);

    return f;
  };

  it("ล้างทุกช่อง รวมประเภทกับบัญชี ไม่ใช่ล้างแค่บางช่อง", async () => {
    const user = userEvent.setup();
    const f = await saveOne(user);

    await waitFor(() => {
      expect((f.amount as HTMLInputElement).value).toBe("");
    });

    expect((f.title as HTMLInputElement).value).toBe("");

    const now = selects();
    expect(now.category.value).toBe("");
    expect(now.account.value).toBe("");
  });

  it("กลับไปขึ้นว่าเลือกก่อน เหมือนตอนเปิดหน้ามาใหม่", async () => {
    const user = userEvent.setup();
    await saveOne(user);

    await waitFor(() => {
      const now = selects();
      expect(now.category.options[now.category.selectedIndex].textContent).toContain(
        "เลือกประเภทก่อน",
      );
      expect(now.account.options[now.account.selectedIndex].textContent).toContain(
        "เลือกบัญชีก่อน",
      );
    });
  });

  it("ปุ่มบันทึกกลับไปกดไม่ได้ จนกว่าจะกรอกรายการใหม่ครบ", async () => {
    const user = userEvent.setup();
    const f = await saveOne(user);

    await waitFor(() => expect(f.save.disabled).toBe(true));
  });
});

/* ------------------------------------------------------------------ */

/**
 * กฎที่สำคัญที่สุดของฟอร์มนี้ — จอโชว์อะไร ระบบต้องส่งอันนั้น
 *
 * บั๊กที่คนใช้เจอกับเงินจริง: ลงรายการก่อนหน้าด้วยไทยพลัส พอบันทึกเสร็จ
 * ช่องบัญชีโชว์ SCB แต่พอกดบันทึกรายการถัดไป เงินกลับไปหักจากไทยพลัส
 *
 * สาเหตุคือ React 19 สั่ง form.reset() เองหลัง action ซึ่งเปลี่ยนค่าใน DOM
 * แต่ไม่ได้บอก React ค่าที่เห็นกับค่าที่จะส่งจึงแยกกันเงียบๆ
 *
 * เทสชุดนี้ผูกสองอย่างไว้ด้วยกันตรงๆ — ค่าที่ช่องเลือกโชว์ กับค่าใน
 * ช่องซ่อนที่ถูกส่งจริง ถ้าวันหนึ่งมันแยกกันอีก เทสจะแดงทันที
 */
describe("ค่าที่เห็นกับค่าที่ส่ง ต้องเป็นอันเดียวกันเสมอ", () => {
  const hidden = (form: HTMLFormElement, name: string) =>
    (form.querySelector(`input[type=hidden][name=${name}]`) as HTMLInputElement).value;

  it("เลือกไทยพลัสแล้วช่องซ่อนเป็นไทยพลัส ไม่ใช่บัญชีแรกในลิสต์", async () => {
    const user = userEvent.setup();
    const { form, accountSelect } = setup();

    await user.selectOptions(accountSelect, "acc-bank");

    expect(accountSelect.value).toBe("acc-bank");
    expect(hidden(form, "accountId")).toBe("acc-bank");
  });

  /**
   * เคสของคนใช้เป๊ะๆ — ลงด้วยไทยพลัสไปแล้วหนึ่งรายการ
   *
   * หลังบันทึก ช่องต้องว่างและช่องซ่อนต้องว่างด้วย ไม่ใช่ช่องว่างแต่ค่าที่
   * ส่งยังเป็นไทยพลัสค้างอยู่ ซึ่งคือเงินหักผิดบัญชีโดยไม่มีใครเห็น
   */
  it("บันทึกด้วยไทยพลัสแล้ว รายการถัดไปต้องว่างทั้งที่เห็นและที่จะส่ง", async () => {
    const user = userEvent.setup();
    const { form, amount, title, categorySelect, accountSelect, save } = setup();

    await user.type(amount, "165");
    await user.type(title, "ค่าแก๊ส");
    await user.selectOptions(categorySelect, "cat-cost");
    await user.selectOptions(accountSelect, "acc-bank");

    expect(hidden(form, "accountId")).toBe("acc-bank");
    await user.click(save);

    await waitFor(() => {
      expect(hidden(form, "accountId")).toBe("");
      expect(hidden(form, "categoryId")).toBe("");
    });

    // และสิ่งที่ตาเห็นต้องตรงกับนั้น
    const nowAccount = screen.getByLabelText(/บัญชี/) as HTMLSelectElement;
    const nowCategory = screen.getByLabelText("ประเภท") as HTMLSelectElement;
    expect(nowAccount.value).toBe("");
    expect(nowCategory.value).toBe("");
  });
});
