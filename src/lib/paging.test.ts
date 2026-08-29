import { describe, expect, it } from "vitest";
import { MAX_ROWS, PAGE_SIZE, moreHref, rowsToShow } from "./paging";

/**
 * กติกาการแบ่งลิสต์ยาว
 *
 * ค่าที่คุมอยู่มาจาก URL ซึ่งแก้เองได้ เทสชุดนี้จึงเน้นที่ค่าประหลาดๆ มากกว่า
 * ค่าปกติ — ลิสต์เงินที่โหลดผิดจำนวนแปลว่าคนอ่านตัวเลขผิด
 */
describe("จำนวนแถวที่จะแสดง", () => {
  it("ไม่มี n ในลิงก์ ได้ชุดแรก", () => {
    expect(rowsToShow(undefined)).toBe(PAGE_SIZE);
  });

  it("กดดูเพิ่มหนึ่งครั้ง ได้สองชุด", () => {
    expect(rowsToShow("100")).toBe(100);
  });

  /**
   * ค่าที่ไม่ลงตัวถูกปัดขึ้นเป็นชุดเต็ม
   *
   * ?n=53 ที่พิมพ์มั่วหรือมาจากลิงก์เก่า ไม่ควรทำให้เกิดลิสต์ 53 แถวซึ่งเป็น
   * สถานะที่กดปุ่มปกติไม่มีทางไปถึง แล้วกดดูเพิ่มต่อได้เป็น 103, 153 ไปเรื่อยๆ
   */
  it("ค่าที่ไม่ลงตัว ปัดขึ้นเป็นชุดเต็ม", () => {
    expect(rowsToShow("53")).toBe(100);
    expect(rowsToShow("101")).toBe(150);
  });

  it("ค่าที่ไม่ใช่ตัวเลข ตกกลับมาชุดแรก", () => {
    expect(rowsToShow("abc")).toBe(PAGE_SIZE);
    expect(rowsToShow("")).toBe(PAGE_SIZE);
    expect(rowsToShow("1e9")).toBe(PAGE_SIZE);
  });

  it("ค่าติดลบหรือศูนย์ ตกกลับมาชุดแรก", () => {
    expect(rowsToShow("-500")).toBe(PAGE_SIZE);
    expect(rowsToShow("0")).toBe(PAGE_SIZE);
  });

  /**
   * เพดานสูงสุด — กันคนแก้ URL ให้ลากทั้งฐานข้อมูลมาวาดในหน้าเดียว
   * ซึ่งบนมือถือคือหน้าค้างจนต้องปิดแอป
   */
  it("ค่ามหาศาล ถูกกดลงมาที่เพดาน", () => {
    expect(rowsToShow("999999")).toBe(MAX_ROWS);
    expect(rowsToShow(String(Number.MAX_SAFE_INTEGER))).toBe(MAX_ROWS);
  });
});

describe("ลิงก์ของชุดถัดไป", () => {
  /**
   * ตัวกรองเดิมต้องติดไปด้วยทุกตัว
   *
   * ถ้าหลุด คนที่กรองเฉพาะรายจ่ายแล้วกดดูเพิ่ม จะได้ทุกรายการปนกลับมา
   * ซึ่งดูเผินๆ เหมือนโหลดสำเร็จ แต่ตัวเลขที่เห็นเป็นคนละชุดกับที่กรองไว้
   */
  it("คงพารามิเตอร์เดิมไว้ครบ เปลี่ยนแค่ n", () => {
    const href = moreHref(new URLSearchParams({ q: "ค่าแรง", d: "out" }), 50);
    const out = new URLSearchParams(href.slice(1));

    expect(out.get("q")).toBe("ค่าแรง");
    expect(out.get("d")).toBe("out");
    expect(out.get("n")).toBe("100");
  });

  it("ทับ n เดิม ไม่ใช่ต่อท้ายจนมีสองตัว", () => {
    const href = moreHref(new URLSearchParams({ a: "acc-1", n: "50" }), 50);
    const out = new URLSearchParams(href.slice(1));

    expect(out.getAll("n")).toEqual(["100"]);
  });

  it("นับต่อจากจำนวนที่แสดงอยู่จริง ไม่ใช่จากค่าใน URL", () => {
    // ลิสต์มี 63 แถวแล้วโหลดครบพอดี กดต่อต้องขอ 113 ไม่ใช่ 100
    const href = moreHref(new URLSearchParams({ n: "50" }), 63);
    expect(new URLSearchParams(href.slice(1)).get("n")).toBe("113");
  });
});
