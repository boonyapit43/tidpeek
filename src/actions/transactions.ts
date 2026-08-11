"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { getShop, getVisibleCategory, isAccountVisible } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import {
  createTransactionSchema,
  deleteTransactionSchema,
  updateTransactionSchema,
} from "@/lib/validation";
import {
  type ActionState,
  SHOP_NOT_FOUND,
  UNAUTHORIZED,
  failed,
  formObject,
  invalid,
  succeeded,
} from "./shared";

/**
 * server action ทุกตัวในไฟล์นี้เป็น HTTP endpoint ที่ยิงตรงจากอินเทอร์เน็ตได้
 * จึงต้องตรวจสามชั้นทุกครั้ง ไม่มีข้อยกเว้น
 *
 *   1. ล็อกอินอยู่จริงไหม
 *   2. ข้อมูลที่ส่งมาผ่าน Zod ไหม
 *   3. บัญชีกับประเภทที่อ้างถึงเป็นของร้านนี้จริงไหม
 *
 * ชั้นที่ 3 สำคัญที่สุดและมองข้ามง่ายที่สุด เพราะ id ใน dropdown เป็นค่าที่
 * แก้ได้จาก devtools ถ้าไม่ตรวจ คนที่เข้าแอปได้จะผูกรายการข้ามร้านได้
 */

/** ตรวจว่า categoryId กับ accountId ที่ส่งมาใช้กับร้านนี้ได้จริง */
async function checkReferences(
  shopId: string,
  direction: "in" | "out",
  categoryId: string | null,
  accountId: string | null,
): Promise<ActionState | null> {
  if (categoryId) {
    const category = await getVisibleCategory(shopId, categoryId);
    if (!category) return failed("ไม่พบประเภทที่เลือก");

    if (category.direction !== direction) {
      // เกิดได้เมื่อสลับฝั่งรับ/จ่ายหลังเลือกประเภทไปแล้ว แล้วฟอร์มส่งค่าเก่าตามมา
      return failed("ประเภทที่เลือกอยู่คนละฝั่งกับรายการ ลองเลือกประเภทใหม่");
    }
  }

  if (accountId && !(await isAccountVisible(shopId, accountId))) {
    return failed("ไม่พบบัญชีที่เลือก");
  }

  return null;
}

/** ล้าง cache ทุกหน้า เพราะยอดบัญชีโผล่อยู่บน layout ที่ใช้ร่วมกันทุกหน้า */
function revalidateAll(): void {
  revalidatePath("/", "layout");
}

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasSession())) return UNAUTHORIZED;

  const parsed = createTransactionSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const input = parsed.data;

  if (!(await getShop(input.shopId))) return SHOP_NOT_FOUND;

  const refError = await checkReferences(
    input.shopId,
    input.direction,
    input.categoryId,
    input.accountId,
  );
  if (refError) return refError;

  await db.insert(transactions).values({
    shopId: input.shopId,
    txnDate: input.txnDate,
    direction: input.direction,
    categoryId: input.categoryId,
    accountId: input.accountId,
    title: input.title,
    amount: input.amount,
    note: input.note,
  });

  revalidateAll();
  return succeeded("บันทึกแล้ว");
}

export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasSession())) return UNAUTHORIZED;

  const parsed = updateTransactionSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const input = parsed.data;

  if (!(await getShop(input.shopId))) return SHOP_NOT_FOUND;

  const refError = await checkReferences(
    input.shopId,
    input.direction,
    input.categoryId,
    input.accountId,
  );
  if (refError) return refError;

  const updated = await db
    .update(transactions)
    .set({
      txnDate: input.txnDate,
      direction: input.direction,
      categoryId: input.categoryId,
      accountId: input.accountId,
      title: input.title,
      amount: input.amount,
      note: input.note,
      updatedAt: new Date(),
    })
    // เงื่อนไข shopId ตรงนี้คือสิ่งที่กันไม่ให้แก้รายการของร้านอื่นด้วยการ
    // เปลี่ยน id ในฟอร์ม ห้ามตัดออกเด็ดขาด
    .where(
      and(
        eq(transactions.id, input.id),
        eq(transactions.shopId, input.shopId),
        eq(transactions.isDeleted, false),
      ),
    )
    .returning({ id: transactions.id });

  if (updated.length === 0) return failed("ไม่พบรายการที่จะแก้ไข อาจถูกลบไปแล้ว");

  revalidateAll();
  return succeeded("แก้ไขแล้ว");
}

export async function deleteTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasSession())) return UNAUTHORIZED;

  const parsed = deleteTransactionSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  /**
   * ลบแบบไม่ลบจริง — ตั้งธง is_deleted แทนการ DELETE แถวออก
   *
   * ในระบบบัญชี การลบแถวจริงคือการทำลายหลักฐาน ถ้าลบผิดจะไม่มีทางรู้เลยว่า
   * เคยมีรายการอะไรอยู่ ตั้งธงไว้แทนแล้วทุก query กรองออกให้ ผลที่คนใช้เห็น
   * เหมือนลบทุกอย่าง แต่กู้กลับได้ด้วย SQL บรรทัดเดียว
   *
   * เงื่อนไข is_deleted = false ใน where กันการกดลบซ้ำรายการเดิม
   * ซึ่งจะได้ข้อความ "ลบแล้ว" ทั้งที่ไม่มีอะไรเปลี่ยน
   */
  const deleted = await db
    .update(transactions)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        eq(transactions.id, parsed.data.id),
        eq(transactions.shopId, parsed.data.shopId),
        eq(transactions.isDeleted, false),
      ),
    )
    .returning({ id: transactions.id });

  if (deleted.length === 0) return failed("ไม่พบรายการที่จะลบ");

  revalidateAll();
  return succeeded("ลบแล้ว");
}
