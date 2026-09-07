import { describe, expect, it } from "vitest";
import { coverCrop, IMAGE_SIZE } from "./image";
import { createShopSchema, updateShopSchema } from "./validation";

/**
 * การตัดรูปให้เป็นจัตุรัส
 *
 * ผิดแล้วเห็นชัดมาก — รูปยืดจนหน้าคนแบน หรือตัดโดนหัวขาด
 * และเป็นเลขที่ทดสอบง่ายกว่ามานั่งดูรูปทีละใบเยอะ
 */
describe("ตัดรูปเป็นจัตุรัสจากกลางภาพ", () => {
  it("รูปแนวนอน ตัดข้างซ้ายขวาเท่ากัน", () => {
    // 400×300 → จัตุรัส 300 เหลือส่วนเกินแนวนอน 100 แบ่งข้างละ 50
    expect(coverCrop(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 });
  });

  it("รูปแนวตั้ง ตัดบนล่างเท่ากัน", () => {
    expect(coverCrop(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 });
  });

  it("รูปจัตุรัสอยู่แล้ว ไม่ตัดอะไร", () => {
    expect(coverCrop(512, 512)).toEqual({ sx: 0, sy: 0, size: 512 });
  });

  it("ด้านคี่ก็ยังได้จำนวนเต็ม ไม่ได้ทศนิยมไปให้ canvas", () => {
    const c = coverCrop(101, 50);
    expect(Number.isInteger(c.sx)).toBe(true);
    expect(Number.isInteger(c.sy)).toBe(true);
  });

  it("เก็บที่ 128px พอสำหรับที่โชว์จริง 40px", () => {
    expect(IMAGE_SIZE).toBe(128);
  });
});

/**
 * ด่านตรวจฝั่งเซิร์ฟเวอร์
 *
 * ฝั่งหน้าจอย่อรูปให้แล้วก็จริง แต่ server action เป็น endpoint ที่ยิงตรงได้
 * ใครส่งอะไรมาก็ได้ ด่านนี้คือด่านสุดท้ายจริงๆ
 */
describe("ตรวจรูปที่ส่งเข้ามา", () => {
  const ok = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4H";

  it("รับ data URL ของรูปที่ถูกต้อง", () => {
    const r = createShopSchema.safeParse({ name: "ร้านทดสอบ", image: ok });
    expect(r.success).toBe(true);
  });

  it("ไม่ส่งรูปมาก็ได้ ไม่ใช่ช่องบังคับ", () => {
    expect(createShopSchema.safeParse({ name: "ร้านทดสอบ" }).success).toBe(true);
  });

  it("ช่องว่างแปลว่าไม่มีรูป เก็บเป็น null ไม่ใช่สตริงว่าง", () => {
    const r = createShopSchema.safeParse({ name: "ร้านทดสอบ", image: "" });
    expect(r.success && r.data.image).toBe(null);
  });

  /** ใครแอบส่งลิงก์ไปเว็บอื่นมาแทนรูป จะกลายเป็นการยิง request ออกนอกจากแอปเรา */
  it("ไม่รับ URL ธรรมดา รับเฉพาะ data URL", () => {
    const r = createShopSchema.safeParse({
      name: "ร้านทดสอบ",
      image: "https://example.com/logo.png",
    });
    expect(r.success).toBe(false);
  });

  it("ไม่รับไฟล์ที่ไม่ใช่รูป", () => {
    const r = createShopSchema.safeParse({
      name: "ร้านทดสอบ",
      image: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    });
    expect(r.success).toBe(false);
  });

  it("ไม่รับ svg เพราะเป็นไฟล์ที่รันสคริปต์ได้", () => {
    const r = createShopSchema.safeParse({
      name: "ร้านทดสอบ",
      image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    });
    expect(r.success).toBe(false);
  });

  /**
   * ด่านที่สำคัญที่สุด — กันแถวข้อมูลบวมจนคิวรีรายชื่อร้านช้าลงทั้งแอป
   */
  it("ไม่รับรูปที่ใหญ่เกินเพดาน", () => {
    const huge = "data:image/webp;base64," + "A".repeat(70_000);
    const r = createShopSchema.safeParse({ name: "ร้านทดสอบ", image: huge });
    expect(r.success).toBe(false);
  });

  it("ฟอร์มแก้ไขร้านก็ตรวจชุดเดียวกัน", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(updateShopSchema.safeParse({ id, name: "ร้าน", image: ok }).success).toBe(true);
    expect(
      updateShopSchema.safeParse({ id, name: "ร้าน", image: "data:text/html;base64,AAAA" })
        .success,
    ).toBe(false);
  });
});
