import { describe, expect, it } from "vitest";
import { formObject } from "@/actions/shared";
import {
  amountSchema,
  createTransactionSchema,
  dateSchema,
  openingBalanceSchema,
} from "./validation";

const SHOP = "6f7c2e1a-0b3d-4e5f-8a9b-1c2d3e4f5a6b";
const CATEGORY = "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9";

describe("amountSchema", () => {
  it("รับตัวเลขปกติและคืนเป็น string ไม่ใช่ number", () => {
    // ต้องเป็น string เพราะจะส่งตรงเข้า numeric ของ Postgres
    const r = amountSchema.parse("1234.56");
    expect(r).toBe("1234.56");
    expect(typeof r).toBe("string");
  });

  it("ตัดจุลภาคกับช่องว่างที่คนพิมพ์บนมือถือติดมา", () => {
    expect(amountSchema.parse("1,234.56")).toBe("1234.56");
    expect(amountSchema.parse(" 1 234 ")).toBe("1234");
    expect(amountSchema.parse("1,000,000")).toBe("1000000");
  });

  it("ทศนิยมหนึ่งตำแหน่งก็ได้", () => {
    expect(amountSchema.parse("99.5")).toBe("99.5");
  });

  it("ปฏิเสธทศนิยมเกินสองตำแหน่ง", () => {
    // numeric(12,2) เก็บได้แค่สองตำแหน่ง ถ้าปล่อยผ่าน Postgres จะปัดให้เงียบๆ
    // แล้วยอดที่บันทึกจะไม่ตรงกับที่คนพิมพ์
    expect(amountSchema.safeParse("10.999").success).toBe(false);
  });

  it("ปฏิเสธศูนย์และค่าติดลบ", () => {
    expect(amountSchema.safeParse("0").success).toBe(false);
    expect(amountSchema.safeParse("-50").success).toBe(false);
  });

  it("ปฏิเสธค่าว่างและตัวอักษร", () => {
    expect(amountSchema.safeParse("").success).toBe(false);
    expect(amountSchema.safeParse("abc").success).toBe(false);
    expect(amountSchema.safeParse("12abc").success).toBe(false);
  });

  it("ปฏิเสธยอดที่เกินกว่า numeric(12,2) จะเก็บได้", () => {
    expect(amountSchema.safeParse("9999999999.99").success).toBe(true);
    expect(amountSchema.safeParse("99999999999").success).toBe(false);
  });
});

describe("openingBalanceSchema", () => {
  it("ยอดตั้งต้นเป็นศูนย์และติดลบได้ ต่างจากจำนวนเงินของรายการ", () => {
    // ติดลบได้เพราะบัตรเครดิตหรือบัญชีที่ติดลบอยู่ก่อนเริ่มใช้แอป
    expect(openingBalanceSchema.parse("0")).toBe("0");
    expect(openingBalanceSchema.parse("-1500.50")).toBe("-1500.50");
  });

  it("ช่องว่างถือเป็นศูนย์", () => {
    expect(openingBalanceSchema.parse("")).toBe("0");
  });
});

describe("dateSchema", () => {
  it("รับรูปแบบ YYYY-MM-DD", () => {
    expect(dateSchema.parse("2026-08-11")).toBe("2026-08-11");
  });

  it("ปฏิเสธวันที่ไม่มีอยู่จริงแม้รูปแบบถูก", () => {
    // regex ผ่านแต่ไม่มีวันนี้ในปฏิทิน ถ้าปล่อยไป Postgres จะปฏิเสธ
    // แล้วคนจะเจอ error ที่อ่านไม่รู้เรื่องแทนข้อความภาษาไทย
    expect(dateSchema.safeParse("2026-02-31").success).toBe(false);
    expect(dateSchema.safeParse("2026-13-01").success).toBe(false);
    expect(dateSchema.safeParse("2026-00-10").success).toBe(false);
  });

  it("29 กุมภาพันธ์ผ่านเฉพาะปีอธิกสุรทิน", () => {
    expect(dateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2026-02-29").success).toBe(false);
  });

  it("ปฏิเสธรูปแบบอื่น", () => {
    expect(dateSchema.safeParse("11/08/2026").success).toBe(false);
    expect(dateSchema.safeParse("2026-8-1").success).toBe(false);
    expect(dateSchema.safeParse("").success).toBe(false);
  });
});

describe("createTransactionSchema", () => {
  const valid = {
    shopId: SHOP,
    txnDate: "2026-08-11",
    direction: "out",
    categoryId: CATEGORY,
    accountId: "",
    title: "  ค่าไฟ  ",
    amount: "480.25",
    note: "",
  };

  it("รับข้อมูลที่ถูกต้อง และตัดช่องว่างหัวท้ายของชื่อรายการ", () => {
    const r = createTransactionSchema.parse(valid);
    expect(r.title).toBe("ค่าไฟ");
    expect(r.amount).toBe("480.25");
  });

  it("ช่องที่ไม่ได้เลือกกลายเป็น null ไม่ใช่ string ว่าง", () => {
    // ฟอร์ม HTML ส่ง "" มาเสมอ ถ้าไม่แปลงเป็น null
    // Postgres จะปฏิเสธเพราะ "" ไม่ใช่ uuid ที่ถูกต้อง
    const r = createTransactionSchema.parse(valid);
    expect(r.accountId).toBeNull();
    expect(r.note).toBeNull();
  });

  /**
   * ฟอร์มจริงส่งมาไม่ครบทุกช่องเสมอไป
   *
   * ช่องหมายเหตุถูกยุบไว้จนกว่าจะกดเปิด ตอนยุบอยู่ <input name="note"> ไม่ได้
   * อยู่ในหน้าเลย FormData จึงไม่มีคีย์ note ติดมาด้วย ไม่ใช่มีแล้วเป็นค่าว่าง
   *
   * เทสชุดเดิมส่ง note: "" มาตลอด เลยไม่เคยเจอกรณีนี้ ทั้งที่เป็นสถานะตั้งต้น
   * ของฟอร์ม แปลว่าการบันทึกแบบปกติที่สุดคือเส้นทางที่ไม่เคยถูกทดสอบ
   */
  /**
   * ชุดคีย์นี้คัดลอกมาจาก FormData จริงของฟอร์มบันทึกรายการ อ่านจากเบราว์เซอร์
   * ด้วย new FormData(form) ตอนที่ช่องหมายเหตุยังยุบอยู่ ซึ่งเป็นสถานะตั้งต้น
   *
   * สังเกตว่าไม่มีคีย์ note เลย ไม่ใช่มีแล้วเป็นค่าว่าง เพราะ <input name="note">
   * ไม่ได้ถูก render ลงหน้า FormData เก็บเฉพาะ input ที่มีอยู่จริงตอนกดส่ง
   *
   * เทสผ่าน formObject ตัวเดียวกับที่ server action ใช้ ไม่ได้เขียน object
   * ขึ้นมาเอง จะได้ไม่พลาดเพราะเดาผิดว่าฟอร์มส่งอะไรมา ซึ่งเป็นสาเหตุที่
   * เทสชุดเดิมมองไม่เห็นบั๊กนี้ทั้งที่ครอบคลุมช่องอื่นครบหมด
   */
  const formDataFromEntryForm = () => {
    const fd = new FormData();
    fd.set("shopId", SHOP);
    fd.set("direction", "out");
    fd.set("txnDate", "2026-08-11");
    fd.set("amount", "480.25");
    fd.set("title", "ค่าไฟ");
    fd.set("categoryId", CATEGORY);
    fd.set("accountId", "");
    return fd;
  };

  it("ฟอร์มที่ยังไม่ได้กดเปิดช่องหมายเหตุ ต้องบันทึกได้", () => {
    const r = createTransactionSchema.safeParse(formObject(formDataFromEntryForm()));

    expect(r.success).toBe(true);
    expect(r.data?.note).toBeNull();
    expect(r.data?.accountId).toBeNull();
  });

  it("ช่องเลือกที่ไม่ได้ถูก render ก็ต้องผ่านเหมือนกัน", () => {
    const fd = formDataFromEntryForm();
    fd.delete("categoryId");
    fd.delete("accountId");

    const r = createTransactionSchema.safeParse(formObject(fd));

    expect(r.success).toBe(true);
    expect(r.data?.categoryId).toBeNull();
    expect(r.data?.accountId).toBeNull();
  });

  it("ปฏิเสธชื่อรายการที่มีแต่ช่องว่าง", () => {
    expect(createTransactionSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
  });

  it("ปฏิเสธ id ที่ไม่ใช่ uuid", () => {
    expect(createTransactionSchema.safeParse({ ...valid, shopId: "1" }).success).toBe(false);
    expect(
      createTransactionSchema.safeParse({ ...valid, categoryId: "ไม่ใช่ uuid" }).success,
    ).toBe(false);
  });

  it("ปฏิเสธทิศทางที่ไม่ใช่ in หรือ out", () => {
    expect(createTransactionSchema.safeParse({ ...valid, direction: "sideways" }).success).toBe(
      false,
    );
  });

  it("รวบข้อผิดพลาดของทุกช่องมาให้ครบ ไม่ได้หยุดที่ช่องแรก", () => {
    const r = createTransactionSchema.safeParse({
      ...valid,
      title: "",
      amount: "-1",
      txnDate: "2026-02-31",
    });

    expect(r.success).toBe(false);
    const fields = new Set(r.error?.issues.map((i) => i.path.join(".")));
    expect(fields).toContain("title");
    expect(fields).toContain("amount");
    expect(fields).toContain("txnDate");
  });
});
