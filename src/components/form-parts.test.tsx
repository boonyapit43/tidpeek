// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmitButton } from "./form-parts";

/**
 * ล็อกกันกดซ้ำของปุ่มส่งฟอร์ม — จุดที่เคยพังแบบเงียบที่สุดของแอป
 *
 * SubmitButton สัญญาว่า "ล็อกปุ่มระหว่างส่ง" แต่เวอร์ชันแรกวาง {...props}
 * ไว้หลัง disabled={pending} ฟอร์มไหนส่ง disabled ของตัวเองมา (เช่นปุ่ม
 * บันทึกที่รอให้กรอกครบ) จะทับล็อกพอดี — ระหว่างกำลังบันทึก ช่องยังกรอกครบ
 * ปุ่มจึงกดซ้ำได้ แล้วเน็ตช้าบนมือถือคือสถานการณ์ที่คนกดซ้ำจริงๆ
 * ผลคือรายการเงินซ้ำสองบรรทัดโดยไม่มีใครเห็นตอนเกิด
 *
 * เทสนี้ใช้ action ที่ค้างไม่จบ เพื่อตรึงสถานะ pending ไว้ให้ตรวจได้จริง
 * ไม่ใช่แค่เช็คว่า prop ถูกส่งไปครบ
 */

afterEach(cleanup);

/** action ที่รับไว้แล้วไม่ตอบอะไรกลับเลย — จำลองเน็ตมือถือที่ค้าง */
const hangs = () => new Promise<void>(() => {});

describe("SubmitButton ระหว่างฟอร์มกำลังส่ง", () => {
  it("ล็อกตัวเองเสมอ แม้ฟอร์มจะส่ง disabled={false} มาทับ", async () => {
    const user = userEvent.setup();

    render(
      <form action={hangs}>
        <SubmitButton disabled={false}>บันทึกรายการ</SubmitButton>
      </form>,
    );

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    await user.click(button);

    // ปุ่มต้องล็อกและเปลี่ยนป้ายเป็นกำลังบันทึก ตราบใดที่ action ยังไม่ตอบ
    await waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain("กำลังบันทึก");
    });
  });

  it("disabled จากฝั่งฟอร์ม (ยังกรอกไม่ครบ) ยังทำงานตามปกติ", () => {
    render(
      <form action={hangs}>
        <SubmitButton disabled>บันทึกรายการ</SubmitButton>
      </form>,
    );

    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
