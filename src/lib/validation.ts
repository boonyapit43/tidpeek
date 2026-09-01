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

export const createShopSchema = z.object({ name: nameSchema });
export const updateShopSchema = z.object({ id: z.uuid(), name: nameSchema });
export const deleteShopSchema = z.object({ id: z.uuid() });

/* ------------------------------------------------------------------ */
/*  ล็อกอิน                                                            */
/* ------------------------------------------------------------------ */

export const pinSchema = z.object({
  pin: z.string().trim().min(1, "ใส่รหัสก่อน").max(64),
});
