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
import { AccountOptions, CategoryOptions } from "@/components/pickers";
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
  return (
    <Sheet open={txn !== null} onClose={onClose} title="แก้ไขรายการ">
      {/**
       * key ผูกกับรายการ ทุกอย่างข้างในจึงเริ่มใหม่เมื่อเปลี่ยนรายการ —
       * ค่าในช่อง ฝั่งที่เลือก ข้อความผลลัพธ์ และที่สำคัญที่สุดคือปุ่ม
       * "ยืนยันลบ" ที่ค้างอยู่ ถ้าเลื่อนมาจากรายการก่อนหน้าแล้วกดพลาด
       * รายการที่ไม่ได้ตั้งใจจะหายไปทันที
       */}
      {txn && (
        <EditTxnForm
          key={txn.id}
          txn={txn}
          shopId={shopId}
          accounts={accounts}
          categories={categories}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function EditTxnForm({
  txn,
  shopId,
  accounts,
  categories,
  onDone,
}: {
  txn: TxnRow;
  shopId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(updateTransaction, IDLE);
  const [deleteState, deleteAction] = useActionState(deleteTransaction, IDLE);
  const [direction, setDirection] = useState<Direction>(txn.direction);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // ลบไม่สำเร็จแล้วถอยกลับไปปุ่มปกติ ไม่ค้างอยู่ที่ "ยืนยันลบถาวร"
  const [seenDelete, setSeenDelete] = useState(deleteState);

  if (seenDelete !== deleteState) {
    setSeenDelete(deleteState);
    if (deleteState.status === "error") setConfirmingDelete(false);
  }

  useEffect(() => {
    if (state.status === "ok" || deleteState.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, deleteState]);

  const visibleCategories = categories.filter((c) => c.direction === direction);
  const isIncome = direction === "in";

  return (
    <>
      <form action={formAction} className="space-y-4">
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
            <CategoryOptions categories={visibleCategories} />
          </Select>
        </Field>

        <Field label={isIncome ? "เงินเข้าบัญชี" : "จ่ายจากบัญชี"} htmlFor="edit-account">
          <Select id="edit-account" name="accountId" defaultValue={txn.accountId ?? ""}>
            <AccountOptions accounts={accounts} />
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
  );
}
