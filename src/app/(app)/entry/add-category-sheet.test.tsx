// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActionState } from "@/actions/shared";
import { AddCategorySheet } from "./add-category-sheet";

/**
 * แผ่นเพิ่มประเภทเร็ว ที่เปิดจากฟอร์มบันทึกรายการ
 *
 * เดิมมีช่องติ๊ก "นับเป็นรายได้/รายจ่ายตอนคิดกำไร" อยู่ตรงนี้ด้วย เอาออกแล้ว
 * เพราะจังหวะที่คนกดเพิ่มประเภทคือกลางคันของการลงรายการ กำลังจะพิมพ์ยอดอยู่
 * แล้วเจอว่าไม่มีประเภทที่ต้องการ ตอนนั้นไม่มีใครหยุดคิดเรื่องนิยามของกำไร
 *
 * เทสชุดนี้มีเพราะการเอาช่องติ๊กออกมี **กับดัก** — checkbox ที่ไม่ติ๊กจะไม่ถูก
 * ส่งมาใน FormData เลย schema จึงแปลง "ไม่ส่งมา" เป็น false ถ้าตัดช่องทิ้ง
 * ดื้อๆ ประเภทใหม่ทุกอันจะกลายเป็นไม่นับเป็นกำไรโดยไม่มีใครสั่ง แล้วกำไร
 * ที่หน้าสรุปโชว์จะหายไปทีละก้อน แบบที่มองไม่ออกว่าเริ่มผิดตั้งแต่ตรงไหน
 */

const createCategory =
  vi.fn<(prev: ActionState, form: FormData) => Promise<ActionState>>();

vi.mock("@/actions/settings", () => ({
  createCategory: (p: ActionState, f: FormData) => createCategory(p, f),
}));

beforeEach(() => {
  createCategory.mockReset();
  createCategory.mockResolvedValue({ status: "ok", id: "cat-new" });

  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(cleanup);

function setup(direction: "in" | "out" = "out") {
  const onCreated = vi.fn();

  render(
    <AddCategorySheet
      open
      onClose={() => undefined}
      shopId="shop-1"
      direction={direction}
      onCreated={onCreated}
    />,
  );

  return { onCreated };
}

/** FormData ที่ฟอร์มส่งจริงตอนกดเพิ่ม */
const sent = () => createCategory.mock.calls[0][1];

describe("เพิ่มประเภทจากหน้าบันทึก", () => {
  it("ไม่มีช่องติ๊กเรื่องกำไรให้ตัดสินใจกลางคัน", () => {
    setup();

    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(screen.queryByText(/ตอนคิดกำไร/)).toBeNull();
  });

  /**
   * กฎที่สำคัญที่สุดของไฟล์นี้
   *
   * ถ้าวันหนึ่งมีคนลบช่องซ่อน counts ทิ้งเพราะดู "ไม่จำเป็น" เทสข้อนี้จะแดง
   * ก่อนที่ประเภทใหม่จะเริ่มถูกกันออกจากกำไรเงียบๆ
   */
  it("ประเภทที่เพิ่มจากตรงนี้ นับเป็นกำไรเสมอ", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/ชื่อประเภท/), "ค่าถุงพลาสติก");
    await user.click(screen.getByRole("button", { name: "เพิ่มประเภท" }));

    await waitFor(() => expect(createCategory).toHaveBeenCalled());

    // "on" คือค่าที่ schema แปลงเป็น true — ค่าอื่นรวมถึงไม่ส่งเลย กลายเป็น false
    expect(sent().get("counts")).toBe("on");
  });

  it("ฝั่งรับเข้าก็นับเป็นกำไรเหมือนกัน", async () => {
    const user = userEvent.setup();
    setup("in");

    await user.type(screen.getByLabelText(/ชื่อประเภท/), "ขายส่ง");
    await user.click(screen.getByRole("button", { name: "เพิ่มประเภท" }));

    await waitFor(() => expect(createCategory).toHaveBeenCalled());

    expect(sent().get("counts")).toBe("on");
    expect(sent().get("direction")).toBe("in");
  });

  it("ส่งชื่อกับฝั่งที่กำลังลงอยู่ไปด้วย ไม่ให้ไปโผล่ผิดฝั่ง", async () => {
    const user = userEvent.setup();
    setup("out");

    await user.type(screen.getByLabelText(/ชื่อประเภท/), "ค่าถุงพลาสติก");
    await user.click(screen.getByRole("button", { name: "เพิ่มประเภท" }));

    await waitFor(() => expect(createCategory).toHaveBeenCalled());

    expect(sent().get("name")).toBe("ค่าถุงพลาสติก");
    expect(sent().get("direction")).toBe("out");
    expect(sent().get("shopId")).toBe("shop-1");
  });

  it("สร้างเสร็จแล้วส่ง id กลับไปให้ฟอร์มเลือกไว้ให้เลย", async () => {
    const user = userEvent.setup();
    const { onCreated } = setup();

    await user.type(screen.getByLabelText(/ชื่อประเภท/), "ค่าถุงพลาสติก");
    await user.click(screen.getByRole("button", { name: "เพิ่มประเภท" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("cat-new"));
  });
});
