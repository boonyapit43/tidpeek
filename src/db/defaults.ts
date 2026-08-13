import type { AccountKind, Direction } from "./schema";

/**
 * ของที่ร้านเปิดใหม่ต้องมีตั้งแต่วินาทีแรก
 *
 * ใช้อยู่สามที่และต้องเป็นชุดเดียวกันเป๊ะ
 *   • src/db/seed.ts          สคริปต์ npm run db:seed
 *   • createShop              ตอนเพิ่มร้านจากหน้าเลือกร้าน
 *   • addDefaultCategories    ปุ่มเติมชุดตั้งต้นในหน้าตั้งค่า
 *
 * แยกออกมาเป็นไฟล์ข้อมูลล้วนๆ ไม่ import อะไรที่แตะฐานข้อมูลและไม่ติด
 * "server-only" เพราะสคริปต์ที่รันบน Node ตรงๆ กับ server action ต้องใช้
 * ไฟล์เดียวกันได้ ถ้าปล่อยให้แต่ละที่มีรายการของตัวเอง สุดท้ายจะไม่ตรงกัน
 * แล้วร้านที่สร้างคนละทางจะได้ของไม่เท่ากันโดยไม่มีใครสังเกต
 */

/* ------------------------------------------------------------------ */
/*  ประเภทรายรับรายจ่าย                                                */
/* ------------------------------------------------------------------ */

/**
 * counts = false คือเงินที่เข้าออกจริงแต่ไม่ใช่กำไรหรือขาดทุนของร้าน
 * ยอดบัญชียังขยับตามปกติ แค่ไม่ถูกนับตอนคิดกำไร
 */
export const DEFAULT_CATEGORIES: {
  direction: Direction;
  name: string;
  counts: boolean;
}[] = [
  /* ---------- ฝั่งรับ: นับเป็นรายได้ ---------- */
  { direction: "in", name: "ขายหน้าร้าน", counts: true },
  { direction: "in", name: "ขายออนไลน์", counts: true },
  { direction: "in", name: "ขายส่ง", counts: true },
  { direction: "in", name: "ค่าส่งที่เก็บจากลูกค้า", counts: true },
  { direction: "in", name: "รับจ้าง/บริการ", counts: true },
  { direction: "in", name: "ขายของเก่า/ทรัพย์สิน", counts: true },
  { direction: "in", name: "ดอกเบี้ยรับ", counts: true },
  { direction: "in", name: "รายได้อื่น", counts: true },

  /* ---------- ฝั่งรับ: เงินเข้าจริงแต่ไม่ใช่กำไรของร้าน ---------- */
  { direction: "in", name: "เติมทุน", counts: false },
  { direction: "in", name: "เงินกู้", counts: false },
  { direction: "in", name: "รับเงินคืนจากผู้ขาย", counts: false },
  { direction: "in", name: "รับคืนเงินยืม", counts: false },

  /* ---------- ฝั่งจ่าย: นับเป็นรายจ่าย ---------- */
  { direction: "out", name: "ซื้อของเข้าร้าน", counts: true },
  { direction: "out", name: "ค่าแรง", counts: true },
  { direction: "out", name: "ค่าเช่าที่", counts: true },
  { direction: "out", name: "ค่าน้ำค่าไฟ", counts: true },
  { direction: "out", name: "ค่าเน็ต/ค่าโทรศัพท์", counts: true },
  { direction: "out", name: "ค่าส่ง", counts: true },
  { direction: "out", name: "ค่าน้ำมัน/ค่าเดินทาง", counts: true },
  { direction: "out", name: "ค่าบรรจุภัณฑ์/ถุง", counts: true },
  { direction: "out", name: "ของใช้ในร้าน", counts: true },
  { direction: "out", name: "ค่าซ่อมบำรุง/อุปกรณ์", counts: true },
  { direction: "out", name: "ค่าโฆษณา/การตลาด", counts: true },
  { direction: "out", name: "ค่าธรรมเนียมธนาคาร", counts: true },
  { direction: "out", name: "ภาษี/ค่าธรรมเนียมราชการ", counts: true },
  { direction: "out", name: "ของเสีย/ของหาย", counts: true },
  { direction: "out", name: "รายจ่ายอื่น", counts: true },

  /* ---------- ฝั่งจ่าย: เงินออกจริงแต่ไม่ใช่ขาดทุนของร้าน ---------- */
  { direction: "out", name: "ถอนใช้ส่วนตัว", counts: false },
  { direction: "out", name: "คืนเงินกู้", counts: false },
  { direction: "out", name: "ให้ยืม", counts: false },
  { direction: "out", name: "ยืมข้ามร้าน", counts: false },
];

/**
 * ⚠️ ตั้งใจไม่มีประเภท "โอนย้ายบัญชี" ในชุดนี้
 *
 * การโอนเงินระหว่างบัญชีของตัวเองมีที่อยู่ของมันเองแล้ว คือตาราง transfers
 * ถ้ามีประเภทให้เลือกด้วย จะกลายเป็นสองวิธีทำเรื่องเดียวกัน แล้วข้อมูล
 * จะไม่สอดคล้องกันตั้งแต่วันแรก — บางครั้งโอนอยู่ในหน้าบัญชี บางครั้ง
 * อยู่ในรายการรายวัน สรุปยอดออกมาแล้วไม่มีใครตอบได้ว่าอันไหนนับอันไหนไม่นับ
 *
 * ส่วน "ยืมข้ามร้าน" ยังอยู่ เพราะเป็นเงินที่ออกไปหาอีกร้านจริงๆ
 * ไม่ใช่การย้ายระหว่างบัญชีของร้านเดียวกัน
 */

/* ------------------------------------------------------------------ */
/*  บัญชี                                                              */
/* ------------------------------------------------------------------ */

/**
 * มีแค่เงินสด ไม่ใส่บัญชีธนาคารเปล่าๆ ไว้ให้
 *
 * เงินสดเป็นบัญชีเดียวที่ทุกร้านมีเหมือนกันหมดและชื่อไม่ต่างกัน ส่วนบัญชี
 * ธนาคารกับวอลเล็ตมีชื่อจริงของมันเอง (กสิกร ไทยพลัส ไลน์แมน) การใส่ก้อน
 * ชื่อ "บัญชีธนาคาร" ไว้ให้จึงมีแต่ทำให้ต้องไปแก้ชื่อทีหลัง หรือแย่กว่านั้น
 * คือถูกปล่อยทิ้งไว้เป็นตัวเลือกเปล่าๆ ในดรอปดาวน์ตอนบันทึกทุกครั้ง
 *
 * ยอดตั้งต้นเป็น 0 เสมอ เดาแทนคนใช้ไม่ได้ ต้องไปตั้งให้ตรงกับเงินจริง
 * ที่มีอยู่ในลิ้นชักและในแอปธนาคาร ที่หน้าตั้งค่า
 */
export const DEFAULT_ACCOUNTS: { name: string; kind: AccountKind }[] = [
  { name: "เงินสด", kind: "cash" },
];

/* ------------------------------------------------------------------ */
/*  แปลงเป็นแถวพร้อม insert                                            */
/* ------------------------------------------------------------------ */

/**
 * shopId = null แปลว่าเป็นของกลางที่ทุกร้านเห็นร่วมกัน
 *
 * sortOrder นับแยกฝั่งรับกับฝั่งจ่าย เพื่อให้ลำดับในแต่ละดรอปดาวน์เริ่มที่ 1
 * ไม่ใช่ฝั่งจ่ายเริ่มที่ 14 ต่อจากฝั่งรับ
 */
export function defaultCategoryRows(shopId: string | null) {
  let inOrder = 0;
  let outOrder = 0;

  return DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    shopId,
    sortOrder: c.direction === "in" ? ++inOrder : ++outOrder,
  }));
}

export function defaultAccountRows(shopId: string | null) {
  return DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, shopId, sortOrder: i + 1 }));
}
