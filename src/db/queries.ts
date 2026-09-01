import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./index";
import { accounts, categories, shops, transactions, transfers } from "./schema";
import type { Account, Category, Direction, Shop } from "./schema";
import { addDays, monthRange, today, weekRange, yearRange } from "@/lib/date";

/**
 * การอ่านข้อมูลทั้งหมดของแอปอยู่ในไฟล์นี้ไฟล์เดียว
 *
 * กติกาสามข้อที่ห้ามละเมิด
 *
 * 1) ทุกฟังก์ชันที่แตะข้อมูลของร้าน รับ shopId เป็นพารามิเตอร์แรกแบบบังคับ
 *    ลืมส่งแล้ว TypeScript ฟ้องตั้งแต่ตอนเขียน ไม่ใช่ไปเจอตอนข้อมูลร้านหนึ่ง
 *    โผล่ในอีกร้าน
 *
 * 2) การรวมยอดเงินทุกครั้งเกิดใน SQL ห้ามดึงแถวออกมาบวกใน JavaScript
 *    เพราะ number ของ JS ปัดเศษทศนิยมเพี้ยน ดู src/lib/money.ts
 *
 * 3) ทุก query กรอง is_deleted = false เสมอ รวมถึง subquery ที่ซ้อนอยู่ข้างใน
 *    ลืมที่เดียวแล้วรายการที่ลบไปแล้วจะยังเดินยอดบัญชีอยู่ ซึ่งเป็นบั๊ก
 *    ที่หายากมากเพราะตัวเลขผิดแค่บางบัญชีและไม่มี error ให้เห็น
 */

/* ------------------------------------------------------------------ */
/*  ชิ้นส่วน SQL ที่ใช้ซ้ำ                                              */
/* ------------------------------------------------------------------ */

/**
 * ธง counts ของรายการหนึ่งบรรทัด
 *
 * รายการที่ประเภทถูกลบไปแล้วให้ถือว่านับเป็นกำไร เพราะกรณีปกติคือประเภท
 * ที่นับ การเดาแบบนี้ปลอดภัยกว่าการเงียบๆ แล้วทำให้กำไรของวันหายไปเฉยๆ
 */
const countsFlag = sql`coalesce(${categories.counts}, true)`;

/** เงินที่เข้าออกบัญชีจริงหนึ่งบรรทัด — เข้าเป็นบวก ออกเป็นลบ */
const signedAmount = sql`case when ${transactions.direction} = 'in' then ${transactions.amount} else -${transactions.amount} end`;

/** รวมยอดเฉพาะทิศทางที่ระบุ และเฉพาะรายการที่นับเป็นกำไรเท่านั้น */
const sumCounted = (direction: Direction) =>
  sql<string>`coalesce(sum(case when ${transactions.direction} = ${direction} and ${countsFlag} then ${transactions.amount} else 0 end), 0)`;

/** รวมยอดเฉพาะทิศทางที่ระบุ ของรายการที่ "ไม่" นับเป็นกำไร */
const sumExcluded = (direction: Direction) =>
  sql<string>`coalesce(sum(case when ${transactions.direction} = ${direction} and not ${countsFlag} then ${transactions.amount} else 0 end), 0)`;

/** กำไร = รายรับที่นับ − รายจ่ายที่นับ คิดใน SQL ทั้งก้อน */
const sumProfit = sql<string>`coalesce(sum(case when ${countsFlag} then ${signedAmount} else 0 end), 0)`;

/**
 * เงินที่เดินจริงทั้งหมดของประเภทที่ไม่นับเป็นกำไร รวมทั้งขาเข้าและขาออก
 *
 * รวมที่นี่แทนที่จะให้ฝั่ง React เอา inExcluded กับ outExcluded มาบวกกัน
 * เพราะนั่นคือการบวกเงินใน JavaScript ซึ่งเป็นสิ่งที่ไฟล์นี้ห้ามไว้
 * ต่อให้เป็นแค่ตัวเลขโชว์ ก็ไม่ควรมีข้อยกเว้นให้จำผิดกันทีหลัง
 */
const sumExcludedTotal = sql<string>`coalesce(sum(case when not ${countsFlag} then ${transactions.amount} else 0 end), 0)`;

/**
 * ยอดเงินที่รายการทั้งหมดของบัญชีหนึ่งทำให้เปลี่ยนไป
 *
 * เขียนเป็น subquery ที่อ้างถึง accounts.id ข้างนอก เพราะบัญชีกลางถูกใช้
 * ได้หลายร้าน ยอดคงเหลือจึงต้องรวมรายการของทุกร้าน ไม่ใช่แค่ร้านที่กำลังดู
 *
 * ⚠️ ไม่มีเงื่อนไข counts ตรงนี้โดยตั้งใจ เงินออกจากบัญชีจริงไม่ว่าจะนับ
 *    เป็นกำไรหรือไม่ ถ้าเติมเงื่อนไข counts เข้าไป ยอดในแอปจะไม่ตรงกับ
 *    ยอดในแอปธนาคารทันที
 *
 * ⚠️ ห้ามเอา fragment นี้ไปใส่เป็นช่องใน select ตรงๆ ต้องห่อในบล็อก sql
 *    อีกชั้นเสมอ อย่างที่ balanceExpr ทำ
 *
 *    เหตุผล: drizzle ตัดชื่อตารางออกจากคอลัมน์ที่อ้างในบล็อก sql เมื่อ query
 *    นั้นดึงจากตารางเดียวไม่มี join เพราะถือว่าไม่กำกวม ${accounts.id}
 *    จึงกลายเป็น "id" เปล่าๆ แล้ว Postgres ไปจับคู่กับ tx.id ของ subquery แทน
 *    ได้เงื่อนไข tx.account_id = tx.id ซึ่งไม่มีทางจริง ผลคือได้ 0 เสมอ
 *    โดยไม่มี error ให้เห็นสักตัว
 *
 *    พอห่ออีกชั้น คอลัมน์จะถูกเขียนเต็มเป็น "accounts"."id" ตามที่ต้องการ
 *    เทสยอดคงเหลือใน queries.itest.ts เป็นตัวจับถ้าวันหนึ่งมันหลุดอีก
 */
const accountMovement = () => sql`coalesce((
  select sum(case when tx.direction = 'in' then tx.amount else -tx.amount end)
    from transactions tx
   where tx.account_id = ${accounts.id}
     and tx.is_deleted = false
), 0)`;

/**
 * เงินที่การโอนทำให้บัญชีนี้เปลี่ยนไป — เข้าเป็นบวก ออกเป็นลบ
 *
 * ⚠️ ขาดตรงนี้ไม่ได้เด็ดขาด การโอนเป็นเงินที่ย้ายที่จริง ถ้าคิดยอดคงเหลือ
 *    โดยไม่รวมตาราง transfers ยอดในแอปจะไม่ตรงกับยอดในแอปธนาคารทันที
 *    และเป็นความผิดที่หายากมาก เพราะผิดเฉพาะบัญชีที่เคยมีการโอน
 *
 * เขียนเป็นก้อนเดียวที่รวมทั้งขาเข้าและขาออก เพื่อไม่ให้มีโอกาสที่ใคร
 * เผลอใส่แค่ขาใดขาหนึ่งแล้วยอดเพี้ยนไปทางเดียว
 */
const transferMovement = () => sql`coalesce((
  select sum(case when tf.to_account_id = ${accounts.id} then tf.amount else -tf.amount end)
    from transfers tf
   where (tf.to_account_id = ${accounts.id} or tf.from_account_id = ${accounts.id})
     and tf.is_deleted = false
), 0)`;

/**
 * ยอดคงเหลือจริงของบัญชี = ยอดตั้งต้น + รายการที่ผ่านบัญชี + การโอน
 *
 * ⚠️ ต้องห่อ subquery ไว้ในบล็อก sql ชั้นนอกแบบนี้เสมอ
 *    drizzle ตัดชื่อตารางออกจากคอลัมน์เมื่อ query ดึงจากตารางเดียวไม่มี join
 *    ${accounts.id} จะกลายเป็น "id" เปล่าๆ แล้วไปจับคู่กับคอลัมน์ของ
 *    subquery เอง ได้เงื่อนไขที่ไม่มีทางจริง ผลคือได้ 0 เงียบๆ ไม่มี error
 *    เทสยอดใน queries.itest.ts เป็นตัวจับถ้าหลุด
 */
const balanceExpr = sql<string>`(${accounts.openingBalance} + ${accountMovement()} + ${transferMovement()})`;

/* ------------------------------------------------------------------ */
/*  ร้าน                                                               */
/* ------------------------------------------------------------------ */

export async function listShops(): Promise<Shop[]> {
  return db
    .select()
    .from(shops)
    .where(and(eq(shops.isDeleted, false), eq(shops.isActive, true)))
    .orderBy(asc(shops.sortOrder), asc(shops.name));
}

export type ShopCard = Shop & {
  todayProfit: string;
  todayCount: number;
  /** จำนวนรายการทั้งหมดที่ยังไม่ถูกลบ ใช้เตือนตอนจะลบร้าน */
  totalCount: number;
};

/**
 * ร้านทั้งหมดพร้อมกำไรของวันนี้ ใช้ที่หน้าเลือกร้าน
 *
 * เป็น query เดียวที่ join แล้ว group ไม่ใช่วนถามทีละร้าน เพราะหน้านี้คือ
 * หน้าแรกที่เห็นหลังใส่รหัส ถ้ายิงทีละร้านแล้วมีหลายร้าน จะรอนานขึ้น
 * ตามจำนวนร้านซึ่งรู้สึกได้ชัดบนเน็ตมือถือ
 *
 * ใช้ left join ทั้งหมด ร้านที่วันนี้ยังไม่มีรายการจึงยังโผล่ในรายการ
 * โดยได้กำไรเป็น 0 ไม่ใช่หายไปเฉยๆ
 */
export async function listShopsWithToday(today: string): Promise<ShopCard[]> {
  return db
    .select({
      id: shops.id,
      name: shops.name,
      sortOrder: shops.sortOrder,
      isActive: shops.isActive,
      isDeleted: shops.isDeleted,
      createdAt: shops.createdAt,
      updatedAt: shops.updatedAt,
      todayProfit: sumProfit,
      todayCount: sql<number>`count(${transactions.id})::int`,
      // นับแยกด้วย subquery ไม่ใช่จาก join ข้างบน เพราะ join ถูกจำกัดไว้
      // เฉพาะรายการของวันนี้แล้ว จะนับรายการทั้งหมดจากตรงนั้นไม่ได้
      // ⚠️ ${shops.id} ถูกห่อในบล็อก sql ของตัวเองก่อนเสมอ — ดูกฎที่ balanceExpr
      //    query นี้มี join จึงไม่โดนตัดชื่อตารางวันนี้ แต่วันที่ใครแยก query นี้
      //    ออกไปโดยไม่มี join มันจะกลายเป็น tx.shop_id = tx.id เงียบๆ ทันที
      totalCount: sql<number>`(
        select count(*)::int from transactions tx
         where tx.shop_id = ${sql`${shops.id}`} and tx.is_deleted = false
      )`,
    })
    .from(shops)
    .leftJoin(
      transactions,
      and(
        eq(transactions.shopId, shops.id),
        eq(transactions.isDeleted, false),
        eq(transactions.txnDate, today),
      ),
    )
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(shops.isDeleted, false), eq(shops.isActive, true)))
    .groupBy(shops.id)
    .orderBy(asc(shops.sortOrder), asc(shops.name));
}

export async function getShop(shopId: string): Promise<Shop | null> {
  const [row] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.id, shopId), eq(shops.isDeleted, false), eq(shops.isActive, true)))
    .limit(1);

  return row ?? null;
}

/* ------------------------------------------------------------------ */
/*  บัญชี                                                              */
/* ------------------------------------------------------------------ */

export type AccountWithBalance = Account & {
  /** ยอดคงเหลือจริงของบัญชี ตัวเลขนี้ต้องตรงกับแอปธนาคาร */
  balance: string;
};

const accountSelection = () => ({
  id: accounts.id,
  shopId: accounts.shopId,
  name: accounts.name,
  kind: accounts.kind,
  bank: accounts.bank,
  accountNo: accounts.accountNo,
  openingBalance: accounts.openingBalance,
  sortOrder: accounts.sortOrder,
  isActive: accounts.isActive,
  isDeleted: accounts.isDeleted,
  createdAt: accounts.createdAt,
  updatedAt: accounts.updatedAt,
  balance: balanceExpr,
});

/**
 * บัญชีของร้านนี้เท่านั้น
 *
 * เคยมีบัญชี "ของกลาง" ที่ทุกร้านเห็น เอาออกแล้ว — เจ้าของร้านต้องการ
 * ให้แยกขาด 100% และบัญชีที่ใช้ร่วมกันทำให้ยอดคงเหลือรวมเงินของอีกร้าน
 * เข้ามาด้วย ซึ่งอธิบายให้คนอ่านเข้าใจยากมาก
 */
const visibleToShop = (shopId: string) =>
  and(eq(accounts.isDeleted, false), eq(accounts.shopId, shopId));

/**
 * บัญชีที่ร้านนี้มองเห็น พร้อมยอดคงเหลือที่คำนวณสดทุกครั้ง
 *
 * ยอดคงเหลือไม่ได้เก็บเป็นคอลัมน์ เพราะยอดที่เก็บไว้จะเพี้ยนทันทีที่มี
 * การอัปเดตพลาดสักครั้งเดียว แล้วไม่มีทางรู้ว่าเพี้ยนตั้งแต่เมื่อไหร่
 */
export async function listAccountsWithBalance(shopId: string): Promise<AccountWithBalance[]> {
  return db
    .select(accountSelection())
    .from(accounts)
    .where(and(visibleToShop(shopId), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name));
}

/** เหมือนข้างบน แต่รวมบัญชีที่ปิดใช้งานไว้ด้วย ใช้เฉพาะหน้าตั้งค่า */
export async function listAllAccountsForShop(shopId: string): Promise<AccountWithBalance[]> {
  return db
    .select(accountSelection())
    .from(accounts)
    .where(visibleToShop(shopId))
    .orderBy(desc(accounts.isActive), asc(accounts.sortOrder), asc(accounts.name));
}

/* ------------------------------------------------------------------ */
/*  ประเภท                                                             */
/* ------------------------------------------------------------------ */

/** ประเภทของร้านนี้เท่านั้น — เหตุผลเดียวกับบัญชี */
const categoryVisibleToShop = (shopId: string) =>
  and(eq(categories.isDeleted, false), eq(categories.shopId, shopId));

export async function listCategories(shopId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(and(categoryVisibleToShop(shopId), eq(categories.isActive, true)))
    .orderBy(
      asc(categories.direction),
      // ประเภทที่นับเป็นกำไรขึ้นก่อน เพราะเป็นตัวที่เลือกบ่อยที่สุด
      desc(categories.counts),
      asc(categories.sortOrder),
      asc(categories.name),
    );
}

/**
 * ชุดประเภทตั้งต้นเคยถูกใส่เข้าระบบแล้วหรือยัง
 *
 * ดูจากการมีประเภท "ของกลาง" (shop_id ว่าง) อยู่สักตัว เพราะชุดตั้งต้นถูกใส่
 * เป็นของกลางเสมอ ส่วนประเภทที่คนใช้สร้างเองจากหน้าตั้งค่าจะผูกกับร้านเสมอ
 * เงื่อนไขนี้จึงแยกสองอย่างนี้ออกจากกันได้โดยไม่ต้องไล่เทียบชื่อทีละตัว
 *
 * ใช้ตัดสินว่าจะโชว์ปุ่ม "เพิ่มชุดตั้งต้น" ในหน้าตั้งค่าไหม กดครั้งเดียวแล้ว
 * ปุ่มจะหายไปเอง ไม่ค้างเป็นปุ่มที่กดแล้วไม่เกิดอะไรขึ้น
 */
export async function hasDefaultCategories(shopId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(categoryVisibleToShop(shopId))
    .limit(1);

  return Boolean(row);
}

/** รวมประเภทที่ปิดใช้งานไว้ด้วย ใช้เฉพาะหน้าตั้งค่า */
export async function listAllCategories(shopId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(categoryVisibleToShop(shopId))
    .orderBy(
      asc(categories.direction),
      desc(categories.isActive),
      asc(categories.sortOrder),
      asc(categories.name),
    );
}

/* ------------------------------------------------------------------ */
/*  ตรวจสิทธิ์การมองเห็น                                               */
/* ------------------------------------------------------------------ */

/**
 * ยืนยันว่าบัญชีที่ส่งมาเป็นของร้านนี้จริง
 *
 * ต้องเช็คเพราะ id ที่มากับฟอร์มเป็นค่าที่แก้ได้จากฝั่ง browser
 * ถ้าไม่เช็ค คนที่เข้าถึงแอปได้จะผูกรายการของร้านหนึ่งเข้ากับบัญชีส่วนตัว
 * ของอีกร้านได้ แล้วยอดของทั้งสองร้านจะเพี้ยนโดยไม่มีใครรู้
 */
/**
 * mustBeActive ใช้ตอนสร้างรายการใหม่ — บัญชีที่กดปิดใช้งานไว้ต้องรับเงิน
 * เข้าออกใหม่ไม่ได้ ตามความหมายของปุ่มปิดใช้งาน (ฟอร์มปกติไม่โชว์ให้เลือก
 * อยู่แล้ว แต่ id ที่มากับฟอร์มปลอมได้เสมอ) ส่วนตอนแก้รายการเก่า
 * การอ้างถึงบัญชีเดิมที่ถูกปิดไปแล้วยังต้องผ่าน จึงเป็นพารามิเตอร์ ไม่ใช่กฎตายตัว
 */
export async function isAccountVisible(
  shopId: string,
  accountId: string,
  mustBeActive = false,
): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        visibleToShop(shopId),
        mustBeActive ? eq(accounts.isActive, true) : undefined,
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * คืนประเภทที่ร้านนี้มองเห็น ไม่เจอคืน null
 *
 * คืนทั้งแถวแทน true/false เพราะฝั่งที่เรียกต้องเช็คต่อว่า direction
 * ตรงกับของรายการไหม เอาประเภทฝั่งรับไปใส่รายการฝั่งจ่ายจะทำให้ยอดสรุปผิด
 * แบบเงียบๆ
 */
export async function getVisibleCategory(
  shopId: string,
  categoryId: string,
  mustBeActive = false,
): Promise<Category | null> {
  const [row] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        categoryVisibleToShop(shopId),
        mustBeActive ? eq(categories.isActive, true) : undefined,
      ),
    )
    .limit(1);

  return row ?? null;
}

/* ------------------------------------------------------------------ */
/*  ลำดับของที่เพิ่มใหม่                                               */
/* ------------------------------------------------------------------ */

export async function nextCategorySortOrder(shopId: string, direction: Direction): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${categories.sortOrder}), 0) + 1` })
    .from(categories)
    .where(and(eq(categories.direction, direction), categoryVisibleToShop(shopId)));

  return row?.next ?? 1;
}

export async function nextAccountSortOrder(shopId: string): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${accounts.sortOrder}), 0) + 1` })
    .from(accounts)
    .where(visibleToShop(shopId));

  return row?.next ?? 1;
}

export async function nextShopSortOrder(): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${shops.sortOrder}), 0) + 1` })
    .from(shops)
    .where(eq(shops.isDeleted, false));

  return row?.next ?? 1;
}

/* ------------------------------------------------------------------ */
/*  รายการเคลื่อนไหว                                                   */
/* ------------------------------------------------------------------ */

export type TxnRow = {
  id: string;
  shopId: string;
  txnDate: string;
  direction: Direction;
  categoryId: string | null;
  accountId: string | null;
  title: string;
  amount: string;
  note: string | null;
  createdAt: Date;
  categoryName: string | null;
  accountName: string | null;
  counts: boolean;
};

const txnSelection = {
  id: transactions.id,
  shopId: transactions.shopId,
  txnDate: transactions.txnDate,
  direction: transactions.direction,
  categoryId: transactions.categoryId,
  accountId: transactions.accountId,
  title: transactions.title,
  amount: transactions.amount,
  note: transactions.note,
  createdAt: transactions.createdAt,
  categoryName: categories.name,
  accountName: accounts.name,
  counts: sql<boolean>`${countsFlag}`,
};

export async function listTransactionsByDate(shopId: string, date: string): Promise<TxnRow[]> {
  return db
    .select(txnSelection)
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(transactions.shopId, shopId),
        eq(transactions.isDeleted, false),
        eq(transactions.txnDate, date),
      ),
    )
    .orderBy(asc(transactions.direction), desc(transactions.createdAt));
}

/**
 * รายการที่เพิ่งบันทึกล่าสุด ไม่ว่าจะเป็นของวันไหน
 *
 * เรียงด้วย created_at ไม่ใช่ txn_date โดยตั้งใจ — คำถามที่ลิสต์นี้ตอบคือ
 * "เมื่อกี้ที่กดบันทึกไป ลงถูกไหม" ซึ่งเป็นเรื่องของเวลาที่กด ไม่ใช่วันของรายการ
 *
 * ถ้าเรียงด้วย txn_date รายการที่เพิ่งลงย้อนหลังให้เมื่อวาน จะไม่โผล่ขึ้นมา
 * ให้เห็น แล้วคนจะนึกว่าบันทึกไม่ติดทั้งที่ติดแล้ว
 */
export async function listRecentEntries(shopId: string, limit = 3): Promise<TxnRow[]> {
  return db
    .select(txnSelection)
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(eq(transactions.shopId, shopId), eq(transactions.isDeleted, false)))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

export type SearchFilters = {
  /** คำค้น หาจากชื่อรายการและหมายเหตุ */
  q: string;
  direction?: Direction;
  from?: string;
  to?: string;
};

/**
 * ค้นหารายการย้อนหลัง
 *
 * ใช้ ILIKE ไม่ใช่ full-text search เพราะภาษาไทยไม่มีการเว้นวรรคระหว่างคำ
 * ตัวตัดคำของ Postgres จึงแยกคำไทยไม่ออก การค้นแบบ full-text จะพลาดคำที่
 * อยู่กลางประโยค ส่วน ILIKE '%คำ%' หาเจอทุกตำแหน่งแน่นอน
 *
 * แลกกับที่ ILIKE ใช้ดัชนีไม่ได้ ต้องอ่านทุกแถวของร้าน ซึ่งยอมรับได้เพราะ
 * ร้านหนึ่งมีรายการหลักพันถึงหมื่นต่อปี ไม่ใช่ล้าน ถ้าวันหนึ่งช้าขึ้นมาจริง
 * ค่อยเพิ่มดัชนี GIN แบบ trigram (pg_trgm) ทีหลังได้โดยไม่ต้องแก้โค้ดตรงนี้
 *
 * จำกัดผลไว้ 200 แถว กันการเผลอค้นคำสั้นๆ แล้วลากข้อมูลทั้งร้านมาทั้งก้อน
 */
export async function searchTransactions(
  shopId: string,
  filters: SearchFilters,
  limit = 50,
): Promise<TxnRow[]> {
  // escape อักขระพิเศษของ LIKE ไม่งั้นคนพิมพ์ % หรือ _ จะกลายเป็นตัวแทนที่
  const pattern = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const conditions = [
    eq(transactions.shopId, shopId),
    eq(transactions.isDeleted, false),
    or(
      ilike(transactions.title, pattern),
      ilike(transactions.note, pattern),
      ilike(categories.name, pattern),
    ),
  ];

  if (filters.direction) conditions.push(eq(transactions.direction, filters.direction));
  if (filters.from) conditions.push(gte(transactions.txnDate, filters.from));
  if (filters.to) conditions.push(lte(transactions.txnDate, filters.to));

  return db
    .select(txnSelection)
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(...conditions))
    .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
    .limit(limit);
}

/** ยอดรวมของผลค้นหา คิดใน SQL เหมือนทุกที่ ไม่บวกจากแถวที่ได้มา */
export async function searchTotals(
  shopId: string,
  filters: SearchFilters,
): Promise<{ income: string; expense: string; count: number }> {
  const pattern = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const conditions = [
    eq(transactions.shopId, shopId),
    eq(transactions.isDeleted, false),
    or(
      ilike(transactions.title, pattern),
      ilike(transactions.note, pattern),
      ilike(categories.name, pattern),
    ),
  ];

  if (filters.direction) conditions.push(eq(transactions.direction, filters.direction));
  if (filters.from) conditions.push(gte(transactions.txnDate, filters.from));
  if (filters.to) conditions.push(lte(transactions.txnDate, filters.to));

  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.direction} = 'in' then ${transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.direction} = 'out' then ${transactions.amount} else 0 end), 0)`,
      count: count(),
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(...conditions));

  return row ?? { income: "0", expense: "0", count: 0 };
}

/**
 * ชื่อรายการที่เคยพิมพ์ในร้านนี้ ใช้เติมคำอัตโนมัติในฟอร์ม
 *
 * mode() within group คือ "ค่าที่พบบ่อยที่สุดในกลุ่ม" ของ Postgres
 * ใช้เดาว่าชื่อนี้มักถูกจัดอยู่ในประเภทไหน แล้วเลือกให้ล่วงหน้า
 * บนมือถือช่วยลดการกดไปหนึ่งจังหวะต่อการบันทึกหนึ่งรายการ
 */
export async function listRecentTitles(
  shopId: string,
  direction: Direction,
): Promise<{ title: string; categoryId: string | null; uses: number }[]> {
  return db
    .select({
      title: transactions.title,
      categoryId: sql<string | null>`mode() within group (order by ${transactions.categoryId})`,
      uses: count(),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.shopId, shopId),
        eq(transactions.isDeleted, false),
        eq(transactions.direction, direction),
        /**
         * ดูย้อนหลังแค่ครึ่งปี ไม่ใช่ทั้งประวัติ
         *
         * เร็วขึ้นมาก — วัดที่ 22,000 รายการได้ 47ms เหลือไม่กี่มิลลิ เพราะ
         * เข้า index ตามช่วงวันแทนที่จะกวาดทั้งตารางมา group ทุกครั้งที่
         * เปิดหน้าบันทึก ซึ่งเป็นหน้าที่ถูกเปิดบ่อยที่สุดของแอป
         *
         * และได้คำแนะนำที่ดีกว่าด้วย — ชื่อที่ร้านใช้เมื่อปีที่แล้วแต่เลิกใช้
         * ไปแล้วไม่ควรมาเบียดที่ของชื่อที่ใช้อยู่จริงตอนนี้
         */
        gte(transactions.txnDate, addDays(today(), -180)),
      ),
    )
    .groupBy(transactions.title)
    .orderBy(desc(count()), desc(sql`max(${transactions.createdAt})`))
    .limit(40);
}

/**
 * วันที่ของรายการล่าสุดของร้าน — ใช้เลือกว่าหน้าสรุปควรเปิดมุมมองไหน
 *
 * ดูที่ txn_date (วันของรายการ) ไม่ใช่ created_at เพราะคำถามคือ
 * "ช่วงไหนมีข้อมูลให้ดู" การลงย้อนหลังของเมื่อวานตอนเช้านี้ ก็คือ
 * ข้อมูลของเมื่อวาน ไม่ใช่ของวันนี้
 */
export async function latestTxnDate(shopId: string): Promise<string | null> {
  const [row] = await db
    .select({ txnDate: transactions.txnDate })
    .from(transactions)
    .where(and(eq(transactions.shopId, shopId), eq(transactions.isDeleted, false)))
    .orderBy(desc(transactions.txnDate))
    .limit(1);

  return row?.txnDate ?? null;
}

/* ------------------------------------------------------------------ */
/*  การโอนเงินระหว่างบัญชี                                             */
/* ------------------------------------------------------------------ */

/**
 * ชื่อบัญชีสองฝั่งของการโอน ต้อง join ตาราง accounts สองครั้ง
 * จึงต้องตั้งชื่อเล่นให้แต่ละครั้ง ไม่งั้น SQL ไม่รู้ว่า accounts.name
 * หมายถึงฝั่งไหน
 */
const fromAccount = alias(accounts, "from_account");
const toAccount = alias(accounts, "to_account");

/* ------------------------------------------------------------------ */
/*  ความเคลื่อนไหวรายบัญชี                                             */
/* ------------------------------------------------------------------ */

/**
 * หนึ่งบรรทัดในหน้า "เงินเข้าออกบัญชีนี้"
 *
 * signed คือผลต่อบัญชีที่กำลังดู บวกคือเข้า ลบคือออก คิดมาแล้วจากฝั่ง
 * เซิร์ฟเวอร์ ฝั่ง React ไม่ต้องรู้ว่าแถวนี้มาจากตารางไหนถึงจะแสดงถูก
 */
export type MovementRow = {
  kind: "txn" | "transfer";
  id: string;
  txnDate: string;
  /** ผลต่อบัญชีนี้ — บวกคือเงินเข้า ลบคือเงินออก */
  signed: string;
  /** ชื่อรายการ หรือชื่อบัญชีอีกฝั่งของการโอน */
  label: string;
  /** ประเภท (รายการ) — การโอนไม่มี */
  categoryName: string | null;
  note: string | null;
  createdAt: Date;
  /**
   * ข้อมูลที่ฟอร์มแก้ไขการโอนต้องใช้ มีเฉพาะแถวที่เป็นการโอน
   *
   * ส่ง id ของทั้งสองฝั่งมาตรงๆ ไม่ให้ฝั่ง React ต้องเดาย้อนจากชื่อบัญชี
   * เพราะชื่อซ้ำกันได้ (เช่นมีบัญชีชื่อ "เงินสด" ทั้งของร้านและของกลาง)
   * แล้วจะเดาผิดเป็นคนละบัญชีโดยไม่มีอะไรฟ้อง
   */
  transfer: { fromAccountId: string; toAccountId: string } | null;
};

/**
 * เงินเข้าออกของบัญชีหนึ่ง รวมทั้งรายการปกติและการโอน เรียงวันใหม่สุดขึ้นก่อน
 *
 * ดึงสองตารางแยกกันแล้วมาเรียงรวมใน JavaScript ไม่ได้ใช้ union ใน SQL
 * เพราะ union ต้องบังคับให้สองฝั่งมีคอลัมน์เหมือนกันเป๊ะ ซึ่งต้องเขียน SQL
 * ดิบยาวๆ ที่ TypeScript ตรวจให้ไม่ได้ — และ SQL ดิบคือที่ที่เพิ่งเจอบั๊ก
 * คอลัมน์ผูกผิดตารางแบบเงียบๆ มาแล้ว
 *
 * ที่เรียงใน JS ได้โดยไม่ผิด เพราะไม่มีการบวกลบเงินเกิดขึ้นเลย แค่จัดลำดับ
 * ส่วนยอดคงเหลือยังคิดใน SQL เหมือนเดิม
 *
 * ดึงมาเผื่อสองเท่าของ limit จากแต่ละฝั่ง เพื่อให้หลังเรียงรวมแล้วยังได้
 * บรรทัดใหม่สุดครบตามจำนวนที่ขอ ไม่ว่าฝั่งไหนจะมีเยอะกว่ากัน
 */
export async function listAccountMovements(
  shopId: string,
  accountId: string,
  limit = 60,
): Promise<MovementRow[]> {
  /**
   * ตรวจก่อนว่าบัญชีนี้เป็นบัญชีที่ร้านนี้มองเห็นจริง ไม่เห็นก็ได้ลิสต์ว่าง
   *
   * เดิมพึ่งให้ฝั่งที่เรียกตรวจเองแล้วทิ้งผลลัพธ์ ซึ่งทำถูกอยู่หนึ่งที่
   * แต่เป็นธรรมเนียมที่ลืมได้ พอย้ายเข้ามาไว้ในนี้ ผู้เรียกรายต่อไป
   * ลืมยังไงข้อมูลร้านอื่นก็ไม่หลุด และ TypeScript บังคับให้ส่ง shopId มาเสมอ
   *
   * ความเคลื่อนไหวข้างในไม่กรองร้านโดยตั้งใจ — บัญชีที่ใช้ร่วมกันทุกร้าน
   * ต้องเห็นเงินเข้าออกของทุกร้าน ไม่งั้นยอดคงเหลือที่โชว์จะอธิบายไม่ได้
   */
  if (!(await isAccountVisible(shopId, accountId))) return [];

  const [txnRows, transferRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        txnDate: transactions.txnDate,
        direction: transactions.direction,
        amount: transactions.amount,
        title: transactions.title,
        note: transactions.note,
        createdAt: transactions.createdAt,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(eq(transactions.accountId, accountId), eq(transactions.isDeleted, false)))
      .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
      .limit(limit),

    db
      .select({
        id: transfers.id,
        txnDate: transfers.txnDate,
        amount: transfers.amount,
        note: transfers.note,
        createdAt: transfers.createdAt,
        fromAccountId: transfers.fromAccountId,
        toAccountId: transfers.toAccountId,
        fromName: fromAccount.name,
        toName: toAccount.name,
      })
      .from(transfers)
      .innerJoin(fromAccount, eq(fromAccount.id, transfers.fromAccountId))
      .innerJoin(toAccount, eq(toAccount.id, transfers.toAccountId))
      .where(
        and(
          or(eq(transfers.fromAccountId, accountId), eq(transfers.toAccountId, accountId)),
          eq(transfers.isDeleted, false),
        ),
      )
      .orderBy(desc(transfers.txnDate), desc(transfers.createdAt))
      .limit(limit),
  ]);

  const merged: MovementRow[] = [
    ...txnRows.map((r) => ({
      kind: "txn" as const,
      id: r.id,
      txnDate: r.txnDate,
      // ติดลบด้วยการเติมเครื่องหมายหน้า string ไม่ได้แปลงเป็น number
      signed: r.direction === "in" ? r.amount : `-${r.amount}`,
      label: r.title,
      categoryName: r.categoryName,
      note: r.note,
      createdAt: r.createdAt,
      transfer: null,
    })),
    ...transferRows.map((r) => {
      const outgoing = r.fromAccountId === accountId;
      return {
        kind: "transfer" as const,
        id: r.id,
        txnDate: r.txnDate,
        signed: outgoing ? `-${r.amount}` : r.amount,
        // ชื่อบัญชีอีกฝั่ง — ฝั่ง React เติมคำว่า "ไป" หรือ "จาก" ให้เอง
        label: outgoing ? r.toName : r.fromName,
        categoryName: null,
        note: r.note,
        createdAt: r.createdAt,
        transfer: { fromAccountId: r.fromAccountId, toAccountId: r.toAccountId },
      };
    }),
  ];

  merged.sort((a, b) =>
    a.txnDate === b.txnDate
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : a.txnDate < b.txnDate
        ? 1
        : -1,
  );

  return merged.slice(0, limit);
}

/**
 * จำนวนความเคลื่อนไหวทั้งหมดของบัญชี ไม่สนใจเพดานของลิสต์
 *
 * มีไว้บอกความจริงท้ายลิสต์ว่า "แสดง 50 จาก 128 รายการ" ซึ่งจำเป็นเพราะ
 * ลิสต์ที่ตัดแล้วหยุดเฉยๆ อ่านได้ว่าไม่มีรายการเก่ากว่านี้แล้ว
 *
 * ต้องนับสองตารางแล้วบวกกัน เพราะความเคลื่อนไหวของบัญชีมาจากทั้งรายการ
 * ปกติและการโอน เหมือนกับที่ listAccountMovements ดึงมารวมกัน
 */
export async function countAccountMovements(
  shopId: string,
  accountId: string,
): Promise<number> {
  // ด่านเดียวกับ listAccountMovements — บัญชีที่ร้านนี้ไม่เห็น ต้องได้ศูนย์
  // ไม่ใช่จำนวนจริงซึ่งเป็นการบอกใบ้ว่าบัญชีนั้นมีอยู่และมีเงินเดินเท่าไหร่
  if (!(await isAccountVisible(shopId, accountId))) return 0;

  const [[txn], [transfer]] = await Promise.all([
    db
      .select({ n: count() })
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.isDeleted, false))),

    db
      .select({ n: count() })
      .from(transfers)
      .where(
        and(
          or(eq(transfers.fromAccountId, accountId), eq(transfers.toAccountId, accountId)),
          eq(transfers.isDeleted, false),
        ),
      ),
  ]);

  return (txn?.n ?? 0) + (transfer?.n ?? 0);
}

/* ------------------------------------------------------------------ */
/*  สรุปยอด                                                            */
/* ------------------------------------------------------------------ */

export type Summary = {
  income: string;
  expense: string;
  profit: string;
  /** เงินที่เดินจริงแต่ไม่ถูกนับเป็นกำไร แยกไว้ให้เห็นว่ามีอยู่ ไม่ได้หายไป */
  inExcluded: string;
  outExcluded: string;
  /** สองตัวข้างบนรวมกัน คิดมาจาก SQL แล้ว ฝั่ง React ไม่ต้องบวกเอง */
  excluded: string;
};

const summarySelection = {
  income: sumCounted("in"),
  expense: sumCounted("out"),
  profit: sumProfit,
  inExcluded: sumExcluded("in"),
  outExcluded: sumExcluded("out"),
  excluded: sumExcludedTotal,
};

const EMPTY_SUMMARY: Summary = {
  income: "0",
  expense: "0",
  profit: "0",
  inExcluded: "0",
  outExcluded: "0",
  excluded: "0",
};

export type Period =
  | { day: string }
  | { week: string }
  | { month: string }
  | { year: string }
  /** ช่วงกำหนดเอง ใช้ตอนส่งออกที่คนเลือกวันเริ่มวันจบเอง */
  | { from: string; to: string };

/**
 * ช่วงวันของทุกมุมมอง — วัน เดือน ปี ต่างกันแค่ขอบเขต ไม่ใช่วิธีคิด
 *
 * txn_date เป็นชนิด date ล้วน การเทียบ >= และ <= จึงไม่มี timezone
 * เข้ามาเกี่ยวเลย ผลลัพธ์เหมือนกันไม่ว่าเซิร์ฟเวอร์จะตั้งเวลาไว้เป็นอะไร
 */
function rangeOf(period: Period): [string, string] {
  if ("day" in period) return [period.day, period.day];
  if ("week" in period) return weekRange(period.week);
  if ("from" in period) return [period.from, period.to];
  if ("month" in period) return monthRange(period.month);
  return yearRange(period.year);
}

/** เงื่อนไข where ที่ทุกมุมมองใช้ร่วมกัน — ผูกร้านและตัดของที่ลบแล้วเสมอ */
function scopeOf(shopId: string, period: Period) {
  const [from, to] = rangeOf(period);

  return and(
    eq(transactions.shopId, shopId),
    eq(transactions.isDeleted, false),
    gte(transactions.txnDate, from),
    lte(transactions.txnDate, to),
  );
}

/** ยอดสรุปของช่วงใดก็ได้ — วัน เดือน หรือปี ใช้ฟังก์ชันเดียวกันหมด */
export async function getSummary(shopId: string, period: Period): Promise<Summary> {
  const [row] = await db
    .select(summarySelection)
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(scopeOf(shopId, period));

  return row ?? EMPTY_SUMMARY;
}

export type DailyRow = Summary & { txnDate: string; txnCount: number };

/**
 * ยอดรายวันของช่วงใดก็ได้ เรียงวันใหม่สุดขึ้นก่อน
 *
 * ใช้ทั้งมุมมองสัปดาห์และมุมมองเดือน ต่างกันแค่ขอบเขตวันที่ส่งเข้ามา
 * จึงไม่มีทางที่ยอดรายวันในสองมุมมองจะคิดกันคนละวิธี
 */
export async function listDailyIn(shopId: string, period: Period): Promise<DailyRow[]> {
  return db
    .select({ txnDate: transactions.txnDate, txnCount: count(), ...summarySelection })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(scopeOf(shopId, period))
    .groupBy(transactions.txnDate)
    .orderBy(desc(transactions.txnDate));
}

/** ยอดรายวันของทั้งเดือน เรียงวันใหม่สุดขึ้นก่อน */
export async function listDailyForMonth(shopId: string, month: string): Promise<DailyRow[]> {
  return listDailyIn(shopId, { month });
}

/** ยอดรายวันของสัปดาห์ — สัปดาห์แทนด้วยวันจันทร์ของสัปดาห์นั้น */
export async function listDailyForWeek(shopId: string, week: string): Promise<DailyRow[]> {
  return listDailyIn(shopId, { week });
}

export type MonthlyRow = Summary & { month: string; txnCount: number };

/**
 * ยอดรายเดือนของทั้งปี เรียงเดือนเก่าไปใหม่เพื่อให้อ่านเป็นแนวโน้มได้
 *
 * to_char ทำงานบนคอลัมน์ date ล้วน จึงไม่มีการแปลง timezone เกิดขึ้น
 * ต่างจาก date_trunc บน timestamptz ที่ผลลัพธ์ขึ้นกับ TimeZone ของ session
 */
export async function listMonthlyForYear(shopId: string, year: string): Promise<MonthlyRow[]> {
  const monthExpr = sql<string>`to_char(${transactions.txnDate}, 'YYYY-MM')`;

  return db
    .select({ month: monthExpr, txnCount: count(), ...summarySelection })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(scopeOf(shopId, { year }))
    .groupBy(monthExpr)
    .orderBy(asc(monthExpr));
}

export type CategoryTotal = {
  categoryId: string | null;
  name: string;
  direction: Direction;
  counts: boolean;
  total: string;
  txnCount: number;
};

/** ยอดรวมรายประเภทของช่วงใดก็ได้ ตอบว่าเงินหมดไปกับอะไรมากที่สุด */
export async function listCategoryTotals(
  shopId: string,
  period: Period,
): Promise<CategoryTotal[]> {
  return db
    .select({
      categoryId: transactions.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'ไม่ระบุประเภท')`,
      direction: transactions.direction,
      counts: sql<boolean>`${countsFlag}`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      txnCount: count(),
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(scopeOf(shopId, period))
    .groupBy(transactions.categoryId, categories.name, transactions.direction, categories.counts)
    .orderBy(desc(sql`sum(${transactions.amount})`));
}

/* ------------------------------------------------------------------ */
/*  ส่งออก                                                             */
/* ------------------------------------------------------------------ */

/**
 * ดึงข้อมูลทั้งฐานออกมา (เฉพาะที่ยังไม่ถูกลบ)
 *
 * มีตั้งแต่วันแรกโดยตั้งใจ ข้อมูลบัญชีของร้านต้องเอาออกไปได้เสมอ
 * ไม่ว่าจะย้ายโฮสต์ ย้ายฐานข้อมูล หรือเลิกใช้แอปนี้ไปเลย
 *
 * ถ้าต้องการสำเนาที่รวมของที่ลบไปแล้วด้วย ให้ใช้ pg_dump ซึ่งได้ทุกแถวจริงๆ
 */
export async function exportAll() {
  const [shopRows, accountRows, categoryRows, txnRows, transferRows] = await Promise.all([
    db.select().from(shops).where(eq(shops.isDeleted, false)).orderBy(asc(shops.sortOrder)),
    db.select().from(accounts).where(eq(accounts.isDeleted, false)).orderBy(asc(accounts.sortOrder)),
    db
      .select()
      .from(categories)
      .where(eq(categories.isDeleted, false))
      .orderBy(asc(categories.direction), asc(categories.sortOrder)),
    db
      .select()
      .from(transactions)
      .where(eq(transactions.isDeleted, false))
      .orderBy(asc(transactions.txnDate), asc(transactions.createdAt)),
    // การโอนอยู่คนละตารางกับรายการ ถ้าไม่ใส่ตรงนี้ด้วย สำเนาที่ส่งออกไป
    // จะอธิบายยอดคงเหลือของบัญชีไม่ได้ เพราะขาดเงินที่ย้ายไปมา
    db
      .select()
      .from(transfers)
      .where(eq(transfers.isDeleted, false))
      .orderBy(asc(transfers.txnDate), asc(transfers.createdAt)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    shops: shopRows,
    accounts: accountRows,
    categories: categoryRows,
    transactions: txnRows,
    transfers: transferRows,
  };
}

/**
 * รายการของร้านในช่วงที่เลือก พร้อมชื่อประเภทและชื่อบัญชี
 *
 * ⚠️ รับ shopId เสมอ ไม่มีโหมด "ทุกร้าน"
 *    ของเดิมดึงทุกร้านมารวมกัน ไฟล์ที่ส่งให้คนทำบัญชีของร้านหนึ่ง
 *    จึงมีรายการของอีกร้านปนอยู่ ซึ่งคนรับไฟล์ไปไม่มีทางรู้เลย
 */
export async function exportTransactionsFlat(shopId: string, period: Period) {
  return db
    .select({
      txnDate: transactions.txnDate,
      direction: transactions.direction,
      categoryName: categories.name,
      counts: sql<boolean>`${countsFlag}`,
      title: transactions.title,
      amount: transactions.amount,
      accountName: accounts.name,
      note: transactions.note,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(scopeOf(shopId, period))
    .orderBy(asc(transactions.txnDate), asc(transactions.createdAt));
}

/** การโอนของร้านในช่วงที่เลือก พร้อมชื่อบัญชีสองฝั่ง */
export async function exportTransfersFlat(shopId: string, period: Period) {
  const [from, to] = rangeOf(period);

  return db
    .select({
      txnDate: transfers.txnDate,
      fromName: fromAccount.name,
      toName: toAccount.name,
      amount: transfers.amount,
      note: transfers.note,
      createdAt: transfers.createdAt,
    })
    .from(transfers)
    .innerJoin(fromAccount, eq(fromAccount.id, transfers.fromAccountId))
    .innerJoin(toAccount, eq(toAccount.id, transfers.toAccountId))
    .where(
      and(
        eq(transfers.shopId, shopId),
        eq(transfers.isDeleted, false),
        gte(transfers.txnDate, from),
        lte(transfers.txnDate, to),
      ),
    )
    .orderBy(asc(transfers.txnDate), asc(transfers.createdAt));
}

export type CategoryEntry = {
  id: string;
  txnDate: string;
  title: string;
  amount: string;
  note: string | null;
  accountName: string | null;
};

/**
 * รายการที่ประกอบกันเป็นยอดของประเภทหนึ่งในช่วงหนึ่ง
 *
 * ตอบคำถามที่ยอดรวมตอบไม่ได้ — "ค่าแรง 1,890 คืออะไรบ้าง" ต้องกดแล้ว
 * เห็นทีละบรรทัดว่าจ่ายให้ใครวันไหนเท่าไหร่ ไม่ใช่ต้องไปไล่หาในรายวันเอง
 *
 * categoryId เป็น null ได้ = รายการที่ไม่ระบุประเภท ซึ่งโผล่ในสรุปเป็น
 * กลุ่มของตัวเองอยู่แล้ว จึงต้องเจาะดูได้เหมือนกลุ่มอื่น
 */
export async function listCategoryEntries(
  shopId: string,
  period: Period,
  categoryId: string | null,
  direction: Direction,
  limit = 50,
): Promise<CategoryEntry[]> {
  const [from, to] = rangeOf(period);

  return db
    .select({
      id: transactions.id,
      txnDate: transactions.txnDate,
      title: transactions.title,
      amount: transactions.amount,
      note: transactions.note,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(transactions.shopId, shopId),
        eq(transactions.isDeleted, false),
        eq(transactions.direction, direction),
        categoryId === null
          ? isNull(transactions.categoryId)
          : eq(transactions.categoryId, categoryId),
        gte(transactions.txnDate, from),
        lte(transactions.txnDate, to),
      ),
    )
    .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
    .limit(limit);
}

export type PeriodEntry = CategoryEntry & {
  categoryId: string | null;
  direction: Direction;
};

/**
 * จำนวนรายการต่อประเภทที่แนบไปกับหน้าสรุป — เกินนี้ให้กดดูทั้งหมดแทน
 *
 * ลดหลั่นตามความกว้างของช่วง เพราะจำนวนกลุ่มไม่เปลี่ยนแต่จำนวนรายการต่อกลุ่ม
 * โตตามช่วง วัดที่ 22,000 รายการแล้วมุมมองปีแนบไป 960 แถว = 199 KB ซึ่งหนัก
 * เกินไปสำหรับหน้าที่เปิดเป็นหน้าแรกบนเน็ตมือถือ
 *
 * ที่ลดได้โดยไม่เสียประโยชน์ เพราะคำถามที่คนถามตอนกางคือ "ก้อนนี้มาจากไหน"
 * ซึ่งตอบได้ด้วยรายการไม่กี่บรรทัด ส่วนคนที่อยากเห็นครบมีลิงก์ไปหน้าแจกแจง
 * เต็มอยู่แล้ว และหน้าบ้านบอกอยู่แล้วว่าเห็นไม่ครบ
 */
export function entriesPerCategory(period: Period): number {
  if ("day" in period) return 30;
  if ("week" in period) return 20;
  if ("month" in period) return 10;
  // ปีกับช่วงกำหนดเอง กว้างที่สุดและกางดูน้อยที่สุด
  return 5;
}

/**
 * รายการล่าสุดของทุกประเภทในช่วงเดียว จำกัดต่อประเภท — เลี้ยงส่วนกางดู
 * ในหน้าสรุป ที่กดแล้วต้องกางทันทีโดยไม่เปลี่ยนหน้าและไม่ยิงขอข้อมูลเพิ่ม
 *
 * ต้องจำกัด "ต่อประเภท" ไม่ใช่รวมทั้งก้อน — มุมมองปีมีรายการเป็นพัน
 * แนบไปหมดหน้าจะอ้วนโดยไม่มีใครกางดูครบ ส่วนประเภทที่เกินโควตา
 * หน้าบ้านมีลิงก์ไปหน้าแจกแจงเต็มซึ่งดึงเฉพาะประเภทนั้นอยู่แล้ว
 */
export async function listPeriodEntries(
  shopId: string,
  period: Period,
): Promise<PeriodEntry[]> {
  const [from, to] = rangeOf(period);
  const perCategory = entriesPerCategory(period);

  const ranked = db.$with("ranked").as(
    db
      .select({
        id: transactions.id,
        txnDate: transactions.txnDate,
        title: transactions.title,
        amount: transactions.amount,
        note: transactions.note,
        accountName: accounts.name,
        categoryId: transactions.categoryId,
        direction: transactions.direction,
        // ต้องดึงมาด้วย ไม่งั้นชั้นนอกเรียงตามเวลาไม่ได้ ต้องไปเรียงตาม id
        // ซึ่งเป็น uuid สุ่ม ทำให้รายการในวันเดียวกันสลับที่กันมั่ว
        createdAt: transactions.createdAt,
        rank: sql<number>`row_number() over (
          partition by ${transactions.categoryId}, ${transactions.direction}
          order by ${transactions.txnDate} desc, ${transactions.createdAt} desc
        )`.as("rank"),
      })
      .from(transactions)
      .leftJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.shopId, shopId),
          eq(transactions.isDeleted, false),
          gte(transactions.txnDate, from),
          lte(transactions.txnDate, to),
        ),
      ),
  );

  return db
    .with(ranked)
    .select({
      id: ranked.id,
      txnDate: ranked.txnDate,
      title: ranked.title,
      amount: ranked.amount,
      note: ranked.note,
      accountName: ranked.accountName,
      categoryId: ranked.categoryId,
      direction: ranked.direction,
    })
    .from(ranked)
    .where(lte(ranked.rank, perCategory))
    // เรียงเหมือนทุกที่ในแอป — วันใหม่ก่อน วันเดียวกันเอาที่พิมพ์ทีหลังขึ้นก่อน
    .orderBy(desc(ranked.txnDate), desc(ranked.createdAt));
}

export type AccountPeriodRow = {
  name: string;
  /** ปิดใช้งานอยู่ไหม — ไฟล์ส่งออกติดป้ายกำกับ เพราะบัญชีนี้ไม่โผล่ในแอปแล้ว */
  active: boolean;
  /** บัญชีที่ใช้ร่วมกันทุกร้าน — ตัวเลขนับเงินของทุกร้าน ไม่ใช่แค่ร้านที่ส่งออก */
  shared: boolean;
  opening: string;
  income: string;
  expense: string;
  transferNet: string;
  closing: string;
};

/**
 * ยอดของแต่ละบัญชีในช่วงที่เลือก ไว้กระทบยอดกับสมุดธนาคาร
 *
 * closing คือยอด ณ วันสุดท้ายของช่วง ไม่ใช่ยอดวันนี้ — นับทุกอย่างที่เกิด
 * ถึงวันนั้นแล้วหยุด ถ้าใช้ยอดวันนี้ ตัวเลขจะไม่มีทางตรงกับสมุดของเดือนที่ปิดไปแล้ว
 *
 * ยอดตั้งต้นบวกความเคลื่อนไหวในช่วง ไม่จำเป็นต้องเท่ากับ closing เพราะอาจมี
 * รายการก่อนหน้าช่วงนี้อยู่ ซึ่งถูกนับรวมอยู่ใน closing แล้ว
 */export async function accountTotalsForPeriod(
  shopId: string,
  period: Period,
): Promise<AccountPeriodRow[]> {
  const [from, to] = rangeOf(period);

  /**
   * ⚠️ ทุกก้อนที่อ้าง accounts.id ต้องเป็น sql`` ของตัวเอง แล้วค่อยเอาไปเสียบ
   *    ในช่องของ select อีกที ห้ามเขียน ${accounts.id} ลงไปตรงๆ ในก้อนนอกสุด
   *
   *    drizzle ตัดชื่อตารางออกจากคอลัมน์ที่เป็นชิ้นส่วนชั้นบนสุดของช่อง select
   *    เมื่อ query ดึงจากตารางเดียวไม่มี join ${accounts.id} จึงกลายเป็น "id"
   *    เปล่าๆ แล้ว Postgres ไปจับคู่กับ tx.id หรือ tf.id ของ subquery แทน
   *    ได้เงื่อนไขที่ไม่มีทางจริง ผลคือคืน 0 เงียบๆ ไม่มี error สักตัว
   *
   *    เคยหลุดมาแล้วสองครั้ง — shopDelta และชีตยอดบัญชีของไฟล์ส่งออก
   *    ครั้งหลังนี้เกือบส่งไฟล์ที่บอกว่าทั้งเดือนไม่มีเงินเข้าออกเลยให้คนทำบัญชี
   *    เทสใน export.itest.ts เป็นตัวจับถ้าวันหนึ่งมันหลุดอีก
   */
  const txnInRange = (pick: SQL) => sql`coalesce((
    select sum(${pick})
      from transactions tx
     where tx.account_id = ${accounts.id}
       and tx.is_deleted = false
       and tx.txn_date >= ${from} and tx.txn_date <= ${to}
  ), 0)`;

  const txnUntilEnd = sql`coalesce((
    select sum(case when tx.direction = 'in' then tx.amount else -tx.amount end)
      from transactions tx
     where tx.account_id = ${accounts.id}
       and tx.is_deleted = false
       and tx.txn_date <= ${to}
  ), 0)`;

  /** เข้าเป็นบวก ออกเป็นลบ เขียนรวมก้อนเดียวจะได้ไม่มีใครใส่แค่ขาเดียว */
  const transferSum = (window: SQL) => sql`coalesce((
    select sum(case when tf.to_account_id = ${accounts.id} then tf.amount else -tf.amount end)
      from transfers tf
     where (tf.to_account_id = ${accounts.id} or tf.from_account_id = ${accounts.id})
       and tf.is_deleted = false
       and ${window}
  ), 0)`;

  const inRange = sql`tf.txn_date >= ${from} and tf.txn_date <= ${to}`;
  const untilEnd = sql`tf.txn_date <= ${to}`;

  return db
    .select({
      name: accounts.name,
      active: accounts.isActive,
      shared: sql<boolean>`(${sql`${accounts.shopId}`} is null)`,
      opening: accounts.openingBalance,
      income: sql<string>`(${txnInRange(sql`case when tx.direction = 'in' then tx.amount else 0 end`)})`,
      expense: sql<string>`(${txnInRange(sql`case when tx.direction = 'out' then tx.amount else 0 end`)})`,
      transferNet: sql<string>`(${transferSum(inRange)})`,
      closing: sql<string>`(${accounts.openingBalance} + ${txnUntilEnd} + ${transferSum(untilEnd)})`,
    })
    .from(accounts)
    .where(visibleToShop(shopId))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name));
}
