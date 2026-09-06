// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasUnsavedInput, shouldReload } from "./version";

/**
 * กติกาการรีโหลดรับรุ่นใหม่
 *
 * สิ่งที่แพงที่สุดที่พังได้ตรงนี้ไม่ใช่ "เห็นของใหม่ช้า" แต่คือ "รีโหลด
 * ตอนคนกำลังกรอกรายการ" ซึ่งทำให้ของที่พิมพ์ไว้หายทั้งหมด เทสส่วนใหญ่
 * ในไฟล์นี้จึงเป็นการยืนยันว่ามันไม่รีโหลดในจังหวะที่ไม่ควร
 */

const base = { running: "abc12345", latest: "abc12345", hasUnsavedInput: false };

describe("ตัดสินใจว่าจะรีโหลดไหม", () => {
  it("รุ่นเดียวกัน ไม่ต้องทำอะไร", () => {
    expect(shouldReload(base)).toBe(false);
  });

  it("รุ่นต่างกันและไม่มีอะไรค้าง รีโหลด", () => {
    expect(shouldReload({ ...base, latest: "def67890" })).toBe(true);
  });

  /**
   * ข้อสำคัญที่สุดของไฟล์นี้
   *
   * คนกำลังกรอกยอดขายค้างไว้แล้วสลับไปดูไลน์ พอกลับมาแล้วหน้ารีโหลด
   * ตัวเลขที่พิมพ์ไว้หายหมด ซึ่งแย่กว่าการเห็นของใหม่ช้าไปหลายเท่า
   */
  it("มีของค้างในฟอร์ม ห้ามรีโหลดแม้มีรุ่นใหม่", () => {
    expect(shouldReload({ ...base, latest: "def67890", hasUnsavedInput: true })).toBe(false);
  });

  it("เซิร์ฟเวอร์ตอบค่าว่าง ไม่รีโหลด", () => {
    expect(shouldReload({ ...base, latest: "" })).toBe(false);
    expect(shouldReload({ ...base, latest: null })).toBe(false);
    expect(shouldReload({ ...base, latest: undefined })).toBe(false);
  });

  it("หน้าไม่รู้รุ่นของตัวเอง ไม่รีโหลด", () => {
    expect(shouldReload({ ...base, running: undefined, latest: "def67890" })).toBe(false);
    expect(shouldReload({ ...base, running: "", latest: "def67890" })).toBe(false);
  });

  /** ค่าสั้นๆ แบบนี้คือค่าที่ตั้งไม่สำเร็จ ไม่ใช่รหัสรุ่นจริง */
  it("ค่าสั้นเกินไป ไม่ถือว่าเป็นรหัสรุ่น", () => {
    expect(shouldReload({ running: "abc12345", latest: "x", hasUnsavedInput: false })).toBe(false);
  });
});

describe("ตรวจว่ามีของค้างในฟอร์มไหม", () => {
  const render = (html: string) => {
    document.body.innerHTML = html;
    return document;
  };

  it("ฟอร์มว่างเปล่า ถือว่าไม่มีของค้าง", () => {
    expect(hasUnsavedInput(render(`<input type="text" value="">`))).toBe(false);
  });

  it("มีตัวอักษรอยู่ในช่อง ถือว่ามีของค้าง", () => {
    expect(hasUnsavedInput(render(`<input type="text" value="350">`))).toBe(true);
  });

  it("ช่องมีแต่เว้นวรรค ไม่ถือว่ามีของค้าง", () => {
    expect(hasUnsavedInput(render(`<input type="text" value="   ">`))).toBe(false);
  });

  it("textarea ก็นับ", () => {
    expect(hasUnsavedInput(render(`<textarea>ค่าแรงพนักงาน</textarea>`))).toBe(true);
  });

  /**
   * ช่องค้นหาไม่ใช่ของที่เสียหายถ้าหาย จึงไม่ควรไปขวางการรับรุ่นใหม่
   * ทำเครื่องหมายด้วย data-transient
   */
  it("ช่องที่ทำเครื่องหมาย data-transient ไว้ ไม่นับ", () => {
    expect(hasUnsavedInput(render(`<input type="search" value="ค่าแรง" data-transient>`))).toBe(
      false,
    );
  });

  it("checkbox กับ radio ไม่นับ เพราะ value ติดมากับ HTML อยู่แล้ว", () => {
    expect(hasUnsavedInput(render(`<input type="checkbox" value="on">`))).toBe(false);
    expect(hasUnsavedInput(render(`<input type="radio" value="in">`))).toBe(false);
  });

  it("ช่องซ่อนไม่นับ", () => {
    expect(hasUnsavedInput(render(`<input type="hidden" value="on">`))).toBe(false);
  });

  /** กำลังพิมพ์อยู่แม้ยังไม่มีตัวอักษร ก็ยังไม่ควรดึงหน้าไปจากมือ */
  it("เคอร์เซอร์อยู่ในช่องว่าง ก็ถือว่ามีของค้าง", () => {
    render(`<input type="text" value="">`);
    (document.querySelector("input") as HTMLInputElement).focus();
    expect(hasUnsavedInput(document)).toBe(true);
  });
});
