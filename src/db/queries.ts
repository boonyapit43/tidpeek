import "server-only";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./index";
import { accounts, categories, shops, transactions } from "./schema";
import type { Account, Category, Direction, Shop } from "./schema";
import { monthRange, yearRange } from "@/lib/date";

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
 * @param extra เงื่อนไขเพิ่ม เช่นจำกัดเฉพาะร้านเดียว
 */
const accountMovement = (extra = sql``) => sql<string>`coalesce((
  select sum(case when tx.direction = 'in' then tx.amount else -tx.amount end)
    from transactions tx
   where tx.account_id = ${accounts.id}
     and tx.is_deleted = false
     ${extra}
), 0)`;

const balanceExpr = sql<string>`(${accounts.openingBalance} + ${accountMovement()})`;

const shopDeltaExpr = (shopId: string) =>
  accountMovement(sql`and tx.shop_id = ${shopId}`);

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
      totalCount: sql<number>`(
        select count(*)::int from transactions tx
         where tx.shop_id = ${shops.id} and tx.is_deleted = false
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
  /** ร้านนี้ทำให้เงินในบัญชีเปลี่ยนไปเท่าไหร่ ไม่ใช่ "ร้านนี้เหลือเท่าไหร่" */
  shopDelta: string;
};

const accountSelection = (shopId: string) => ({
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
  shopDelta: shopDeltaExpr(shopId),
});

/** บัญชีกลาง (shop_id ว่าง) ทุกร้านเห็น ส่วนบัญชีที่ผูกร้านเห็นเฉพาะร้านนั้น */
const visibleToShop = (shopId: string) =>
  and(eq(accounts.isDeleted, false), or(isNull(accounts.shopId), eq(accounts.shopId, shopId)));

/**
 * บัญชีที่ร้านนี้มองเห็น พร้อมยอดคงเหลือที่คำนวณสดทุกครั้ง
 *
 * ยอดคงเหลือไม่ได้เก็บเป็นคอลัมน์ เพราะยอดที่เก็บไว้จะเพี้ยนทันทีที่มี
 * การอัปเดตพลาดสักครั้งเดียว แล้วไม่มีทางรู้ว่าเพี้ยนตั้งแต่เมื่อไหร่
 */
export async function listAccountsWithBalance(shopId: string): Promise<AccountWithBalance[]> {
  return db
    .select(accountSelection(shopId))
    .from(accounts)
    .where(and(visibleToShop(shopId), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name));
}

/** เหมือนข้างบน แต่รวมบัญชีที่ปิดใช้งานไว้ด้วย ใช้เฉพาะหน้าตั้งค่า */
export async function listAllAccountsForShop(shopId: string): Promise<AccountWithBalance[]> {
  return db
    .select(accountSelection(shopId))
    .from(accounts)
    .where(visibleToShop(shopId))
    .orderBy(desc(accounts.isActive), asc(accounts.sortOrder), asc(accounts.name));
}

/** ยอดรวมทุกบัญชีที่ร้านนี้ใช้ — รวมใน SQL ไม่ใช่บวกจากรายการข้างบน */
export async function getTotalBalance(shopId: string): Promise<string> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${balanceExpr}), 0)` })
    .from(accounts)
    .where(and(visibleToShop(shopId), eq(accounts.isActive, true)));

  return row?.total ?? "0";
}

/* ------------------------------------------------------------------ */
/*  ประเภท                                                             */
/* ------------------------------------------------------------------ */

const categoryVisibleToShop = (shopId: string) =>
  and(
    eq(categories.isDeleted, false),
    or(isNull(categories.shopId), eq(categories.shopId, shopId)),
  );

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
export async function isAccountVisible(shopId: string, accountId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), visibleToShop(shopId)))
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
): Promise<Category | null> {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), categoryVisibleToShop(shopId)))
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
    .limit(200);
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
      ),
    )
    .groupBy(transactions.title)
    .orderBy(desc(count()), desc(sql`max(${transactions.createdAt})`))
    .limit(40);
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

export type Period = { day: string } | { month: string } | { year: string };

/**
 * ช่วงวันของทุกมุมมอง — วัน เดือน ปี ต่างกันแค่ขอบเขต ไม่ใช่วิธีคิด
 *
 * txn_date เป็นชนิด date ล้วน การเทียบ >= และ <= จึงไม่มี timezone
 * เข้ามาเกี่ยวเลย ผลลัพธ์เหมือนกันไม่ว่าเซิร์ฟเวอร์จะตั้งเวลาไว้เป็นอะไร
 */
function rangeOf(period: Period): [string, string] {
  if ("day" in period) return [period.day, period.day];
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

/** ยอดรายวันของทั้งเดือน เรียงวันใหม่สุดขึ้นก่อน */
export async function listDailyForMonth(shopId: string, month: string): Promise<DailyRow[]> {
  return db
    .select({ txnDate: transactions.txnDate, txnCount: count(), ...summarySelection })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(scopeOf(shopId, { month }))
    .groupBy(transactions.txnDate)
    .orderBy(desc(transactions.txnDate));
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
  const [shopRows, accountRows, categoryRows, txnRows] = await Promise.all([
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
  ]);

  return {
    exportedAt: new Date().toISOString(),
    shops: shopRows,
    accounts: accountRows,
    categories: categoryRows,
    transactions: txnRows,
  };
}

/** รายการทั้งหมดพร้อมชื่อประเภทและบัญชี สำหรับส่งออกเป็น CSV เปิดใน Excel */
export async function exportTransactionsFlat() {
  return db
    .select({
      txnDate: transactions.txnDate,
      shopName: shops.name,
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
    .innerJoin(shops, eq(shops.id, transactions.shopId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(eq(transactions.isDeleted, false))
    .orderBy(asc(transactions.txnDate), asc(transactions.createdAt));
}
