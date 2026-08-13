"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { defaultAccountRows, defaultCategoryRows } from "@/db/defaults";
import { accounts, categories, shops, transactions } from "@/db/schema";
import {
  getShop,
  nextAccountSortOrder,
  nextCategorySortOrder,
  nextShopSortOrder,
} from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { forgetShop, getSelectedShop, isValidShop, rememberShop } from "@/lib/shop";
import {
  createAccountSchema,
  createCategorySchema,
  createShopSchema,
  deleteShopSchema,
  rowRefSchema,
  shopRefSchema,
  toggleActiveSchema,
  updateAccountSchema,
  updateCategorySchema,
  updateShopSchema,
} from "@/lib/validation";
import {
  type ActionState,
  SHOP_NOT_FOUND,
  UNAUTHORIZED,
  failed,
  formObject,
  invalid,
  runAction,
  succeeded,
} from "./shared";

/**
 * จัดการร้าน บัญชี และประเภท
 *
 * มีสองระดับของการ "เอาออก" ซึ่งต่างกันชัดเจน
 *
 *   ปิดใช้งาน (is_active = false)
 *     ไม่โผล่ในฟอร์มบันทึกใหม่ แต่ยังเห็นในหน้าตั้งค่าและเปิดกลับได้ทันที
 *     ใช้กับบัญชีที่ปิดไปแล้วหรือประเภทที่เลิกใช้ แต่ยังอยากเห็นในรายการ
 *
 *   ลบ (is_deleted = true)
 *     หายไปจากทุกที่ ทุก query กรองออกหมด แต่แถวยังอยู่ในฐานข้อมูล
 *     กู้กลับได้ด้วย SQL บรรทัดเดียว ไม่ได้ DELETE ออกจริง
 *
 * ที่ไม่ลบแถวออกจริงเพราะรายการเก่าอ้างถึงบัญชีและประเภทเหล่านี้อยู่
 * ถ้าลบจริงรายการเหล่านั้นจะกลายเป็นไม่มีประเภทและไม่มีบัญชี
 * ประวัติที่บันทึกไว้จะอ่านไม่รู้เรื่องและตามรอยเงินไม่ได้อีกเลย
 */

function revalidateAll(): void {
  revalidatePath("/", "layout");
}

/** บัญชีที่ร้านนี้แตะได้ — ของกลางหรือของร้านตัวเอง และต้องยังไม่ถูกลบ */
const accountScope = (shopId: string, id: string) =>
  and(
    eq(accounts.id, id),
    eq(accounts.isDeleted, false),
    or(isNull(accounts.shopId), eq(accounts.shopId, shopId)),
  );

const categoryScope = (shopId: string, id: string) =>
  and(
    eq(categories.id, id),
    eq(categories.isDeleted, false),
    or(isNull(categories.shopId), eq(categories.shopId, shopId)),
  );

/* ------------------------------------------------------------------ */
/*  ร้าน                                                               */
/* ------------------------------------------------------------------ */

/**
 * สลับร้านที่กำลังดูอยู่
 *
 * ตรวจว่า id ที่ส่งมาเป็นร้านที่มีอยู่จริงก่อนจำลงใน cookie เสมอ
 * ถ้าจำค่ามั่วไว้ ทุกหน้าจะพยายามโหลดร้านที่ไม่มีแล้วพังทั้งแอป
 */
export async function switchShop(formData: FormData): Promise<void> {
  if (!(await hasSession())) return;

  const shopId = formData.get("shopId");
  if (typeof shopId !== "string" || !(await isValidShop(shopId))) return;

  await rememberShop(shopId);
  revalidateAll();

  // redirect โยน error ออกมาเพื่อสั่งให้ Next.js เปลี่ยนหน้า
  // จึงต้องอยู่นอก try/catch เสมอ ไม่งั้นจะถูกกลืนแล้วหน้าไม่เปลี่ยน
  redirect("/");
}

/**
 * เพิ่มร้าน พร้อมของที่ต้องมีถึงจะเริ่มลงรายการได้จริง
 *
 * ร้านเปล่าๆ ใช้งานไม่ได้ ทั้งช่องประเภทและช่องบัญชีจะเหลือแค่ "— ไม่ระบุ —"
 * แล้วคนใช้ต้องไปสร้างเองทีละตัวก่อนถึงจะบันทึกรายการแรกได้ ซึ่งเป็นกำแพง
 * ที่ไม่มีเหตุผลจะมี ในเมื่อรู้อยู่แล้วว่าทุกร้านต้องใช้อะไรบ้าง
 *
 * ทำไมบัญชีผูกกับร้าน แต่ประเภทเป็นของกลาง
 *   บัญชี   เงินสดของสองร้านคือคนละลิ้นชัก ถ้าใส่เป็นของกลางแล้วเปิดร้านที่สอง
 *           ยอดเงินสดจะปนกันทันทีและแยกกลับไม่ได้ ถ้าจริงๆ มีบัญชีธนาคารใบเดียว
 *           ที่ใช้สองร้าน ค่อยติ๊ก "ใช้ร่วมกันทุกร้าน" ตอนเพิ่มบัญชีนั้น
 *   ประเภท  "ขายหน้าร้าน" ของสองร้านคือความหมายเดียวกัน ถ้าแยกเป็นของใครของมัน
 *           จะได้ประเภทซ้ำสองชุดโดยไม่ได้อะไรเพิ่ม จึงใส่ครั้งเดียวแล้วใช้ร่วมกัน
 *           ร้านที่สองขึ้นไปเลยไม่ต้องใส่ซ้ำ
 *
 * ทั้งหมดอยู่ใน transaction เดียว ถ้าใส่ประเภทไม่สำเร็จ ร้านต้องไม่ถูกสร้าง
 * ค้างไว้แบบใช้งานไม่ได้ ให้ล้มทั้งก้อนแล้วกดใหม่ดีกว่า
 */
export async function createShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = createShopSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const sortOrder = await nextShopSortOrder();

    await db.transaction(async (tx) => {
      const [shop] = await tx
        .insert(shops)
        .values({ name: parsed.data.name, sortOrder })
        .returning({ id: shops.id });

      await tx.insert(accounts).values(defaultAccountRows(shop.id));

      const [sharedCategory] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(isNull(categories.shopId), eq(categories.isDeleted, false)))
        .limit(1);

      if (!sharedCategory) await tx.insert(categories).values(defaultCategoryRows(null));
    });

    revalidateAll();
    return succeeded("เพิ่มร้านแล้ว พร้อมบัญชีเงินสดและประเภทตั้งต้น");
  });
}

export async function updateShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = updateShopSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const updated = await db
      .update(shops)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(and(eq(shops.id, parsed.data.id), eq(shops.isDeleted, false)))
      .returning({ id: shops.id });

    if (updated.length === 0) return SHOP_NOT_FOUND;

    revalidateAll();
    return succeeded("เปลี่ยนชื่อร้านแล้ว");
  });
}

/**
 * ลบร้าน พร้อมทุกอย่างที่เป็นของร้านนั้น
 *
 * ทำใน transaction เดียว เพราะถ้าลบร้านสำเร็จแต่ลบรายการไม่สำเร็จ
 * จะเหลือรายการที่ชี้ไปยังร้านที่ไม่มีแล้ว ยอดของรายการพวกนั้นจะยังค้าง
 * อยู่ในบัญชีกลางโดยไม่มีหน้าไหนแสดงให้เห็นว่ามาจากไหน
 *
 * สิ่งที่ถูกลบตามไปด้วย
 *   • รายการทั้งหมดของร้าน — ต้องลบ ไม่งั้นยอดของบัญชีกลางที่ร้านอื่นใช้อยู่
 *     จะยังนับเงินของร้านที่ลบไปแล้ว แล้วยอดจะไม่ตรงกับแอปธนาคาร
 *   • บัญชีและประเภทที่เป็นของร้านนี้เท่านั้น
 *
 * สิ่งที่ไม่ถูกแตะ
 *   • บัญชีและประเภทกลาง (shop_id ว่าง) เพราะร้านอื่นยังใช้อยู่
 *
 * ทั้งหมดเป็นการตั้งธง is_deleted ไม่ได้ลบแถวออกจริง ข้อมูลยังอยู่ในฐานครบ
 */
export async function deleteShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = deleteShopSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const { id } = parsed.data;
    const now = new Date();

    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .update(shops)
        .set({ isDeleted: true, isActive: false, updatedAt: now })
        .where(and(eq(shops.id, id), eq(shops.isDeleted, false)))
        .returning({ id: shops.id });

      // ร้านถูกลบไปแล้ว ไม่ต้องทำอะไรต่อ
      if (rows.length === 0) return false;

      await tx
        .update(transactions)
        .set({ isDeleted: true, updatedAt: now })
        .where(and(eq(transactions.shopId, id), eq(transactions.isDeleted, false)));

      await tx
        .update(accounts)
        .set({ isDeleted: true, isActive: false, updatedAt: now })
        .where(and(eq(accounts.shopId, id), eq(accounts.isDeleted, false)));

      await tx
        .update(categories)
        .set({ isDeleted: true, isActive: false, updatedAt: now })
        .where(and(eq(categories.shopId, id), eq(categories.isDeleted, false)));

      return true;
    });

    if (!deleted) return SHOP_NOT_FOUND;

    // ถ้าเพิ่งลบร้านที่กำลังดูอยู่ ต้องลืมมันด้วย
    // ไม่งั้นทุกหน้าจะพยายามโหลดร้านที่ไม่มีแล้ว
    const current = await getSelectedShop();
    if (!current) await forgetShop();

    revalidateAll();
    return succeeded("ลบร้านแล้ว");
  });
}

/* ------------------------------------------------------------------ */
/*  บัญชี                                                              */
/* ------------------------------------------------------------------ */

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = createAccountSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;
    if (!(await getShop(input.shopId))) return SHOP_NOT_FOUND;

    await db.insert(accounts).values({
      // shopId ว่าง = บัญชีกลางที่ทุกร้านใช้ร่วมกัน
      shopId: input.shared ? null : input.shopId,
      name: input.name,
      kind: input.kind,
      bank: input.bank,
      accountNo: input.accountNo,
      openingBalance: input.openingBalance,
      sortOrder: await nextAccountSortOrder(input.shopId),
    });

    revalidateAll();
    return succeeded("เพิ่มบัญชีแล้ว");
  });
}

export async function updateAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = updateAccountSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const updated = await db
      .update(accounts)
      .set({
        name: input.name,
        kind: input.kind,
        bank: input.bank,
        accountNo: input.accountNo,
        openingBalance: input.openingBalance,
        shopId: input.shared ? null : input.shopId,
        updatedAt: new Date(),
      })
      .where(accountScope(input.shopId, input.id))
      .returning({ id: accounts.id });

    if (updated.length === 0) return failed("ไม่พบบัญชีที่จะแก้ไข");

    revalidateAll();
    return succeeded("แก้ไขบัญชีแล้ว");
  });
}

export async function setAccountActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = toggleActiveSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const updated = await db
      .update(accounts)
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where(accountScope(input.shopId, input.id))
      .returning({ id: accounts.id });

    if (updated.length === 0) return failed("ไม่พบบัญชี");

    revalidateAll();
    return succeeded(input.isActive ? "เปิดใช้บัญชีแล้ว" : "ปิดบัญชีแล้ว");
  });
}

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = rowRefSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const deleted = await db
      .update(accounts)
      .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
      .where(accountScope(input.shopId, input.id))
      .returning({ id: accounts.id });

    if (deleted.length === 0) return failed("ไม่พบบัญชี");

    revalidateAll();
    // รายการเก่ายังชี้มาที่บัญชีนี้อยู่ แค่ไม่แสดงชื่อแล้วเพราะ query กรองออก
    // ยอดของบัญชีนี้จึงหายไปจากยอดรวม แต่ตัวรายการยังอยู่ครบในหน้ารายวัน
    return succeeded("ลบบัญชีแล้ว");
  });
}

/* ------------------------------------------------------------------ */
/*  ประเภท                                                             */
/* ------------------------------------------------------------------ */

export async function createCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = createCategorySchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;
    if (!(await getShop(input.shopId))) return SHOP_NOT_FOUND;

    const [created] = await db
      .insert(categories)
      .values({
        shopId: input.shopId,
        direction: input.direction,
        name: input.name,
        counts: input.counts,
        sortOrder: await nextCategorySortOrder(input.shopId, input.direction),
      })
      .returning({ id: categories.id });

    revalidateAll();
    // คืน id กลับไปด้วย ฟอร์มบันทึกรายการจะได้เลือกประเภทที่เพิ่งสร้างให้เลย
    // ไม่ต้องให้คนไปหาเองในดรอปดาวน์ที่เพิ่งยาวขึ้นอีกหนึ่งบรรทัด
    return succeeded("เพิ่มประเภทแล้ว", created.id);
  });
}

/**
 * เติมชุดประเภทตั้งต้นให้ร้านที่ยังไม่เคยได้
 *
 * มีไว้สำหรับร้านที่ถูกสร้างก่อนที่ createShop จะใส่ชุดตั้งต้นให้ ซึ่งเจอ
 * ของจริงมาแล้ว คือร้านที่มีประเภทอยู่แค่สามสี่ตัวที่พิมพ์เองตอนรีบลงรายการ
 *
 * ข้ามชื่อที่มีอยู่แล้ว เทียบทั้งฝั่งและชื่อ กด(ซ้ำ)แล้วจะไม่ได้ของซ้ำ
 * และวางต่อท้ายของเดิมเสมอ ประเภทที่คนใช้สร้างเองยังอยู่บนสุดของดรอปดาวน์
 * เพราะเป็นตัวที่เลือกบ่อยกว่า
 */
export async function addDefaultCategories(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = shopRefSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const { shopId } = parsed.data;
    if (!(await getShop(shopId))) return SHOP_NOT_FOUND;

    const existing = await db
      .select({ direction: categories.direction, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.isDeleted, false),
          or(isNull(categories.shopId), eq(categories.shopId, shopId)),
        ),
      );

    // " " กันชื่อที่มีขีดกลางไปชนกับตัวคั่นเอง เป็นอักขระที่ไม่มีในชื่อจริง
    const key = (c: { direction: string; name: string }) => `${c.direction} ${c.name}`;
    const taken = new Set(existing.map(key));

    const [inBase, outBase] = await Promise.all([
      nextCategorySortOrder(shopId, "in"),
      nextCategorySortOrder(shopId, "out"),
    ]);

    const rows = defaultCategoryRows(null)
      .filter((c) => !taken.has(key(c)))
      // sortOrder ที่ติดมาคือลำดับภายในชุดตั้งต้น เลื่อนทั้งชุดไปต่อท้ายของเดิม
      .map((c) => ({
        ...c,
        sortOrder: (c.direction === "in" ? inBase : outBase) + c.sortOrder - 1,
      }));

    if (rows.length === 0) return succeeded("มีประเภทตั้งต้นครบอยู่แล้ว");

    await db.insert(categories).values(rows);

    revalidateAll();
    return succeeded(`เพิ่มประเภทตั้งต้น ${rows.length} รายการแล้ว`);
  });
}

export async function updateCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = updateCategorySchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const updated = await db
      .update(categories)
      .set({ name: input.name, counts: input.counts, updatedAt: new Date() })
      .where(categoryScope(input.shopId, input.id))
      .returning({ id: categories.id });

    if (updated.length === 0) return failed("ไม่พบประเภทที่จะแก้ไข");

    revalidateAll();
    // เปลี่ยนธง counts แล้วยอดสรุปย้อนหลังเปลี่ยนตามทันที เพราะกำไรคำนวณสด
    return succeeded("แก้ไขแล้ว");
  });
}

export async function setCategoryActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = toggleActiveSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const updated = await db
      .update(categories)
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where(categoryScope(input.shopId, input.id))
      .returning({ id: categories.id });

    if (updated.length === 0) return failed("ไม่พบประเภท");

    revalidateAll();
    return succeeded(input.isActive ? "เปิดใช้ประเภทแล้ว" : "ปิดประเภทแล้ว");
  });
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = rowRefSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const deleted = await db
      .update(categories)
      .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
      .where(categoryScope(input.shopId, input.id))
      .returning({ id: categories.id });

    if (deleted.length === 0) return failed("ไม่พบประเภท");

    revalidateAll();

    /**
     * รายการเก่ายังนับเหมือนเดิมทุกประการ
     *
     * เพราะ query ที่คิดยอดใช้ left join กับ categories โดย "ไม่กรอง is_deleted"
     * ธง counts ของประเภทที่ถูกลบจึงยังถูกอ่านได้ตามปกติ
     * ยอดสรุปย้อนหลังจะไม่ขยับเลยหลังลบประเภท ซึ่งเป็นสิ่งที่ต้องการ
     * ไม่งั้นการลบประเภท "โอนย้ายบัญชี" จะทำให้เงินโอนกลายเป็นกำไรย้อนหลัง
     */
    return succeeded("ลบประเภทแล้ว");
  });
}
