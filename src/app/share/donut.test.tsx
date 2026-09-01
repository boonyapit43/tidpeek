// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NetDonut } from "./donut";
import { spendRows } from "./spend-rows";

/**
 * วงแหวนรายรับ–รายจ่าย บนภาพที่ตั้งใจส่งให้เจ้าของร้านอ่าน
 *
 * ภาพนี้ไปอยู่ในแชทแล้วอธิบายตัวเองไม่ได้ ถ้าตัวเลขบนภาพขัดกันเองสักคู่
 * คนรับไม่มีทางตรวจสอบ เทสชุดนี้จึงคุมสองอย่าง — ความหมายของวงตอนกำไร
 * กับตอนขาดทุน และการที่ทุกก้อนมีชื่อกับยอดกำกับเสมอ
 */
afterEach(cleanup);

const ring = () => document.querySelector("svg[role=img]") as SVGElement;
const arcs = () =>
  [...ring().querySelectorAll("circle")].filter((c) => c.getAttribute("pathLength") === "100");

describe("วงแหวนตอนมีกำไร", () => {
  const profit = () =>
    render(<NetDonut income="100000" expense="30000" profit="70000" />);

  it("โชว์กำไรสุทธิไว้กลางวง", () => {
    profit();

    expect(screen.getByText("70,000")).toBeTruthy();
    expect(screen.getByText("กำไรสุทธิ")).toBeTruthy();
  });

  /**
   * ทุกก้อนต้องมีชื่อกับยอดกำกับ ห้ามเหลือแต่วงเปล่าๆ
   *
   * เขียวกับแดงเป็นคู่ที่คนตาบอดสีแยกไม่ออก ถ้าวงบอกด้วยสีอย่างเดียว
   * คนกลุ่มนั้นอ่านภาพไม่ได้เลย — กติกาเดียวกับทั้งแอป
   */
  it("มีชื่อกับยอดของทั้งรายรับและรายจ่ายกำกับไว้", () => {
    profit();

    expect(screen.getByText("รายรับ")).toBeTruthy();
    expect(screen.getByText("100,000")).toBeTruthy();
    expect(screen.getByText("รายจ่าย")).toBeTruthy();
    expect(screen.getByText("30,000")).toBeTruthy();
  });

  /**
   * วง = รายรับ ชิ้นแดง = รายจ่าย
   * รายจ่าย 30,000 จากรายรับ 100,000 คือ 30% ของวง
   */
  it("ส่วนโค้งของรายจ่ายกินพื้นที่ตามสัดส่วนของรายรับ", () => {
    profit();

    const [expenseArc] = arcs();
    const length = Number(expenseArc.getAttribute("stroke-dasharray")?.split(" ")[0]);

    // หักร่องระหว่างสองชิ้นออกแล้ว ยังต้องอยู่แถวๆ 30%
    expect(length).toBeGreaterThan(27);
    expect(length).toBeLessThan(30);
  });

  it("อ่านออกด้วยเสียงได้ครบทั้งสามตัวเลข", () => {
    profit();

    const label = ring().getAttribute("aria-label") ?? "";
    expect(label).toContain("100,000");
    expect(label).toContain("30,000");
    expect(label).toContain("70,000");
  });
});

describe("วงแหวนตอนขาดทุน", () => {
  /**
   * เดือนที่จ่ายมากกว่าขาย วงต้องเป็นรายจ่าย ไม่ใช่รายรับ
   *
   * ถ้าตรึงวงไว้ที่รายรับเสมอ ชิ้นแดงจะยาวเกินหนึ่งวงแล้ววนไปทับตัวเอง
   * ซึ่งวาดออกมาแล้วอ่านไม่ได้ความ และดูเหมือนจ่ายไปแค่นิดเดียว
   */
  const loss = () => render(<NetDonut income="40000" expense="100000" profit="-60000" />);

  it("โชว์ขาดทุนสุทธิไว้กลางวง", () => {
    loss();

    expect(screen.getByText("-60,000")).toBeTruthy();
    expect(screen.getByText("ขาดทุนสุทธิ")).toBeTruthy();
  });

  it("ไม่มีส่วนโค้งไหนยาวเกินหนึ่งวง", () => {
    loss();

    for (const arc of arcs()) {
      const [length, gap] = (arc.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
      expect(length).toBeLessThanOrEqual(100);
      expect(length + gap).toBeCloseTo(100, 6);
    }
  });

  it("ส่วนโค้งของรายรับกินพื้นที่ตามสัดส่วนของรายจ่าย", () => {
    loss();

    // ขายมา 40,000 จากที่จ่ายไป 100,000 = 40% ของวง
    const [incomeArc] = arcs();
    const length = Number(incomeArc.getAttribute("stroke-dasharray")?.split(" ")[0]);

    expect(length).toBeGreaterThan(37);
    expect(length).toBeLessThan(40);
  });
});

describe("ช่วงที่ยังไม่มีเงินเดินเลย", () => {
  it("ไม่วาดส่วนโค้ง แต่ยังบอกยอดศูนย์ตามตรง", () => {
    render(<NetDonut income="0" expense="0" profit="0" />);

    expect(arcs()).toHaveLength(0);
    expect(screen.getByText("กำไรสุทธิ")).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */

/**
 * ลิสต์ "ใช้ไปกับอะไร"
 *
 * กฎเดียวที่ห้ามพลาด — ผลบวกของลิสต์ต้องเท่ายอดรายจ่ายที่วงบอกเสมอ
 * สองตัวเลขนี้อยู่ห่างกันไม่ถึงนิ้วบนภาพเดียวกัน ถ้าเล่าคนละเรื่อง
 * คนรับจะเลิกเชื่อทั้งภาพ
 */
describe("ลิสต์ว่าเงินไปกับอะไร", () => {
  const cat = (id: string, name: string, total: string) => ({
    categoryId: id,
    name,
    total,
  });

  it("คิดสัดส่วนจากยอดรายจ่ายรวม ไม่ใช่จากผลบวกของลิสต์", () => {
    const rows = spendRows([cat("a", "ค่าแรง", "5000"), cat("b", "ค่าของ", "5000")], "10000");

    expect(rows.map((r) => r.percent)).toEqual([50, 50]);
  });

  /**
   * ประเภทที่เกินโควตาถูก "รวบ" ไม่ใช่ "ตัดทิ้ง"
   *
   * ตัดทิ้งเฉยๆ แล้วผลบวกของลิสต์จะน้อยกว่ายอดรายจ่ายที่วงบอก
   * ซึ่งคนอ่านจะบวกเลขตามแล้วเจอว่าไม่ตรง
   */
  it("เกินหกประเภท รวบส่วนที่เหลือเป็นบรรทัดเดียว ยอดยังครบ", () => {
    const many = Array.from({ length: 9 }, (_, i) => cat(`c${i}`, `ประเภท ${i}`, "1000"));

    const rows = spendRows(many, "9000");
    const sum = rows.reduce((total, r) => total + Number.parseFloat(r.total), 0);

    expect(rows).toHaveLength(7);
    expect(rows[6].name).toBe("อีก 3 ประเภท");
    expect(rows[6].total).toBe("3000");
    expect(sum).toBe(9000);
  });

  it("หกประเภทพอดี ไม่มีบรรทัดรวบ", () => {
    const six = Array.from({ length: 6 }, (_, i) => cat(`c${i}`, `ประเภท ${i}`, "1000"));

    expect(spendRows(six, "6000")).toHaveLength(6);
  });

  it("ยังไม่มีรายจ่าย ไม่หารด้วยศูนย์จนได้ NaN", () => {
    const rows = spendRows([cat("a", "ค่าแรง", "0")], "0");

    expect(rows[0].percent).toBe(0);
  });

  it("กลุ่มไม่ระบุประเภทก็อยู่ในลิสต์ได้ ไม่ชนกุญแจกับใคร", () => {
    const rows = spendRows(
      [{ categoryId: null, name: "ไม่ระบุประเภท", total: "500" }],
      "500",
    );

    expect(rows[0].key).toBe("none-ไม่ระบุประเภท");
    expect(rows[0].percent).toBe(100);
  });
});
