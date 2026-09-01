// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OverviewPanel } from "./panels";
import { breakdownRows } from "./breakdown-rows";

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

/** ตัวเลขกลางวง แยกจากบรรทัดสรุปข้างล่างซึ่งมีตัวเลขเดียวกัน */
const center = () =>
  document.querySelector(".pointer-events-none")?.textContent ?? "";

/** สามบรรทัดใต้วง — ชื่อ ยอด และสีของชิป ไม่มีเปอร์เซ็นต์ */
const summary = () =>
  [...document.querySelectorAll("dl > div")].map((row) => ({
    label: row.querySelector("dt")?.textContent ?? "",
    value: row.querySelectorAll("dd")[0]?.textContent ?? "",
    chip: row.querySelector("span[aria-hidden]")!.className.includes("bg-income")
      ? "เขียว"
      : "แดง",
  }));

describe("วงแหวนตอนมีกำไร", () => {
  const profit = () =>
    render(<OverviewPanel income="100000" expense="30000" profit="70000" />);

  it("โชว์กำไรสุทธิไว้กลางวง", () => {
    profit();

    expect(center()).toContain("70,000");
    expect(center()).toContain("กำไรสุทธิ");
  });

  /**
   * กฎที่สำคัญที่สุดของคอมโพเนนต์นี้ — ชิปสีต้องตรงกับส่วนโค้ง
   *
   * เคยพลาดมาแล้ว ป้ายเขียวเขียนว่า "รายรับ 20,914" ทั้งที่ส่วนโค้งเขียว
   * คือกำไรสุทธิ 3,010 คนอ่านเห็นวงเขียวนิดเดียวแล้วงงว่าทำไมรายรับดูน้อย
   * ทั้งที่ตัวเลขข้างๆ บอกว่าสองหมื่น
   *
   * รายรับคือ "ทั้งวง" ไม่ใช่ส่วนโค้งไหน จึงต้องไม่มีชิปสี
   */
  /**
   * ใต้วงมีแต่ยอด ไม่มีเปอร์เซ็นต์
   *
   * เคยใส่แล้วสับสนสองรอบ เพราะบรรทัดที่เป็น "ทั้งวง" กับบรรทัดที่เป็น
   * ส่วนโค้งใช้ฐานคนละตัว คนอ่านเห็น 26% ข้างรายจ่ายแล้วนึกว่าจ่ายไป 26%
   * ทั้งที่ 26% คือก้อนที่ขาด เอาออกหมดแล้วเหลือที่เดียวคือกลางวง
   */
  it("ใต้วงมีแต่ยอด ไม่มีเปอร์เซ็นต์ให้สับสน", () => {
    profit();

    expect(summary()).toEqual([
      { label: "รายรับ", value: "100,000", chip: "เขียว" },
      { label: "รายจ่าย", value: "30,000", chip: "แดง" },
      { label: "กำไรสุทธิ", value: "70,000", chip: "เขียว" },
    ]);

    expect(document.querySelector("dl")?.textContent).not.toContain("%");
  });

  /**
   * สามบรรทัดต้องบวกลบกันลงตัว เพราะคนอ่านจะลองคิดตามด้วยตา
   * บรรทัดแรกลบบรรทัดสอง ต้องเท่าบรรทัดสาม
   */
  it("สามบรรทัดบวกลบกันได้ลงตัว", () => {
    profit();

    const [whole, out, left] = summary().map((r) => Number(r.value.replace(/,/g, "")));
    expect(whole - out).toBe(left);
  });

  /**
   * ทุกก้อนต้องมีชื่อกับยอดกำกับ ห้ามเหลือแต่วงเปล่าๆ
   *
   * เขียวกับแดงเป็นคู่ที่คนตาบอดสีแยกไม่ออก ถ้าวงบอกด้วยสีอย่างเดียว
   * คนกลุ่มนั้นอ่านภาพไม่ได้เลย — กติกาเดียวกับทั้งแอป
   */
  it("ทุกบรรทัดมีชื่อกับยอดกำกับ ไม่เหลือแต่วงเปล่า", () => {
    profit();

    for (const row of summary()) {
      expect(row.label).not.toBe("");
      expect(row.value).not.toBe("");
    }
  });

  /**
   * ไม่มีเปอร์เซ็นต์ที่ไหนเลยในการ์ดนี้
   *
   * ผลรวมของวง (รายรับบวกรายจ่าย) ไม่ได้แปลว่าอะไร เปอร์เซ็นต์ที่คิดจากมัน
   * จึงเป็นตัวเลขที่ไม่มีความหมาย ส่วนตัวเลขจริงอยู่ครบในสามบรรทัดใต้วงแล้ว
   */
  it("ไม่มีเปอร์เซ็นต์ในการ์ดภาพรวมเลย", () => {
    profit();

    expect(center()).not.toContain("%");
    expect(document.querySelector("dl")?.textContent).not.toContain("%");
  });

  /**
   * กฎที่สำคัญที่สุดของวงนี้ — เขียวคือรายรับ แดงคือรายจ่าย เทียบกันตรงๆ
   *
   * รายรับ 100,000 กับรายจ่าย 30,000 เขียวจึงกินราวสามในสี่ของวง
   *
   * ⚠️ เคยทำเป็น วง = รายรับ แล้วให้เขียวเป็นกำไรสุทธิ ซึ่งทำให้เขียวเล็ก
   *    กว่าแดงทั้งที่ขายได้มากกว่าจ่าย เจ้าของร้านอ่านผิดสามครั้งติด
   *    ห้ามเปลี่ยนกลับ
   */
  it("เขียวคือรายรับ ยาวกว่าแดงเมื่อขายได้มากกว่าจ่าย", () => {
    profit();

    const [green, red] = arcs().map((a) =>
      Number(a.getAttribute("stroke-dasharray")?.split(" ")[0]),
    );

    expect(green).toBeGreaterThan(red);

    // 100,000 จาก 130,000 = 77% หักร่องแล้วยังต้องอยู่แถวๆ นั้น
    expect(green).toBeGreaterThan(73);
    expect(green).toBeLessThan(77);
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
  const loss = () => render(<OverviewPanel income="40000" expense="100000" profit="-60000" />);

  it("โชว์ขาดทุนสุทธิไว้กลางวง", () => {
    loss();

    expect(center()).toContain("-60,000");
    expect(center()).toContain("ขาดทุนสุทธิ");
  });

  /**
   * ตอนขาดทุนวงคือรายจ่าย บรรทัดแรกจึงต้องเป็นรายจ่าย ไม่ใช่รายรับ
   * และชิปสียังต้องตรงกับส่วนโค้งเหมือนเดิม
   */
  /**
   * ลำดับบรรทัดคงที่ทุกเดือน — รายรับ → รายจ่าย → สุทธิ
   * คนที่ดูภาพนี้ทุกวันจึงหาตัวเลขจากตำแหน่งเดิมได้เสมอ ไม่ว่ากำไรหรือขาดทุน
   */
  it("ลำดับบรรทัดเหมือนเดือนที่กำไรเป๊ะ", () => {
    loss();

    expect(summary()).toEqual([
      { label: "รายรับ", value: "40,000", chip: "เขียว" },
      { label: "รายจ่าย", value: "100,000", chip: "แดง" },
      { label: "ขาดทุนสุทธิ", value: "-60,000", chip: "แดง" },
    ]);
  });

  it("ไม่มีส่วนโค้งไหนยาวเกินหนึ่งวง", () => {
    loss();

    for (const arc of arcs()) {
      const [length, gap] = (arc.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
      expect(length).toBeLessThanOrEqual(100);
      expect(length + gap).toBeCloseTo(100, 6);
    }
  });

  /** ขายได้น้อยกว่าจ่าย แดงต้องยาวกว่าเขียว อ่านออกทันทีว่าเดือนนี้แย่ */
  it("แดงยาวกว่าเขียวเมื่อจ่ายมากกว่าขาย", () => {
    loss();

    const [green, red] = arcs().map((a) =>
      Number(a.getAttribute("stroke-dasharray")?.split(" ")[0]),
    );

    expect(red).toBeGreaterThan(green);

    // 40,000 จาก 140,000 = 29%
    expect(green).toBeGreaterThan(26);
    expect(green).toBeLessThan(30);
  });
});

describe("ช่วงที่ยังไม่มีเงินเดินเลย", () => {
  it("ไม่วาดส่วนโค้ง แต่ยังบอกยอดศูนย์ตามตรง", () => {
    render(<OverviewPanel income="0" expense="0" profit="0" />);

    expect(arcs()).toHaveLength(0);
    expect(center()).toContain("กำไรสุทธิ");
    expect(summary().map((r) => r.value)).toEqual(["0", "0", "0"]);
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
    const rows = breakdownRows([cat("a", "ค่าแรง", "5000"), cat("b", "ค่าของ", "5000")], "10000");

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

    const rows = breakdownRows(many, "9000");
    const sum = rows.reduce((total, r) => total + Number.parseFloat(r.total), 0);

    expect(rows).toHaveLength(7);
    expect(rows[6].name).toBe("อีก 3 ประเภท");
    expect(rows[6].total).toBe("3000");
    expect(sum).toBe(9000);
  });

  it("หกประเภทพอดี ไม่มีบรรทัดรวบ", () => {
    const six = Array.from({ length: 6 }, (_, i) => cat(`c${i}`, `ประเภท ${i}`, "1000"));

    expect(breakdownRows(six, "6000")).toHaveLength(6);
  });

  it("ยังไม่มีรายจ่าย ไม่หารด้วยศูนย์จนได้ NaN", () => {
    const rows = breakdownRows([cat("a", "ค่าแรง", "0")], "0");

    expect(rows[0].percent).toBe(0);
  });

  it("กลุ่มไม่ระบุประเภทก็อยู่ในลิสต์ได้ ไม่ชนกุญแจกับใคร", () => {
    const rows = breakdownRows(
      [{ categoryId: null, name: "ไม่ระบุประเภท", total: "500" }],
      "500",
    );

    expect(rows[0].key).toBe("none-ไม่ระบุประเภท");
    expect(rows[0].percent).toBe(100);
  });
});
