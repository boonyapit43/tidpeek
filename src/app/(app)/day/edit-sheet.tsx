"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteTransaction, updateTransaction } from "@/actions/transactions";
import { IDLE } from "@/actions/shared";
import {
  Button,
  DirectionToggle,
  Field,
  Input,
  MoneyInput,
  Select,
  StatusMessage,
  SubmitButton,
  fieldError,
} from "@/components/form-parts";
import { Sheet } from "@/components/sheet";
import type { AccountWithBalance, TxnRow } from "@/db/queries";
import type { Category, Direction } from "@/db/schema";

/**
 * แก้ไขหรือลบรายการที่บันทึกไปแล้ว
 *
 * ปุ่มลบอยู่ในแผ่นนี้ ไม่ได้อยู่บนแถวในรายการ เพราะปุ่มลบเล็กๆ ข้างแถว
 * บนมือถือกดโดนโดยไม่ตั้งใจง่ายมากตอนเลื่อนดูรายการ การบังคับให้เปิดรายการ
 * ขึ้นมาก่อนจึงเป็นด่านกันพลาดที่ไม่ต้องมีกล่องยืนยันมากวน
 *
 * แต่การลบก็ยังต้องกดสองครั้ง เพราะรายการที่ลบแล้วเอากลับมาไม่ได้
 */
export function EditSheet({
  txn,
  onClose,
  shopId,
  accounts,
  categories,
}: {
  txn: TxnRow | null;
  onClose: () => void;
  shopId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
}) {
  const [state, formAction] = useActionState(updateTransaction, IDLE);
  const [deleteState, deleteAction] = useActionState(deleteTransaction, IDLE);
  const [direction, setDirection] = useState<Direction>("out");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * ทุกครั้งที่เปิดรายการใหม่ ตั้งค่าฝั่งตามรายการนั้น และยกเลิกการยืนยันลบ
   * ที่ค้างจากรายการก่อนหน้า ไม่งั้นเปิดรายการถัดมาแล้วเจอปุ่ม "ยืนยันลบ" รออยู่
   * ซึ่งอันตรายมาก เพราะกดพลาดครั้งเดียวรายการหายถาวร
   *
   * ปรับตอน render โดยเทียบ id ที่เห็นล่าสุด ไม่ใช่ทำใน effect
   * เพราะ effect ทำงานหลังวาดจอไปแล้ว จะเห็นสถานะเก่าแวบหนึ่งก่อนเปลี่ยน
   */
  const [seenTxnId, setSeenTxnId] = useState<string | null>(null);

  if (txn && txn.id !== seenTxnId) {
    setSeenTxnId(txn.id);
    setDirection(txn.direction);
    setConfirmingDelete(false);
  }

  useEffect(() => {
    if (state.status === "ok" || deleteState.status === "ok") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, deleteState]);

  const visibleCategories = categories.filter((c) => c.direction === direction);
  const isIncome = direction === "in";

  return (
    <Sheet open={txn !== null} onClose={onClose} title="แก้ไขรายการ">
      {txn && (
        <>
          {/* key บังคับให้ React สร้างฟอร์มใหม่เมื่อเปลี่ยนรายการ
              ไม่งั้นค่าใน input จะค้างจากรายการก่อนหน้า */}
          <form key={txn.id} action={formAction} className="space-y-4">
            <input type="hidden" name="shopId" value={shopId} />
            <input type="hidden" name="id" value={txn.id} />
            <input type="hidden" name="direction" value={direction} />

            <DirectionToggle direction={direction} onChange={setDirection} />

            <Field label="จำนวนเงิน" htmlFor="edit-amount" error={fieldError(state, "amount")}>
              <MoneyInput
                id="edit-amount"
                name="amount"
                defaultValue={txn.amount}
                required
                enterKeyHint="next"
              />
            </Field>

            <Field label="รายการ" htmlFor="edit-title" error={fieldError(state, "title")}>
              <Input
                id="edit-title"
                name="title"
                defaultValue={txn.title}
                required
                maxLength={200}
                enterKeyHint="next"
              />
            </Field>

            <Field label="ประเภท" htmlFor="edit-category">
              <Select
                id="edit-category"
                name="categoryId"
                // ประเภทเดิมอาจอยู่คนละฝั่งกับที่เลือกอยู่ ถ้าเพิ่งสลับฝั่ง
                // จึงต้องล้างค่าเพื่อไม่ให้ส่งประเภทที่เซิร์ฟเวอร์จะปฏิเสธ
                key={direction}
                defaultValue={
                  visibleCategories.some((c) => c.id === txn.categoryId)
                    ? (txn.categoryId ?? "")
                    : ""
                }
              >
                <option value="">— ไม่ระบุ —</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.counts ? "" : "  (ไม่นับเป็นกำไร)"}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={isIncome ? "เงินเข้าบัญชี" : "จ่ายจากบัญชี"} htmlFor="edit-account">
              <Select id="edit-account" name="accountId" defaultValue={txn.accountId ?? ""}>
                <option value="">— ไม่ระบุ —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.shopId === null ? "  (ใช้ร่วม)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="วันที่" htmlFor="edit-date" error={fieldError(state, "txnDate")}>
              <Input id="edit-date" name="txnDate" type="date" defaultValue={txn.txnDate} required />
            </Field>

            <Field label="หมายเหตุ (ไม่บังคับ)" htmlFor="edit-note">
              <Input id="edit-note" name="note" defaultValue={txn.note ?? ""} maxLength={500} />
            </Field>

            <StatusMessage state={state} />

            <SubmitButton className="w-full">บันทึกการแก้ไข</SubmitButton>
          </form>

          {/* ฟอร์มลบแยกต่างหาก เพราะปุ่มสองปุ่มในฟอร์มเดียวกัน
              จะส่งข้อมูลชุดเดียวกันไปให้ action คนละตัว */}
          <form action={deleteAction} className="mt-3 border-t border-line pt-3">
            <input type="hidden" name="shopId" value={shopId} />
            <input type="hidden" name="id" value={txn.id} />

            <StatusMessage state={deleteState} />

            {confirmingDelete ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setConfirmingDelete(false)}
                >
                  ยกเลิก
                </Button>
                <SubmitButton variant="danger" className="flex-1" pendingLabel="กำลังลบ">
                  ยืนยันลบถาวร
                </SubmitButton>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                className="w-full"
                onClick={() => setConfirmingDelete(true)}
              >
                ลบรายการนี้
              </Button>
            )}
          </form>
        </>
      )}
    </Sheet>
  );
}
