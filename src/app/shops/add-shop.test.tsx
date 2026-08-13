// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActionState } from "@/actions/shared";
import { AddShopButton } from "./add-shop";

/**
 * แผ่นเลื่อน "เพิ่มร้าน" — ตัวแทนของแผ่นทุกใบในแอป
 *
 * บั๊กที่เทสชุดนี้กันไว้: สถานะของ useActionState เคยอยู่นอกส่วนที่ถูก unmount
 * เลยข้ามการเปิดปิดมา ผลคือเปิดแผ่นครั้งที่สองแล้วเจอข้อความ "เพิ่มร้านแล้ว"
 * ค้างอยู่ทั้งที่ยังไม่ได้ทำอะไร และชื่อที่พิมพ์ครั้งก่อนยังอยู่ในช่อง
 * ซึ่งกดต่อไปจะได้ร้านชื่อซ้ำ
 *
 * แผ่นอื่น (บัญชี ประเภท แก้ไขร้าน แก้ไขรายการ) ใช้โครงเดียวกันเป๊ะ
 */

const createShop = vi.fn<(prev: ActionState, form: FormData) => Promise<ActionState>>();

vi.mock("@/actions/settings", () => ({
  createShop: (prev: ActionState, form: FormData) => createShop(prev, form),
}));

/**
 * happy-dom ยังไม่ได้ทำ showModal ให้ ต้องใส่ให้เอง
 * ของจริงมีพฤติกรรมมากกว่านี้ (ขังโฟกัส ปุ่ม Esc) แต่ส่วนที่เทสนี้สนใจ
 * คือแค่แผ่นเปิดอยู่หรือปิดอยู่ ซึ่งอ่านจาก dialog.open
 */
beforeEach(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };

  createShop.mockReset();
  createShop.mockResolvedValue({ status: "ok", message: "เพิ่มร้านแล้ว" });
});

afterEach(cleanup);

/**
 * ปุ่มเปิดแผ่นกับปุ่มส่งฟอร์มชื่อ "เพิ่มร้าน" เหมือนกัน จึงต้องแยกด้วยขอบเขต
 * ตัวเปิดอยู่นอกแผ่น ตัวส่งอยู่ใน <dialog>
 */
const sheet = () => within(document.querySelector("dialog") as HTMLDialogElement);

const openSheet = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    within(document.body).getAllByRole("button", { name: "เพิ่มร้าน" })[0],
  );

/** กดปุ่มส่งจริงในแผ่น ไม่ได้ยิง event เอง */
const submitSheet = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(sheet().getByRole("button", { name: "เพิ่มร้าน" }));

const sheetForm = () => document.querySelector("dialog form") as HTMLFormElement;

const nameField = () => screen.getByLabelText("ชื่อร้าน") as HTMLInputElement;

describe("แผ่นเพิ่มร้าน", () => {
  it("ยังไม่กด ฟอร์มต้องยังไม่อยู่ในหน้า", () => {
    render(<AddShopButton />);
    expect(screen.queryByLabelText("ชื่อร้าน")).toBeNull();
  });

  it("กดแล้วแผ่นเปิดพร้อมฟอร์มเปล่า", async () => {
    const user = userEvent.setup();
    render(<AddShopButton />);

    await openSheet(user);

    expect(nameField().value).toBe("");
    expect(document.querySelector("dialog")?.open).toBe(true);
  });

  it("ปุ่มส่งอยู่ในฟอร์มเดียวกับช่องชื่อ และเป็น type=submit", async () => {
    // ที่ต้องเช็คเพราะเทสข้างล่างส่งฟอร์มด้วย fireEvent ไม่ได้กดปุ่มจริง
    // ถ้าวันหนึ่งปุ่มหลุดออกไปนอก <form> เทสอื่นจะยังผ่านทั้งที่กดจริงไม่ทำงาน
    const user = userEvent.setup();
    render(<AddShopButton />);

    await openSheet(user);

    const submit = sheet().getByRole("button", { name: "เพิ่มร้าน" }) as HTMLButtonElement;
    expect(submit.type).toBe("submit");
    expect(submit.form).toBe(sheetForm());
    expect(nameField().form).toBe(sheetForm());
  });

  it("ส่งชื่อร้านไปให้ action ตรงตามที่พิมพ์", async () => {
    const user = userEvent.setup();
    render(<AddShopButton />);

    await openSheet(user);
    await user.type(nameField(), "ร้านหน้าบ้าน");
    await submitSheet(user);

    await waitFor(() => expect(createShop).toHaveBeenCalled());
    const form = createShop.mock.calls[0][1];
    expect(form.get("name")).toBe("ร้านหน้าบ้าน");
  });

  /**
   * หัวใจของเทสชุดนี้
   *
   * เพิ่มร้านสำเร็จ แผ่นปิดเอง แล้วเปิดใหม่ — ต้องเหมือนเปิดครั้งแรกทุกอย่าง
   */
  it("เพิ่มสำเร็จแล้วเปิดใหม่ ช่องต้องว่างและไม่มีข้อความค้าง", async () => {
    const user = userEvent.setup();
    render(<AddShopButton />);

    await openSheet(user);
    await user.type(nameField(), "ร้านแรก");
    await submitSheet(user);

    // ปิดเองเมื่อสำเร็จ
    await waitFor(() => expect(screen.queryByLabelText("ชื่อร้าน")).toBeNull());

    await openSheet(user);

    expect(nameField().value).toBe("");
    expect(screen.queryByText("เพิ่มร้านแล้ว")).toBeNull();
  });

  it("ทำไม่สำเร็จ แผ่นไม่ปิดและขึ้นเหตุผลให้อ่าน", async () => {
    createShop.mockResolvedValue({ status: "error", message: "ต่อฐานข้อมูลไม่ได้" });

    const user = userEvent.setup();
    render(<AddShopButton />);

    await openSheet(user);
    await user.type(nameField(), "ร้านที่พลาด");
    await submitSheet(user);

    await waitFor(() => expect(screen.getByText("ต่อฐานข้อมูลไม่ได้")).toBeTruthy());

    /**
     * ที่พิมพ์ไว้ต้องไม่หาย กดซ้ำได้เลยโดยไม่ต้องพิมพ์ใหม่
     *
     * เทสข้อนี้เคยตก — React 19 ล้างฟอร์มให้อัตโนมัติหลัง action จบ
     * ไม่ว่าจะสำเร็จหรือพลาด ซึ่งขัดกับสิ่งที่ทั้ง README และคอมเมนต์ใน
     * runAction สัญญาไว้ตรงๆ ว่า "ที่พิมพ์ไว้ไม่หาย กดซ้ำได้เลย"
     * แก้ด้วยการทำให้ทุกช่องในแผ่นเป็น controlled (ดู useKeptValue)
     */
    expect(nameField().value).toBe("ร้านที่พลาด");
  });

  it("พลาดแล้วปิดไปเอง เปิดใหม่ต้องไม่เจอข้อความผิดพลาดเดิม", async () => {
    createShop.mockResolvedValue({ status: "error", message: "ต่อฐานข้อมูลไม่ได้" });

    const user = userEvent.setup();
    render(<AddShopButton />);

    await openSheet(user);
    await user.type(nameField(), "ร้านที่พลาด");
    await submitSheet(user);
    await waitFor(() => expect(screen.getByText("ต่อฐานข้อมูลไม่ได้")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: "ปิด" }));
    await openSheet(user);

    expect(screen.queryByText("ต่อฐานข้อมูลไม่ได้")).toBeNull();
    expect(nameField().value).toBe("");
  });
});
