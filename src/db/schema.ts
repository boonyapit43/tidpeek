import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  ชนิดข้อมูลร่วม                                                     */
/* ------------------------------------------------------------------ */

export type Direction = "in" | "out";
export type AccountKind = "cash" | "bank" | "ewallet";

export const DIRECTIONS = ["in", "out"] as const;
export const ACCOUNT_KINDS = ["cash", "bank", "ewallet"] as const;

/**
 * จำนวนเงินเก็บเป็น numeric(12,2) และ Drizzle คืนมาเป็น string เสมอ
 *
 * นี่คือสิ่งที่ต้องการ ไม่ใช่ข้อจำกัด: ถ้าคืนมาเป็น number ของ JavaScript
 * ยอดจะเพี้ยนตอนบวกเลขหลายบรรทัด (0.1 + 0.2 !== 0.3)
 *
 * กฎคือ **ห้ามบวกเงินใน JavaScript** ให้ SQL รวมยอดมาให้เสร็จแล้วค่อยแปลง
 * เป็นตัวเลขครั้งเดียวตอนแสดงผล ดู src/lib/money.ts
 */
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

/**
 * คอลัมน์ที่ทุกตารางต้องมีเหมือนกันหมด
 *
 * is_deleted — ลบแบบไม่ลบจริง
 *   ในระบบบัญชี การลบแถวออกจริงคือการทำลายหลักฐาน ถ้าลบผิดแล้วไม่มีทางรู้
 *   ว่าเคยมีอะไรอยู่ และรายการที่อ้างถึงแถวนั้นจะกลายเป็นเด็กกำพร้าทันที
 *   ทุก query จึงกรอง is_deleted = false ออกไปแทน ข้อมูลยังอยู่ในฐานครบ
 *   กู้กลับได้ด้วย SQL บรรทัดเดียว
 *
 *   ⚠️ ถ้าเพิ่ม query ใหม่ ต้องใส่เงื่อนไข is_deleted ด้วยเสมอ
 *      ไม่งั้นของที่ลบไปแล้วจะโผล่กลับมา — ทุก query ใน queries.ts กรองธงนี้เอง
 *
 * created_at / updated_at — ตอบว่าแถวนี้เกิดเมื่อไหร่และถูกแตะครั้งสุดท้ายเมื่อไหร่
 *   ใช้ timestamptz เพราะเป็นเวลาจริงที่เกิดเหตุ ต่างจาก txn_date ที่เป็น
 *   วันของรายการซึ่งต้องเป็น date ล้วน
 */
const auditColumns = {
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------------ */
/*  ร้าน                                                               */
/* ------------------------------------------------------------------ */

/**
 * ทุกตารางปิดท้ายด้วย .enableRLS() — สามเหตุผล
 *
 *   1. REST API อัตโนมัติของ Supabase (PostgREST) อ่านตารางที่เปิด RLS
 *      โดยไม่มี policy ไม่ได้เลย ปิดทางคนถือ anon key ยิงอ่านตรง
 *   2. เส้นทาง migration ต้องได้ผลเหมือน schema.sql — เคยหลุดมาแล้วจริง
 *      ตาราง transfers ถูกสร้างผ่าน migration โดยไม่มี RLS ทั้งที่อีกสี่ตารางมี
 *   3. กัน db:push ถอด RLS ทิ้งเงียบๆ — ถ้า schema ตรงนี้ไม่ประกาศไว้
 *      drizzle-kit จะเห็นว่าฐานจริงมี RLS แต่ schema ไม่มี แล้วสั่ง DISABLE ให้
 *
 * แอปเองไม่กระทบ เพราะ role ใน DATABASE_URL เป็นเจ้าของตาราง ซึ่ง Postgres
 * ยกเว้น RLS ให้อยู่แล้ว
 */
export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [index("idx_shops_live").on(t.isDeleted, t.sortOrder)],
).enableRLS();

/* ------------------------------------------------------------------ */
/*  บัญชี / ช่องทางเงิน                                                */
/* ------------------------------------------------------------------ */

/**
 * shopId = null  →  บัญชีกลาง ทุกร้านใช้ร่วมกัน (เช่นบัญชีธนาคารใบเดียวใช้สองร้าน)
 * shopId มีค่า   →  บัญชีของร้านนั้นร้านเดียว
 *
 * openingBalance เป็นของ "บัญชี" ไม่ใช่ของ "ร้าน" — ห้ามนับซ้ำระดับร้าน
 * ไม่งั้นสองร้านที่ใช้บัญชีร่วมกันจะเห็นยอดตั้งต้นคนละใบ
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<AccountKind>().notNull().default("bank"),
    bank: text("bank"),
    accountNo: text("account_no"),
    openingBalance: money("opening_balance").notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    check("accounts_kind_check", sql`${t.kind} in ('cash','bank','ewallet')`),
    index("idx_accounts_shop").on(t.shopId, t.isDeleted),
  ],
).enableRLS();

/* ------------------------------------------------------------------ */
/*  ประเภทรายรับรายจ่าย                                                */
/* ------------------------------------------------------------------ */

/**
 * counts = false คือเงินที่เข้าออกจริงแต่ไม่ใช่กำไรหรือขาดทุนของร้าน
 * เช่น เติมทุน เงินกู้ ถอนใช้ส่วนตัว โอนย้ายบัญชี
 *
 * ⚠️ กฎเหล็ก: ธงนี้ใช้กรองตอน "คิดกำไร" เท่านั้น
 *    ห้ามใช้กรองตอน "คิดยอดคงเหลือของบัญชี" เด็ดขาด
 *    ไม่งั้นยอดในแอปจะไม่ตรงกับยอดในแอปธนาคาร
 *    ทั้งสองกรณีถูกบังคับไว้ที่ src/db/queries.ts แล้ว
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    direction: text("direction").$type<Direction>().notNull(),
    name: text("name").notNull(),
    counts: boolean("counts").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    check("categories_direction_check", sql`${t.direction} in ('in','out')`),
    index("idx_categories_shop").on(t.shopId, t.isDeleted),
  ],
).enableRLS();

/* ------------------------------------------------------------------ */
/*  รายการเคลื่อนไหว                                                   */
/* ------------------------------------------------------------------ */

/**
 * amount เก็บเป็นค่าบวกเสมอ ทิศทางเงินอยู่ที่คอลัมน์ direction
 * เก็บแบบนี้เพราะเลขติดลบในตารางบัญชีอ่านยากและพลาดง่ายเวลา query
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /**
     * ชนิด date ของ Postgres — เก็บแค่ปีเดือนวัน ไม่มีเวลาและไม่มี timezone
     *
     * mode "string" ระบุไว้ชัดเจนเพื่อให้ค่าที่วิ่งเข้าออกเป็น "YYYY-MM-DD" เสมอ
     * ถ้าปล่อยให้กลายเป็น Date object ของ JavaScript ค่าจะถูกตีความเป็น UTC
     * แล้ววันจะเลื่อนไป 1 วันบนเซิร์ฟเวอร์ที่ไม่ได้ตั้งเวลาเป็นไทย
     *
     * "วันนี้" คำนวณจาก Asia/Bangkok เสมอ ดู src/lib/date.ts
     */
    txnDate: date("txn_date", { mode: "string" }).notNull(),
    direction: text("direction").$type<Direction>().notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    amount: money("amount").notNull(),
    note: text("note"),
    ...auditColumns,
  },
  (t) => [
    check("transactions_direction_check", sql`${t.direction} in ('in','out')`),
    check("transactions_amount_check", sql`${t.amount} >= 0`),
    /**
     * ⚠️ ต้องเขียน desc ด้วย sql`` เอง ห้ามใช้ .desc() ของ drizzle
     *
     * .desc() ใส่ NULLS LAST ให้อัตโนมัติ แต่ `order by x desc` ของ Postgres
     * หมายถึง NULLS FIRST สองอย่างนี้ไม่ตรงกัน ดัชนีจึงใช้เรียงลำดับไม่ได้
     * แล้ว Postgres จะกลับไป Seq Scan ทั้งตารางแบบเงียบๆ ไม่มี error ให้เห็น
     *
     * วัดที่ 22,000 แถว — nulls last 8.6ms (Seq Scan) เทียบกับ 0.09ms (Index Scan)
     * ต่างกัน 90 เท่า ทั้งที่ชื่อดัชนีเหมือนกันเป๊ะและดูผ่านๆ เหมือนมีดัชนีแล้ว
     *
     * คอลัมน์พวกนี้เป็น not null อยู่แล้ว การทิ้ง nulls last จึงไม่เปลี่ยน
     * ความหมายอะไรเลย แค่ทำให้ตรงกับที่คิวรีเขียนจริง
     */

    // ดัชนีหลักที่ทุกหน้าใช้ — กรองร้าน ตัดของที่ลบแล้ว เรียงวันใหม่สุดขึ้นก่อน
    index("idx_txn_shop_date").on(t.shopId, t.isDeleted, sql`${t.txnDate} desc`),

    /**
     * เรียงตาม "เวลาที่กดบันทึก" ไม่ใช่ "วันของรายการ"
     *
     * ใช้ที่ลิสต์ "เพิ่งบันทึกไป" ใต้ฟอร์ม ซึ่งอยู่บนหน้าที่เปิดบ่อยที่สุดของแอป
     * ถ้าไม่มี Postgres ต้องอ่านรายการทั้งร้านขึ้นมาเรียงใหม่ทุกครั้งที่เปิดหน้า
     */
    index("idx_txn_shop_created").on(t.shopId, t.isDeleted, sql`${t.createdAt} desc`),
    index("idx_txn_account").on(t.accountId, t.isDeleted),
    index("idx_txn_category").on(t.categoryId, t.isDeleted),
  ],
).enableRLS();

/* ------------------------------------------------------------------ */
/*  การโอนเงินระหว่างบัญชี                                             */
/* ------------------------------------------------------------------ */

/**
 * โอนเงินจากบัญชีหนึ่งไปอีกบัญชี — เก็บเป็น "แถวเดียว" ไม่ใช่สองรายการ
 *
 * ทำไมไม่เก็บเป็น transactions สองแถว (ออกจากบัญชีหนึ่ง เข้าอีกบัญชีหนึ่ง)
 *
 *   1) การโอนไม่ใช่รายรับและไม่ใช่รายจ่าย เงินไม่ได้เพิ่มหรือลด แค่ย้ายที่
 *      ถ้าเก็บปนใน transactions มันต้องแกล้งเป็นรายรับก้อนหนึ่งกับรายจ่าย
 *      อีกก้อนที่หักล้างกันพอดี แล้วต้องพึ่งธง counts ให้ถูกต้องตลอดไป
 *      เพื่อไม่ให้ยอดขายกับยอดรายจ่ายพองขึ้นทั้งคู่
 *
 *   2) สองแถวแยกกันทำให้เกิดสถานะที่ "ไม่ควรมีอยู่ได้" — ลบขาเดียว
 *      หรือแก้จำนวนขาเดียว แล้วเงินจะงอกหรือหายจากอากาศโดยไม่มีอะไรฟ้อง
 *      แถวเดียวมีจำนวนเงินตัวเดียว จึงไม่มีคำว่า "สองขาไม่ตรงกัน"
 *
 * ผลที่ตามมาซึ่งเป็นสิ่งที่ต้องการ: query ที่คิดกำไรไม่รู้จักตารางนี้เลย
 * การโอนจึงไม่มีทางไปโผล่ในกำไรได้ ไม่ว่าใครจะเผลอตั้งค่าอะไรผิด
 *
 * ⚠️ ตรงกันข้าม ตอนคิด "ยอดคงเหลือของบัญชี" ต้องรวมตารางนี้เสมอ
 *    ลืมเมื่อไหร่ยอดในแอปจะไม่ตรงกับยอดในแอปธนาคารทันที
 *    ดู balanceExpr ใน src/db/queries.ts
 */
export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** ร้านที่เป็นคนสั่งโอน ใช้จำกัดสิทธิ์การมองเห็นและแก้ไข */
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    fromAccountId: uuid("from_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    toAccountId: uuid("to_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    txnDate: date("txn_date", { mode: "string" }).notNull(),
    amount: money("amount").notNull(),
    /**
     * หมายเหตุสำคัญกว่าของรายการปกติมาก
     *
     * รายการปกติมีประเภทกับชื่อรายการบอกว่าเงินก้อนนี้คืออะไร แต่การโอน
     * ไม่มีทั้งคู่ เหลือแค่ จาก → ไป → จำนวน ผ่านไปสองเดือนแล้วเห็น
     * "SCB → กรุงไทย 20,000" จะไม่มีทางรู้เลยว่าโอนไปทำไม
     */
    note: text("note"),
    ...auditColumns,
  },
  (t) => [
    check("transfers_amount_check", sql`${t.amount} > 0`),
    // กันโอนเข้าบัญชีตัวเองซึ่งไม่มีความหมายและทำให้ยอดดูเหมือนขยับทั้งที่ไม่ขยับ
    // บังคับที่ระดับฐานข้อมูลด้วย ไม่ได้เชื่อฝั่งแอปอย่างเดียว
    check("transfers_accounts_differ_check", sql`${t.fromAccountId} <> ${t.toAccountId}`),
    // desc เขียนเองด้วย sql`` ด้วยเหตุผลเดียวกับดัชนีของ transactions ข้างบน
    index("idx_transfers_shop_date").on(t.shopId, t.isDeleted, sql`${t.txnDate} desc`),
    index("idx_transfers_from").on(t.fromAccountId, t.isDeleted),
    index("idx_transfers_to").on(t.toAccountId, t.isDeleted),
  ],
).enableRLS();

/* ------------------------------------------------------------------ */
/*  ชนิดที่อนุมานจาก schema — อย่าประกาศ type ของแถวซ้ำที่อื่น          */
/* ------------------------------------------------------------------ */

export type Shop = typeof shops.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;

/**
 * ตั้งใจมีแค่สามตัวนี้ ไม่ได้ประกาศครบทุกตาราง
 *
 * เพราะรายการกับการโอนไม่เคยถูกส่งออกไปเป็นแถวดิบๆ — ฝั่งที่ใช้ต้องการชื่อ
 * ประเภทกับชื่อบัญชีติดไปด้วยเสมอ จึงมี TxnRow กับ MovementRow ใน queries.ts
 * ที่ตรงกับสิ่งที่หน้าจอใช้จริง ประกาศ type เผื่อไว้เฉยๆ มีแต่จะทำให้คนหยิบ
 * ตัวที่ใกล้มือไปใช้แล้วต้องมา join ชื่อเพิ่มเองทีหลัง
 *
 * ส่วนชนิดสำหรับ insert ไม่ต้องมี เพราะทุกที่ที่เขียนข้อมูลใช้ค่าที่ผ่าน
 * Zod มาแล้ว ซึ่งมีชนิดของตัวเองอยู่ที่ src/lib/validation.ts
 */
