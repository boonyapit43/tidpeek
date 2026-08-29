// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoadMore } from "./load-more";
import { MAX_ROWS, PAGE_SIZE } from "@/lib/paging";

/**
 * ท้ายลิสต์ยาว
 *
 * เทสชุดนี้คุมเรื่องเดียว — **ห้ามให้ลิสต์ที่ยังไม่ครบดูเหมือนครบ**
 *
 * ของเดิมหน้าบัญชีตัดที่ 60 แล้วหยุดเฉยๆ วัดจริงที่ข้อมูล 75 วันพบว่าจริงมี
 * 128 รายการ คนเลื่อนจนสุดแล้วสรุปว่าไม่มีรายการเก่ากว่านี้ ซึ่งเป็นการเข้าใจ
 * ผิดเรื่องเงินที่ไม่มีทางรู้ตัว เพราะหน้าจอไม่ได้โกหกตรงๆ แค่ไม่พูด
 */
afterEach(cleanup);

describe("ท้ายลิสต์บอกความจริงเสมอ", () => {
  it("ยังมีอีก บอกว่าเห็นเท่าไหร่จากทั้งหมดเท่าไหร่", () => {
    render(<LoadMore shown={50} total={128} href="?n=100" />);

    expect(screen.getByText(/แสดง 50 จาก 128 รายการ/)).toBeTruthy();
  });

  it("ยังมีอีก มีปุ่มให้กดดูต่อ พร้อมบอกว่าจะได้เพิ่มกี่รายการ", () => {
    render(<LoadMore shown={50} total={128} href="?n=100" />);

    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.textContent).toContain("ดูเพิ่มอีก 50 รายการ");
    expect(link.getAttribute("href")).toBe("?n=100");
  });

  /**
   * ชุดสุดท้ายบอกจำนวนที่เหลือจริง ไม่ใช่ขนาดชุดเต็ม
   *
   * "ดูเพิ่มอีก 50 รายการ" ทั้งที่เหลือ 28 คือการสัญญาเกินจริง แล้วพอกดแล้ว
   * ได้ไม่ครบตามที่เขียน คนจะเริ่มไม่เชื่อตัวเลขอื่นบนหน้าเดียวกันด้วย
   */
  it("ชุดสุดท้าย บอกจำนวนที่เหลือจริง", () => {
    render(<LoadMore shown={100} total={128} href="?n=150" />);

    expect(screen.getByRole("link").textContent).toContain("ดูเพิ่มอีก 28 รายการ");
  });

  /**
   * ครบแล้วต้องพูดว่าครบ ไม่ใช่แค่เอาปุ่มออก
   *
   * "ไม่มีปุ่มแล้ว" ตีความได้สองอย่าง — ครบแล้ว หรือระบบพัง
   */
  it("ครบแล้ว ปุ่มหาย และบอกว่าครบ", () => {
    render(<LoadMore shown={128} total={128} href="?n=150" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/ครบทั้ง 128 รายการแล้ว/)).toBeTruthy();
  });

  /**
   * ลิสต์สั้นไม่ต้องมีอะไรเลย จำนวนเห็นได้จากการเลื่อนอยู่แล้ว
   * บรรทัด "ครบทั้ง 3 รายการแล้ว" ใต้ลิสต์สามบรรทัดคือเสียงรบกวน
   */
  it("ลิสต์สั้นกว่าหนึ่งชุด ไม่แสดงอะไรเลย", () => {
    const { container } = render(<LoadMore shown={3} total={3} href="?n=100" />);
    expect(container.innerHTML).toBe("");
  });

  it("ยาวพอดีหนึ่งชุดแต่ไม่มีอีก ก็ยังเงียบ", () => {
    const { container } = render(
      <LoadMore shown={PAGE_SIZE} total={PAGE_SIZE} href="?n=100" />,
    );
    expect(container.innerHTML).toBe("");
  });

  /**
   * ถึงเพดานแล้วยังไม่ครบ — ต้องบอกทางออก ไม่ใช่ปล่อยให้กดปุ่มที่ไม่ทำอะไร
   */
  it("ชนเพดาน บอกว่าเหลือเท่าไหร่และให้ไปใช้ Excel", () => {
    render(<LoadMore shown={MAX_ROWS} total={MAX_ROWS + 240} href="?n=1050" />);

    expect(screen.queryByRole("link")).toBeNull();

    // ข้อความอยู่ย่อหน้าเดียว จับทั้งก้อนทีเดียวไม่ให้ชนกับบรรทัดนับข้างล่าง
    const note = screen.getByText(/แสดงได้สูงสุด/);
    expect(note.textContent).toContain("240");
    expect(note.textContent).toContain("Excel");
  });

  it("ตัวเลขหลักพันมีคอมมาคั่น อ่านออกด้วยตาเดียว", () => {
    render(<LoadMore shown={50} total={12345} href="?n=100" />);

    expect(screen.getByText(/แสดง 50 จาก 12,345 รายการ/)).toBeTruthy();
  });
});
