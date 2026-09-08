// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveImageButton } from "./save-image";

/**
 * ปุ่มบันทึกการ์ดสรุปเป็นไฟล์ภาพ
 *
 * ⚠️ เทสต์ชุดนี้ไม่ได้ทดสอบการแปลงเป็นภาพจริง
 *    html-to-image วาดผ่าน SVG foreignObject ซึ่ง jsdom ไม่มีตัววาดภาพเลย
 *    การแปลงจริงตรวจบนเบราว์เซอร์ที่ production build — ได้ไฟล์ PNG 813x1783
 *    ตัวหนังสือไทยขึ้นครบ (ฟอนต์ถูกฝังสำเร็จ) ใช้เวลาราว 2 วินาที
 *
 * ที่ทดสอบตรงนี้คือสิ่งที่พังได้เงียบที่สุด — ปุ่มหากล่องเป้าหมายไม่เจอ
 * ซึ่งเกิดทันทีที่ id ของการ์ดกับที่ส่งให้ปุ่มไม่ตรงกัน แล้วจะไม่มีอะไรเกิดขึ้น
 * เลยตอนกด ถ้าไม่ขึ้นข้อความบอก เจ้าของร้านจะกดซ้ำไปเรื่อยๆ โดยไม่รู้สาเหตุ
 */
afterEach(cleanup);

describe("SaveImageButton", () => {
  it("หากล่องเป้าหมายไม่เจอ ต้องบอกให้เห็น ไม่ใช่เงียบ", async () => {
    const user = userEvent.setup();
    render(<SaveImageButton targetId="ไม่มีอยู่จริง" fileName="ทดสอบ" />);

    await user.click(screen.getByRole("button", { name: /บันทึกภาพ/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });

  it("ยังไม่ได้กด ต้องไม่มีข้อความผิดพลาดค้างอยู่", () => {
    render(<SaveImageButton targetId="share-card" fileName="ทดสอบ" />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /บันทึกภาพ/ })).toBeDefined();
  });
});
