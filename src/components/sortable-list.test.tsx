// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortableList } from "./sortable-list";

/**
 * รายการที่ลากสลับลำดับได้
 *
 * ⚠️ เทสต์ชุดนี้ทดสอบทางคีย์บอร์ด ไม่ได้ทดสอบการลากด้วยนิ้ว
 *    jsdom คืนค่า getBoundingClientRect เป็นศูนย์ทั้งหมด ตรรกะการหาตำแหน่ง
 *    ใหม่ซึ่งเทียบนิ้วกับกึ่งกลางแถวจึงทดสอบที่นี่ไม่ได้เลย
 *    การลากจริงตรวจบนเบราว์เซอร์ที่จอ 430x932 ด้วย PointerEvent จริง
 *
 * ทางคีย์บอร์ดไม่ใช่ของแถม — คนที่ใช้โปรแกรมอ่านหน้าจอลากไม่ได้เลย
 * ถ้าทางนี้พัง ฟีเจอร์นี้จะใช้ไม่ได้กับคนกลุ่มนั้นทั้งหมดโดยไม่มีใครสังเกต
 */
const items = [
  { id: "11111111-1111-4111-8111-111111111111", name: "เงินสด" },
  { id: "22222222-2222-4222-8222-222222222222", name: "SCB" },
  { id: "33333333-3333-4333-8333-333333333333", name: "ไทยพลัส" },
];

const setup = (onReorder = vi.fn()) => {
  render(
    <SortableList
      items={items}
      onReorder={onReorder}
      labelOf={(a) => a.name}
      renderRow={(a) => <span>{a.name}</span>}
    />,
  );
  return onReorder;
};

/** ลำดับที่เห็นบนจอ อ่านจากป้ายของปุ่มลาก */
const shown = () =>
  screen
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? "")
    .map((l) => l.replace("ย้ายลำดับของ ", "").replace(" — จิ้มค้างแล้วลาก หรือใช้ลูกศรขึ้นลง", ""));

const rowFor = (name: string) =>
  screen.getByRole("button", {
    name: `ย้ายลำดับของ ${name} — จิ้มค้างแล้วลาก หรือใช้ลูกศรขึ้นลง`,
  });

afterEach(cleanup);

describe("SortableList", () => {
  it("ลูกศรลงย้ายลงหนึ่งตำแหน่ง", async () => {
    const user = userEvent.setup();
    const onReorder = setup();

    rowFor("เงินสด").focus();
    await user.keyboard("{ArrowDown}");

    expect(shown()).toEqual(["SCB", "เงินสด", "ไทยพลัส"]);
    expect(onReorder).toHaveBeenCalledWith([items[1].id, items[0].id, items[2].id]);
  });

  it("ลูกศรขึ้นย้ายขึ้นหนึ่งตำแหน่ง", async () => {
    const user = userEvent.setup();
    setup();

    rowFor("ไทยพลัส").focus();
    await user.keyboard("{ArrowUp}");

    expect(shown()).toEqual(["เงินสด", "ไทยพลัส", "SCB"]);
  });

  it("ตัวบนสุดกดขึ้นแล้วไม่หลุดออกนอกลิสต์", async () => {
    const user = userEvent.setup();
    const onReorder = setup();

    rowFor("เงินสด").focus();
    await user.keyboard("{ArrowUp}");

    expect(shown()).toEqual(["เงินสด", "SCB", "ไทยพลัส"]);
    // ไม่มีอะไรเปลี่ยน ห้ามยิงคำสั่งไปเซิร์ฟเวอร์เปล่าๆ
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("ตัวล่างสุดกดลงแล้วไม่หลุดออกนอกลิสต์", async () => {
    const user = userEvent.setup();
    const onReorder = setup();

    rowFor("ไทยพลัส").focus();
    await user.keyboard("{ArrowDown}");

    expect(shown()).toEqual(["เงินสด", "SCB", "ไทยพลัส"]);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("บอกโปรแกรมอ่านหน้าจอว่าย้ายอะไรไปตำแหน่งไหน", async () => {
    const user = userEvent.setup();
    setup();

    rowFor("เงินสด").focus();
    await user.keyboard("{ArrowDown}");

    // การที่แถวขยับไม่ได้ถูกอ่านออกมาเอง ต้องบอกเป็นข้อความ
    expect(screen.getByText("เงินสด ย้ายไปลำดับที่ 2 จาก 3")).toBeDefined();
  });

  /**
   * ตอนยังไม่ลากต้องเลื่อนหน้าจอด้วยการลากบนแถวได้ ไม่งั้นรายการยาวๆ
   * จะเลื่อนไม่ได้เลยทั้งที่ยังไม่ได้เข้าโหมดลาก
   */
  it("ตอนยังไม่ลาก แถวยอมให้เลื่อนหน้าจอในแนวตั้ง", () => {
    setup();
    expect(rowFor("เงินสด").style.touchAction).toBe("pan-y");
  });

  /**
   * ⚠️ ไม่มีเทสต์ของการจิ้มค้างแล้วลากในไฟล์นี้
   *    jsdom คืน getBoundingClientRect เป็นศูนย์ทั้งหมด และไม่มีตัวจัดการ
   *    ท่าสัมผัสจริง การจับเวลากับการห้ามเลื่อนหน้าจอจึงทดสอบที่นี่ไม่ได้เลย
   *    ตรวจบนเบราว์เซอร์จริงที่จอ 430x932 ด้วย PointerEvent จริงแทน
   */

  it("รายการจากเซิร์ฟเวอร์เปลี่ยน ลำดับบนจอตามไปด้วย", () => {
    const onReorder = vi.fn();
    const { rerender } = render(
      <SortableList
        items={items}
        onReorder={onReorder}
        labelOf={(a) => a.name}
        renderRow={(a) => <span>{a.name}</span>}
      />,
    );

    // เช่นเพิ่มบัญชีใหม่จากหน้าตั้งค่าแล้วหน้านี้ถูกวาดใหม่
    const added = [...items, { id: "44444444-4444-4444-8444-444444444444", name: "กรุงไทย" }];
    rerender(
      <SortableList
        items={added}
        onReorder={onReorder}
        labelOf={(a) => a.name}
        renderRow={(a) => <span>{a.name}</span>}
      />,
    );

    expect(shown()).toEqual(["เงินสด", "SCB", "ไทยพลัส", "กรุงไทย"]);
  });
});
