"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transfers } from "@/db/schema";
import { getShop, isAccountVisible } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import {
  createTransferSchema,
  rowRefSchema,
  updateTransferSchema,
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
 * โอนเงินระหว่างบัญชีของร้าน
 *
 * หนึ่งการโอน = หนึ่งแถว ไม่ใช่รายการสองรายการที่หักล้างกัน
 * จึงไม่มีทางที่ขาเข้ากับขาออกจะไม่เท่ากัน ไม่ว่าจะแก้หรือลบยังไง
 *
 * และเพราะไม่ได้อยู่ในตาราง transactions การโอนจึงไม่มีทางไปโผล่ในยอดขาย
 * ยอดรายจ่าย หรือกำไร ได้เลย โดยไม่ต้องพึ่งว่าใครจะตั้งธง counts ถูกไหม
 *
 * ⚠️ ที่ต้องระวังคือฝั่งตรงข้าม — ทุก query ที่คิด "ยอดคงเหลือของบัญชี"
 *    ต้องรวมตารางนี้ด้วยเสมอ ดู balanceExpr ใน src/db/queries.ts
 */

function revalidateAll(): void {
  revalidatePath("/", "layout");
}

/**
 * ทั้งสองบัญชีต้องเป็นบัญชีที่ร้านนี้มองเห็นจริง
 *
 * id ที่มากับฟอร์มแก้ได้จากฝั่ง browser ถ้าไม่ตรวจ คนที่เข้าแอปได้จะย้ายเงิน
 * เข้าออกบัญชีส่วนตัวของอีกร้านได้ แล้วยอดของทั้งสองร้านจะเพี้ยนโดยไม่มีใครรู้
 */
async function checkAccounts(
  shopId: string,
  fromAccountId: string,
  toAccountId: string,
): Promise<ActionState | null> {
  const [fromOk, toOk] = await Promise.all([
    isAccountVisible(shopId, fromAccountId),
    isAccountVisible(shopId, toAccountId),
  ]);

  if (!fromOk) return failed("ไม่พบบัญชีต้นทางที่เลือก");
  if (!toOk) return failed("ไม่พบบัญชีปลายทางที่เลือก");

  return null;
}

export async function createTransfer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = createTransferSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;
    if (!(await getShop(input.shopId))) return SHOP_NOT_FOUND;

    const accountError = await checkAccounts(
      input.shopId,
      input.fromAccountId,
      input.toAccountId,
    );
    if (accountError) return accountError;

    await db.insert(transfers).values({
      shopId: input.shopId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      txnDate: input.txnDate,
      amount: input.amount,
      note: input.note,
    });

    revalidateAll();
    return succeeded("โอนแล้ว");
  });
}

export async function updateTransfer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = updateTransferSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input = parsed.data;

    const accountError = await checkAccounts(
      input.shopId,
      input.fromAccountId,
      input.toAccountId,
    );
    if (accountError) return accountError;

    const updated = await db
      .update(transfers)
      .set({
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        txnDate: input.txnDate,
        amount: input.amount,
        note: input.note,
        updatedAt: new Date(),
      })
      // เงื่อนไข shopId ตรงนี้คือสิ่งที่กันไม่ให้แก้การโอนของร้านอื่น
      // ด้วยการเปลี่ยน id ในฟอร์ม ห้ามตัดออกเด็ดขาด
      .where(
        and(
          eq(transfers.id, input.id),
          eq(transfers.shopId, input.shopId),
          eq(transfers.isDeleted, false),
        ),
      )
      .returning({ id: transfers.id });

    if (updated.length === 0) return failed("ไม่พบรายการโอนที่จะแก้ไข อาจถูกลบไปแล้ว");

    revalidateAll();
    // แก้จำนวนแล้วยอดทั้งสองบัญชีขยับพร้อมกันเสมอ เพราะมีตัวเลขอยู่ตัวเดียว
    return succeeded("แก้ไขแล้ว");
  });
}

export async function deleteTransfer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    if (!(await hasSession())) return UNAUTHORIZED;

    const parsed = rowRefSchema.safeParse(formObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const deleted = await db
      .update(transfers)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(transfers.id, parsed.data.id),
          eq(transfers.shopId, parsed.data.shopId),
          eq(transfers.isDeleted, false),
        ),
      )
      .returning({ id: transfers.id });

    if (deleted.length === 0) return failed("ไม่พบรายการโอนที่จะลบ");

    revalidateAll();
    // ลบแถวเดียว เงินคืนที่เดิมทั้งสองฝั่งพร้อมกัน ไม่มีทางเหลือขาค้าง
    return succeeded("ลบรายการโอนแล้ว");
  });
}
