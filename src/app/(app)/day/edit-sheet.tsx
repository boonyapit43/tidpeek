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
  useKeptValue,
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
  /**
   * ดึง isPending ของทั้งสอง action มาไขว้ล็อกกัน
   *
   * สองฟอร์มนี้แยกกัน useFormStatus จึงเห็นเฉพาะฟอร์มของตัวเอง — ระหว่าง
   * ที่การแก้ไขกำลังวิ่งอยู่ ปุ่มลบยังกดได้ ถ้ากดทัน สองคำสั่งจะวิ่งแข่งกัน
   * แล้วผลสุดท้ายขึ้นกับว่าใครถึงฐานข้อมูลก่อน ซึ่งเดาไม่ได้
   */
  const [state, formAction, updating] = useActionState(updateTransaction, IDLE);
  const [deleteState, deleteAction, deleting] = useActionState(deleteTransaction, IDLE);
  const [direction, setDirection] = useState<Direction>(txn.direction);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // controlled ทุกช่อง ไม่งั้นแก้ไปแล้วบันทึกพลาด สิ่งที่แก้จะหายหมด
  const amount = useKeptValue(txn.amount);
  const title = useKeptValue(txn.title);
  const note = useKeptValue(txn.note ?? "");
  const date = useKeptValue(txn.txnDate);
  // บัญชีเดิมอาจถูกลบหรือปิดไปแล้ว ถ้าตั้งค่าที่ไม่มีในตัวเลือก
  // เบราว์เซอร์จะเด้งไปตัวแรกเงียบๆ แล้วแก้รายการทีไรบัญชีก็เปลี่ยนตาม
  const account = useKeptValue(
    accounts.some((a) => a.id === txn.accountId) ? (txn.accountId ?? "") : "",
  );

  /**
   * ประเภทมีสามสถานะเหมือนในฟอร์มบันทึก null คือยังไม่ได้เลือกเอง
   *
   * ต่างจากช่องอื่นตรงที่ตัวเลือกเปลี่ยนตามฝั่งที่เลือกอยู่ ประเภทเดิม
   * ของรายการอาจอยู่คนละฝั่งกับที่กำลังดู ต้องล้างเป็นไม่ระบุ ไม่งั้น
   * ส่งประเภทที่เซิร์ฟเวอร์จะปฏิเสธไป
   */
  const [categoryId, setCategoryId] = useState<string | null>(null);

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

  const originalStillFits = visibleCategories.some((c) => c.id === txn.categoryId);
  const chosenStillFits =
    categoryId === "" || visibleCategories.some((c) => c.id === categoryId);

  const effectiveCategoryId =
    categoryId !== null && chosenStillFits
      ? categoryId
      : originalStillFits
        ? (txn.categoryId ?? "")
        : "";

  return (
    <>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="id" value={txn.id} />
        <input type="hidden" name="direction" value={direction} />

        <DirectionToggle direction={direction} onChange={setDirection} />

        <Field label="จำนวนเงิน" htmlFor="edit-amount" error={fieldError(state, "amount")}>
          <MoneyInput
            {...amount}
            id="edit-amount"
            name="amount"
            required
            enterKeyHint="next"
          />
        </Field>

        <Field label="รายการ" htmlFor="edit-title" error={fieldError(state, "title")}>
          <Input
            {...title}
            id="edit-title"
            name="title"
            required
            maxLength={200}
            enterKeyHint="next"
          />
        </Field>

        <Field label="ประเภท" htmlFor="edit-category">
          <Select
            id="edit-category"
            name="categoryId"
            value={effectiveCategoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <CategoryOptions categories={visibleCategories} />
          </Select>
        </Field>

        <Field label={isIncome ? "เงินเข้าบัญชี" : "จ่ายจากบัญชี"} htmlFor="edit-account">
          <Select {...account} id="edit-account" name="accountId">
            <AccountOptions accounts={accounts} />
          </Select>
        </Field>

        <Field label="วันที่" htmlFor="edit-date" error={fieldError(state, "txnDate")}>
          <Input {...date} id="edit-date" name="txnDate" type="date" required />
        </Field>

        <Field label="หมายเหตุ (ไม่บังคับ)" htmlFor="edit-note">
          <Input {...note} id="edit-note" name="note" maxLength={500} />
        </Field>

        <StatusMessage state={state} />

        <SubmitButton className="w-full" disabled={deleting}>บันทึกการแก้ไข</SubmitButton>
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
            <SubmitButton
              variant="danger"
              className="flex-1"
              pendingLabel="กำลังลบ"
              disabled={updating}
            >
              ยืนยันลบถาวร
            </SubmitButton>
          </div>
        ) : (
          <Button
            type="button"
            variant="danger"
            className="w-full"
            disabled={updating}
            onClick={() => setConfirmingDelete(true)}
          >
            ลบรายการนี้
          </Button>
        )}
      </form>
    </>
  );
}
