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
 *
 * ปุ่มลบย้ายขึ้นไปอยู่บนหัวแผ่นแล้ว ไม่ได้ต่อท้ายฟอร์มเหมือนเดิม
 * เพราะวัดแล้วเนื้อหาในแผ่นสูง 809px แต่แผ่นแสดงได้ 690px — ปุ่มบันทึก
 * ถูกตัดครึ่งอยู่ขอบล่าง ส่วนปุ่มลบจมอยู่ใต้ขอบไปอีก
 * ได้ผลพลอยได้คือปุ่มลบไม่ไปนั่งใต้ปุ่มบันทึกให้นิ้วเลื่อนไปโดน
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
  /**
   * สถานะ "กำลังจะลบ" อยู่ตรงนี้ ไม่ได้อยู่ในฟอร์ม เพราะปุ่มที่จุดชนวน
   * อยู่บนหัวแผ่นซึ่ง Sheet เป็นคนวาด
   *
   * ⚠️ ต้องล้างเมื่อเปลี่ยนรายการเสมอ ไม่งั้นเลื่อนจากรายการที่กำลังจะลบ
   *    ไปอีกรายการแล้วกดพลาด รายการที่ไม่ได้ตั้งใจจะหายทันที
   *    (เหตุผลเดียวกับ key ที่ผูกกับ txn.id ข้างล่าง)
   */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [seenId, setSeenId] = useState(txn?.id ?? null);

  if (seenId !== (txn?.id ?? null)) {
    setSeenId(txn?.id ?? null);
    setConfirmingDelete(false);
  }

  return (
    <Sheet
      open={txn !== null}
      onClose={onClose}
      title={confirmingDelete ? "ลบรายการนี้" : "แก้ไขรายการ"}
      action={
        txn && !confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="ลบรายการนี้"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-expense hover:bg-expense-soft"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden
            >
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        ) : null
      }
    >
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
          confirmingDelete={confirmingDelete}
          onCancelDelete={() => setConfirmingDelete(false)}
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
  confirmingDelete,
  onCancelDelete,
}: {
  txn: TxnRow;
  shopId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  onDone: () => void;
  /** จุดชนวนอยู่บนหัวแผ่น สถานะจึงมาจากข้างบน */
  confirmingDelete: boolean;
  onCancelDelete: () => void;
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

  // controlled ทุกช่อง ไม่งั้นแก้ไปแล้วบันทึกพลาด สิ่งที่แก้จะหายหมด
  const amount = useKeptValue(txn.amount);
  const title = useKeptValue(txn.title);
  const note = useKeptValue(txn.note ?? "");
  // มีหมายเหตุอยู่แล้วให้กางไว้ ไม่มีก็ยุบ
  const [noteOpen, setNoteOpen] = useState((txn.note ?? "") !== "");
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

  // ลบไม่สำเร็จแล้วถอยกลับไปหน้าฟอร์มปกติ ไม่ค้างอยู่ที่หน้ายืนยัน
  const [seenDelete, setSeenDelete] = useState(deleteState);

  if (seenDelete !== deleteState) {
    setSeenDelete(deleteState);
    if (deleteState.status === "error") onCancelDelete();
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

  /**
   * หน้ายืนยันลบแทนที่ฟอร์มทั้งแผ่น ไม่ได้ต่อท้ายฟอร์ม
   *
   * เพราะการลบเป็นทางแยกที่ต้องหยุดคิด ไม่ใช่ปุ่มอีกปุ่มในลิสต์เดียวกับ
   * ปุ่มบันทึก และการแทนที่ทั้งแผ่นทำให้ไม่มีอะไรให้กดผิดเหลืออยู่เลย
   *
   * ยังบอกด้วยว่ากำลังจะลบรายการไหน เพราะพอฟอร์มหายไปแล้วคนจะมองไม่เห็น
   * ว่าเปิดรายการไหนค้างไว้
   */
  if (confirmingDelete) {
    return (
      <form action={deleteAction} className="space-y-3">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="id" value={txn.id} />

        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <div className="font-semibold text-ink">{txn.title}</div>
          <div className="num mt-0.5 text-sm text-ink-soft">
            {isIncome ? "+" : "−"}
            {txn.amount} · {txn.txnDate}
          </div>
        </div>

        <p className="text-sm text-ink-soft">ลบแล้วเอากลับมาไม่ได้</p>

        <StatusMessage state={deleteState} />

        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancelDelete}>
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
      </form>
    );
  }

  return (
    <>
      <form action={formAction} className="space-y-3">
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

        {/**
         * หมายเหตุยุบไว้ถ้ารายการนี้ไม่มีหมายเหตุ เหมือนฝั่งบันทึกรายการ
         *
         * ช่องเปล่าที่โผล่ทุกครั้งกินความสูงในแผ่นที่ไม่ค่อยมีเหลืออยู่แล้ว
         * ส่วนรายการที่มีหมายเหตุอยู่ต้องเห็นทันที ไม่งั้นเปิดมาแล้วนึกว่า
         * หมายเหตุหายไป
         */}
        {noteOpen ? (
          <Field label="หมายเหตุ" htmlFor="edit-note">
            <Input {...note} id="edit-note" name="note" maxLength={500} />
          </Field>
        ) : (
          <>
            {/* ยังต้องส่งค่าไปด้วยแม้ยุบอยู่ ไม่งั้นหมายเหตุเดิมจะถูกล้างทิ้ง */}
            <input type="hidden" name="note" value={note.value} />
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="flex min-h-touch w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-medium text-ink-soft transition hover:border-brand/40 hover:text-brand"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="size-4"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              เพิ่มหมายเหตุ
            </button>
          </>
        )}

        <StatusMessage state={state} />

        <SubmitButton className="w-full" disabled={deleting}>บันทึกการแก้ไข</SubmitButton>
      </form>

    </>
  );
}
