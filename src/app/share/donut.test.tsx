// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NetDonut } from "./donut";
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

/** บรรทัดสรุปใต้วง คู่ [ชื่อ, ยอด, เปอร์เซ็นต์] และมีชิปสีไหม */
const summary = () =>
  [...document.querySelectorAll("dl > div")].map((row) => ({
    label: row.querySelector("dt")?.textContent ?? "",
    value: row.querySelectorAll("dd")[0]?.textContent ?? "",
    percent: row.querySelectorAll("dd")[1]?.textContent ?? "",
    chip: row.querySelector("span[aria-hidden]")?.className.includes("bg-")
      ? row.querySelector("span[aria-hidden]")!.className.includes("bg-income")
        ? "เขียว"
        : "แดง"
      : null,
  }));

describe("วงแหวนตอนมีกำไร", () => {
  const profit = () =>
    render(<NetDonut income="100000" expense="30000" profit="70000" />);

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
  it("ชิปสีตรงกับส่วนโค้ง รายรับที่เป็นทั้งวงไม่มีชิป", () => {
    profit();

    expect(summary()).toEqual([
      { label: "รายรับ", value: "100,000", percent: "", chip: null },
      { label: "รายจ่าย", value: "30,000", percent: "30%", chip: "แดง" },
      { label: "กำไรสุทธิ", value: "70,000", percent: "70%", chip: "เขียว" },
    ]);
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
  it("ทุกส่วนโค้งมีชื่อกับยอดกำกับ ไม่เหลือแต่วงเปล่า", () => {
    profit();

    const labelled = summary().filter((r) => r.chip !== null);
    expect(labelled).toHaveLength(arcs().length);
    for (const row of labelled) {
      expect(row.label).not.toBe("");
      expect(row.value).not.toBe("");
    }
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

    expect(center()).toContain("-60,000");
    expect(center()).toContain("ขาดทุนสุทธิ");
  });

  /**
   * ตอนขาดทุนวงคือรายจ่าย บรรทัดแรกจึงต้องเป็นรายจ่าย ไม่ใช่รายรับ
   * และชิปสียังต้องตรงกับส่วนโค้งเหมือนเดิม
   */
  it("ทั้งวงคือรายจ่าย ชิปสียังตรงกับส่วนโค้ง", () => {
    loss();

    expect(summary()).toEqual([
      { label: "รายจ่าย", value: "100,000", percent: "", chip: null },
      { label: "รายรับ", value: "40,000", percent: "40%", chip: "เขียว" },
      { label: "ขาดทุนสุทธิ", value: "-60,000", percent: "60%", chip: "แดง" },
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
