import { describe, expect, it } from "vitest";
import { isTransactionPooler, poolOptions, portOf } from "./pool";

/**
 * ค่าต่อฐานข้อมูลตามประตูที่ใช้
 *
 * เทสนี้มีอยู่เพราะค่าเดียวที่ตั้งผิดทำให้แอปค้างทั้งใบโดยไม่มี error ให้เห็น
 * และเป็นค่าที่ "ดูสมเหตุสมผล" จนมีคนตั้งผิดมาแล้วครั้งหนึ่ง
 */

describe("แยกประตูจากพอร์ต", () => {
  it("6543 คือ transaction pooler", () => {
    expect(isTransactionPooler("6543")).toBe(true);
  });

  it("5432 ไม่ใช่", () => {
    expect(isTransactionPooler("5432")).toBe(false);
  });

  it("อ่านพอร์ตจาก connection string ได้", () => {
    expect(portOf("postgresql://u:p@host:6543/db")).toBe("6543");
    expect(portOf("postgresql://u:p@host:5432/db")).toBe("5432");
  });

  it("อ่าน URL ไม่ออกก็ไม่พัง", () => {
    expect(portOf("ไม่ใช่ url")).toBe("");
    expect(poolOptions(portOf("ไม่ใช่ url")).max).toBe(10);
  });
});

describe("prepared statement", () => {
  /**
   * pgBouncer โหมด transaction ไม่รองรับ ถ้าเปิดไว้จะเจอ
   * "prepared statement already exists" แบบสุ่มๆ ซึ่งตามยากมาก
   */
  it("ปิดเมื่อผ่าน transaction pooler", () => {
    expect(poolOptions("6543").prepare).toBe(false);
  });

  it("เปิดเมื่อต่อแบบ session", () => {
    expect(poolOptions("5432").prepare).toBe(true);
  });
});

describe("จำนวน connection", () => {
  /**
   * ⚠️ ข้อสำคัญที่สุดในไฟล์นี้
   *
   * เคยตั้ง max เป็น 1 สำหรับ transaction pooler ด้วยเหตุผลว่า pooler
   * จัดคิวให้อยู่แล้ว ผลคือ postgres.js ยัดหลาย query ลง connection เดียว
   * แบบ pipeline ซึ่ง pgBouncer โหมด transaction รับไม่ได้ แล้วล็อกตาย
   *
   * ทุกหน้าในแอปยิง query ขนานกันด้วย Promise.all จึงค้างทุกหน้า
   * วัดกับฐานจริงแล้ว max 1 ค้างเกิน 20 วินาที ส่วน max 4 ผ่านใน 1 วินาที
   */
  it("transaction pooler ต้องมากกว่า 1 ไม่งั้น Promise.all ค้าง", () => {
    expect(poolOptions("6543").max).toBeGreaterThan(1);
  });

  it("แต่ก็ไม่มากจนกินโควตาของ pooler", () => {
    expect(poolOptions("6543").max).toBeLessThanOrEqual(5);
  });

  it("แบบ session เปิดได้มากกว่า เพราะถือ connection ของตัวเอง", () => {
    expect(poolOptions("5432").max).toBe(10);
  });
});
