import { z } from "zod";
import { ACCOUNT_KINDS, DIRECTIONS } from "@/db/schema";

/**
 * ข้อมูลทุกชิ้นที่เข้ามาจากฝั่ง browser ต้องผ่านไฟล์นี้ก่อนถึงฐานข้อมูล
 *
 * server action เป็น HTTP endpoint ที่ยิงตรงได้จากภายนอก ไม่ได้ปลอดภัย
 * โดยอัตโนมัติแค่เพราะฟอร์มที่เรียกมันอยู่หลังหน้าล็อกอิน การตรวจฝั่ง client
 * มีไว้ให้คนใช้สะดวกเท่านั้น ไม่ใช่ด่านกันจริง
 */

/* ------------------------------------------------------------------ */
/*  จำนวนเงิน                                                          */
/* ------------------------------------------------------------------ */

// numeric(12,2) เก็บได้สูงสุด 10 หลักหน้าจุดทศนิยม
const MAX_AMOUNT = 9_999_999_999.99;

/**
 * รับเงินเป็น string แล้วส่งต่อเป็น string
 *
 * ไม่แปลงเป็น number ระหว่างทางเลยแม้แต่ครั้งเดียว เพราะทศนิยมของ JavaScript
 * ปัดเศษเพี้ยน ค่าที่ผ่านฟังก์ชันนี้จะอยู่ในรูป "1234.56" ที่ Postgres
 * รับเข้า numeric ได้ตรงๆ
 */
export const amountSchema = z
  .string()
  .trim()
  .min(1, "ใส่จำนวนเงินด้วย")
  // คนพิมพ์บนมือถือมักติดคอมมาหรือเว้นวรรคมาด้วย ตัดทิ้งก่อนตรวจ
  .transform((v) => v.replace(/[,\s]/g, ""))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "จำนวนเงินต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง")
  .refine((v) => Number(v) > 0, "จำนวนเงินต้องมากกว่า 0")
  .refine((v) => Number(v) <= MAX_AMOUNT, "จำนวนเงินเกินกว่าที่ระบบเก็บได้");

/** ยอดตั้งต้นของบัญชี ต่างจากข้างบนตรงที่ติดลบได้ (เช่นบัตรเครดิต) และเป็น 0 ได้ */
export const openingBalanceSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? "0" : v.replace(/[,\s]/g, "")))
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "ยอดตั้งต้นต้องเป็นตัวเลข")
  .refine((v) => Math.abs(Number(v)) <= MAX_AMOUNT, "ยอดตั้งต้นเกินกว่าที่ระบบเก็บได้");

/* ------------------------------------------------------------------ */
/*  วันที่                                                             */
/* ------------------------------------------------------------------ */

/**
 * รับเฉพาะรูปแบบ "YYYY-MM-DD" และต้องเป็นวันที่มีอยู่จริง
 *
 * ตรวจว่ามีจริงด้วยการประกอบกลับแล้วเทียบ กันค่าอย่าง "2026-02-31"
 * ที่ผ่าน regex แต่ Postgres จะปฏิเสธตอน insert
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    return (
      probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
    );
  }, "ไม่มีวันที่นี้อยู่จริง");

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "รูปแบบเดือนไม่ถูกต้อง");
export const yearSchema = z.string().regex(/^\d{4}$/, "รูปแบบปีไม่ถูกต้อง");

/**
 * สัปดาห์แทนด้วยวันจันทร์ จึงเป็นวันที่จริง ใช้กติกาเดียวกับ dateSchema
 *
 * ตั้งใจไม่บังคับว่าต้องเป็นวันจันทร์ตรงนี้ เพราะฝั่งที่เรียกดึงกลับไปหา
 * วันจันทร์ของสัปดาห์นั้นอีกทีอยู่แล้ว ส่งวันไหนของสัปดาห์มาก็ได้สัปดาห์เดียวกัน
 */
export const weekSchema = dateSchema;

/* ------------------------------------------------------------------ */
/*  ชิ้นส่วนร่วม                                                       */
/* ------------------------------------------------------------------ */

export const directionSchema = z.enum(DIRECTIONS);

/** พารามิเตอร์เจาะดูประเภทในหน้าสรุป — uuid ของประเภท หรือ "none" = ไม่ระบุประเภท */
export const categoryParamSchema = z.union([z.uuid(), z.literal("none")]);
export const accountKindSchema = z.enum(ACCOUNT_KINDS);

const nameSchema = z.string().trim().min(1, "ใส่ชื่อด้วย").max(120, "ชื่อยาวเกินไป");

/**
 * ช่องที่ไม่บังคับ
 *
 * ต้องรับได้ทั้งสามแบบ ไม่ใช่แค่สองแบบ
 *   "ค่าที่กรอก"  ปกติ
 *   ""            ช่องอยู่ในหน้าแต่ปล่อยว่างไว้
 *   undefined     ช่องไม่ได้อยู่ในหน้าเลย
 *
 * แบบที่สามคือแบบที่พลาดกันบ่อยที่สุด FormData เก็บเฉพาะ input ที่มีอยู่จริง
 * ในหน้า ณ ตอนกดส่ง ช่องที่ถูกยุบไว้ ถูกซ่อน หรือ checkbox ที่ไม่ได้ติ๊ก
 * จะไม่มีคีย์ติดมาเลย ไม่ใช่มีแล้วเป็นค่าว่าง
 *
 * ก่อนหน้านี้เขียน .nullable() ไว้ซึ่งรับได้แค่ null กับ string พอช่อง
 * หมายเหตุถูกยุบไว้ (ซึ่งเป็นสถานะตั้งต้น) Zod จึงปฏิเสธทั้งฟอร์มด้วย
 * ข้อความภาษาอังกฤษว่า expected string, received undefined — ทั้งที่ป้าย
 * บอกว่าช่องนี้ไม่บังคับ
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "ข้อความยาวเกินไป")
    .nullish()
    .transform((v) => v || null);

/** id ที่ไม่บังคับ — ไม่ได้เลือกจะได้ "" ส่วนช่องที่ไม่มีในหน้าจะไม่มีคีย์เลย */
const optionalId = z
  .union([z.uuid("รหัสอ้างอิงไม่ถูกต้อง"), z.literal("")])
  .nullish()
  .transform((v) => v || null);

/* ------------------------------------------------------------------ */
/*  รายการเคลื่อนไหว                                                   */
/* ------------------------------------------------------------------ */

export const createTransactionSchema = z.object({
  shopId: z.uuid("ไม่พบร้านที่เลือก"),
  txnDate: dateSchema,
  direction: directionSchema,
  categoryId: optionalId,
  accountId: optionalId,
  title: z.string().trim().min(1, "ใส่ชื่อรายการด้วย").max(200, "ชื่อรายการยาวเกินไป"),
  amount: amountSchema,
  note: optionalText(500),
});

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.uuid("ไม่พบรายการที่จะแก้ไข"),
});

/** ใช้กับ action ที่ทำกับทั้งร้าน ไม่ได้เจาะจงแถวไหน */
export const shopRefSchema = z.object({ shopId: z.uuid() });

/** ใช้กับทุก action ที่อ้างถึงแถวเดียวในร้านหนึ่ง เช่นลบหรือปิดใช้งาน */
export const rowRefSchema = z.object({
  shopId: z.uuid(),
  id: z.uuid(),
});

/**
 * ลำดับใหม่ของรายการที่ลากสลับ
 *
 * ส่งมาเป็น id คั่นด้วยจุลภาคในช่องเดียว เพราะ FormData ที่ action นี้รับ
 * ถูกแปลงเป็น Record<string, string> ก่อนตรวจ (ดู formObject) จึงเก็บ
 * ค่าหลายตัวในคีย์เดียวไม่ได้
 *
 * ⚠️ ตรวจว่าไม่มี id ซ้ำตรงนี้เลย เพราะ action เอาลำดับในอาร์เรย์ไปเขียนเป็น
 *    sort_order ตรงๆ ถ้ามีตัวซ้ำหลุดเข้าไป บัญชีหนึ่งจะได้เลขสองครั้งแล้ว
 *    อีกบัญชีไม่ได้เลข ลำดับที่เห็นจะเพี้ยนโดยไม่มี error อะไรออกมา
 *
 * ⚠️ ตัวนี้ตรวจได้แค่ "รูปร่างถูกไหม" ส่วนที่ว่า id พวกนี้เป็นของร้านนี้จริง
 *    หรือเปล่า ต้องไปเทียบกับฐานข้อมูลใน action ซึ่งทำไว้แล้ว
 */
export const reorderSchema = z.object({
  shopId: z.uuid("ไม่พบร้านที่เลือก"),
  ids: z
    .string()
    .trim()
    .min(1, "ไม่มีรายการให้จัดลำดับ")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.uuid("รหัสรายการไม่ถูกต้อง")).min(1).max(500))
    .refine((ids) => new Set(ids).size === ids.length, "มีรายการซ้ำในลำดับที่ส่งมา"),
});

export const deleteTransactionSchema = rowRefSchema;

/* ------------------------------------------------------------------ */
/*  การโอนเงินระหว่างบัญชี                                             */
/* ------------------------------------------------------------------ */

/**
 * ต่างจากรายการปกติตรงที่ไม่มีประเภทและไม่มีชื่อรายการ
 *
 * ไม่มีประเภทเพราะการโอนไม่ใช่รายรับและไม่ใช่รายจ่าย จึงไม่มีอะไรให้จัดหมวด
 * ส่วนบัญชีเป็นช่องบังคับทั้งคู่ ต่างจากรายการปกติที่เว้นว่างได้ —
 * การโอนที่ไม่รู้ว่าเงินมาจากไหนหรือไปไหน ไม่มีความหมายเลย
 */
export const createTransferSchema = z
  .object({
    shopId: z.uuid(),
    fromAccountId: z.uuid("เลือกบัญชีต้นทางด้วย"),
    toAccountId: z.uuid("เลือกบัญชีปลายทางด้วย"),
    txnDate: dateSchema,
    amount: amountSchema,
    note: optionalText(500),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "โอนเข้าบัญชีเดียวกันไม่ได้ เลือกบัญชีปลายทางใหม่",
    path: ["toAccountId"],
  });

export const updateTransferSchema = z
  .object({
    shopId: z.uuid(),
    id: z.uuid("ไม่พบรายการโอนที่จะแก้ไข"),
    fromAccountId: z.uuid("เลือกบัญชีต้นทางด้วย"),
    toAccountId: z.uuid("เลือกบัญชีปลายทางด้วย"),
    txnDate: dateSchema,
    amount: amountSchema,
    note: optionalText(500),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "โอนเข้าบัญชีเดียวกันไม่ได้ เลือกบัญชีปลายทางใหม่",
    path: ["toAccountId"],
  });

/* ------------------------------------------------------------------ */
/*  ประเภท                                                             */
/* ------------------------------------------------------------------ */

export const createCategorySchema = z.object({
  shopId: z.uuid(),
  direction: directionSchema,
  name: nameSchema,
  // checkbox ที่ไม่ติ๊กจะไม่ถูกส่งมาใน FormData เลย ค่าจึงเป็น undefined
  counts: z.union([z.literal("on"), z.literal("")]).optional().transform((v) => v === "on"),
});

export const updateCategorySchema = z.object({
  shopId: z.uuid(),
  id: z.uuid(),
  name: nameSchema,
  counts: z.union([z.literal("on"), z.literal("")]).optional().transform((v) => v === "on"),
});

export const toggleActiveSchema = z.object({
  shopId: z.uuid(),
  id: z.uuid(),
  isActive: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
});

/* ------------------------------------------------------------------ */
/*  บัญชี                                                              */
/* ------------------------------------------------------------------ */

export const createAccountSchema = z.object({
  shopId: z.uuid(),
  name: nameSchema,
  kind: accountKindSchema,
  bank: optionalText(80),
  accountNo: optionalText(40),
  openingBalance: openingBalanceSchema,
});

export const updateAccountSchema = z.object({
  shopId: z.uuid(),
  id: z.uuid(),
  name: nameSchema,
  kind: accountKindSchema,
  bank: optionalText(80),
  accountNo: optionalText(40),
  openingBalance: openingBalanceSchema,
});

/* ------------------------------------------------------------------ */
/*  ร้าน                                                               */
/* ------------------------------------------------------------------ */

/**
 * รูปร้าน เก็บเป็น data URL ในฐานข้อมูลเลย ไม่ได้เก็บเป็นไฟล์
 *
 * ทำแบบนี้เพราะรูปถูกย่อเหลือ 128×128 ตั้งแต่ในเครื่องก่อนส่ง ได้ไฟล์
 * ราว 5–8KB ซึ่งเล็กพอที่จะอยู่ในแถวข้อมูลได้สบาย แลกกับการไม่ต้องมี
 * ระบบเก็บไฟล์แยก ไม่ต้องคุมสิทธิ์เข้าถึงไฟล์ ไม่มีไฟล์ค้างตอนลบร้าน
 * และรูปมาพร้อมข้อมูลร้านในคำขอเดียว
 *
 * ⚠️ เพดานตรงนี้คือด่านสุดท้าย ไม่ใช่ด่านแรก
 *    ฝั่งหน้าจอย่อรูปให้แล้ว แต่ server action เป็น endpoint ที่ยิงตรงได้
 *    ใครส่ง data URL ขนาด 10MB มาก็ได้ถ้าไม่ดักตรงนี้ แล้วแถวข้อมูลจะบวม
 *    จนคิวรีที่ดึงรายชื่อร้านช้าลงทั้งแอป
 *
 * 60,000 ตัวอักษร ≈ 45KB ซึ่งเผื่อไว้เยอะแล้วสำหรับรูป 128px
 */
const MAX_IMAGE_CHARS = 60_000;

export const shopImageSchema = z
  .string()
  .trim()
  .max(MAX_IMAGE_CHARS, "รูปใหญ่เกินไป ลองเลือกรูปอื่น")
  .refine(
    (v) => v === "" || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "ไฟล์นี้ไม่ใช่รูปภาพ",
  )
  // ช่องว่างแปลว่า "ไม่มีรูป" เก็บเป็น null ไม่ใช่สตริงว่าง
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const createShopSchema = z.object({ name: nameSchema, image: shopImageSchema });
export const updateShopSchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  image: shopImageSchema,
});
export const deleteShopSchema = z.object({ id: z.uuid() });

/* ------------------------------------------------------------------ */
/*  ล็อกอิน                                                            */
/* ------------------------------------------------------------------ */

export const pinSchema = z.object({
  pin: z.string().trim().min(1, "ใส่รหัสก่อน").max(64),
});
