"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createTransfer, deleteTransfer, updateTransfer } from "@/actions/transfers";
import { IDLE } from "@/actions/shared";
import { DatePicker } from "@/components/date-picker";
import {
  Button,
  Field,
  Input,
  MoneyInput,
  Select,
  StatusMessage,
  SubmitButton,
  fieldError,
  useKeptValue,
} from "@/components/form-parts";
import { Sheet } from "@/components/sheet";
import type { AccountWithBalance } from "@/db/queries";
import { bahtShort } from "@/lib/money";
import { today } from "@/lib/date";

/**
 * ข้อมูลเท่าที่ฟอร์มแก้ไขต้องใช้ ไม่ใช่แถวเต็มจากฐานข้อมูล
 *
 * ตั้งใจให้แคบแบบนี้ เพราะฝั่งที่เรียกจะได้ไม่ต้องประกอบแถวปลอมที่มีคอลัมน์
 * ครบทุกช่องขึ้นมาเพื่อให้ type ผ่าน แล้วเผลอใส่ค่ามั่วในช่องที่ไม่ได้ใช้
 */
export type EditableTransfer = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  txnDate: string;
  amount: string;
  note: string | null;
};

/**
 * ฟอร์มโอนเงินระหว่างบัญชี ใช้ทั้งตอนสร้างใหม่และตอนแก้ของเดิม
 *
 * ตั้งใจไม่มีช่องประเภทและช่องชื่อรายการ เพราะการโอนไม่ใช่รายรับและไม่ใช่
 * รายจ่าย จึงไม่มีอะไรให้จัดหมวด ส่วนบัญชีเป็นช่องบังคับทั้งคู่ ต่างจาก
 * ฟอร์มบันทึกรายการที่เว้นว่างได้ — การโอนที่ไม่รู้ว่าเงินมาจากไหนไปไหน
 * ไม่มีความหมายเลย
 *
 * แก้ของเดิมได้โดยไม่ต้องกลัวยอดเพี้ยน เพราะเบื้องหลังเป็นแถวเดียว
 * มีจำนวนเงินตัวเดียว สองฝั่งจึงขยับพร้อมกันเสมอ
 */
export function TransferSheet({
  open,
  onClose,
  shopId,
  accounts,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  accounts: AccountWithBalance[];
  /** ถ้ามี = โหมดแก้ไข ถ้าไม่มี = โหมดสร้างใหม่ */
  editing?: EditableTransfer | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "แก้ไขการโอน" : "โอนเงินระหว่างบัญชี"}>
      {/* สร้างใหม่ทุกครั้งที่เปิด ค่าที่กรอกค้างไว้และข้อความของครั้งก่อนจึงไม่ตามมา */}
      {open && (
        <TransferForm
          key={editing?.id ?? "new"}
          shopId={shopId}
          accounts={accounts}
          editing={editing ?? null}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function TransferForm({
  shopId,
  accounts,
  editing,
  onDone,
}: {
  shopId: string;
  accounts: AccountWithBalance[];
  editing: EditableTransfer | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(editing ? updateTransfer : createTransfer, IDLE);
  const [deleteState, deleteAction] = useActionState(deleteTransfer, IDLE);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const noteId = useId();

  const amount = useKeptValue(editing?.amount ?? "");
  const note = useKeptValue(editing?.note ?? "");
  const [date, setDate] = useState(editing?.txnDate ?? today);

  /**
   * บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน
   *
   * เลือกให้ล่วงหน้าเป็นสองบัญชีแรกที่ไม่ใช่ตัวเดียวกัน คนใช้จึงกดโอนได้เลย
   * โดยไม่ต้องเลือกครบสองช่องก่อน
   */
  const [from, setFrom] = useState(editing?.fromAccountId ?? accounts[0]?.id ?? "");
  const [to, setTo] = useState(
    editing?.toAccountId ?? accounts.find((a) => a.id !== accounts[0]?.id)?.id ?? "",
  );

  /**
   * เลือกต้นทางทับปลายทาง ให้ปลายทางเลื่อนไปบัญชีอื่นเอง
   *
   * แทนที่จะปล่อยให้กดบันทึกแล้วค่อยเจอข้อความว่าเลือกซ้ำกัน — ทำให้สถานะ
   * ที่ผิดเกิดขึ้นบนหน้าจอไม่ได้ตั้งแต่แรก ดีกว่าปล่อยให้เกิดแล้วค่อยฟ้อง
   */
  const effectiveTo = to === from ? (accounts.find((a) => a.id !== from)?.id ?? "") : to;

  useEffect(() => {
    if (state.status === "ok" || deleteState.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, deleteState]);

  // ลบไม่สำเร็จแล้วถอยกลับไปปุ่มปกติ ไม่ค้างอยู่ที่ "ยืนยันลบ"
  const [seenDelete, setSeenDelete] = useState(deleteState);
  if (seenDelete !== deleteState) {
    setSeenDelete(deleteState);
    if (deleteState.status === "error") setConfirmingDelete(false);
  }

  if (accounts.length < 2) {
    return (
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-ink-soft">
        ต้องมีอย่างน้อยสองบัญชีถึงจะโอนได้ — เพิ่มบัญชีที่หน้าตั้งค่าก่อน
      </p>
    );
  }

  const canSubmit = amount.value.trim().length > 0 && Boolean(effectiveTo);

  return (
    <>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="shopId" value={shopId} />
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <input type="hidden" name="txnDate" value={date} />

        <Field label="จำนวนเงิน" htmlFor="transfer-amount" error={fieldError(state, "amount")}>
          <MoneyInput
            {...amount}
            id="transfer-amount"
            name="amount"
            placeholder="0.00"
            required
            autoFocus={!editing}
            enterKeyHint="next"
          />
        </Field>

        <Field label="จากบัญชี" htmlFor="transfer-from">
          <Select
            id="transfer-from"
            name="fromAccountId"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <AccountChoices accounts={accounts} />
          </Select>
        </Field>

        {/* ลูกศรบอกทิศทางเงิน ไม่ต้องอ่านป้ายกำกับก็รู้ว่าอันไหนต้นทางอันไหนปลายทาง */}
        <div aria-hidden className="-my-1 text-center text-lg leading-none text-ink-soft">
          ↓
        </div>

        <Field label="ไปบัญชี" htmlFor="transfer-to" error={fieldError(state, "toAccountId")}>
          <Select
            id="transfer-to"
            name="toAccountId"
            value={effectiveTo}
            onChange={(e) => setTo(e.target.value)}
          >
            {/* ตัดบัญชีต้นทางออกจากตัวเลือก เลือกซ้ำกันไม่ได้ตั้งแต่แรก */}
            <AccountChoices accounts={accounts.filter((a) => a.id !== from)} />
          </Select>
        </Field>

        <DatePicker value={date} onChange={setDate} error={fieldError(state, "txnDate")} />

        {/**
         * หมายเหตุไม่ได้ยุบไว้เหมือนฟอร์มบันทึกรายการ
         *
         * เพราะการโอนไม่มีประเภทและไม่มีชื่อรายการมาช่วยอธิบาย เหลือแค่
         * จาก → ไป → จำนวน ผ่านไปสองเดือนแล้วเห็น "SCB → กรุงไทย 20,000"
         * จะไม่มีทางรู้เลยว่าโอนไปทำไม ช่องนี้จึงเป็นที่เดียวที่เก็บเหตุผลได้
         */}
        <Field label="โอนไปทำไม (ไม่บังคับ)" htmlFor={noteId}>
          <Input
            {...note}
            id={noteId}
            name="note"
            maxLength={500}
            placeholder="เช่น สำรองจ่ายค่าของเดือนหน้า"
            enterKeyHint="done"
          />
        </Field>

        <StatusMessage state={state} />

        <SubmitButton className="w-full" disabled={!canSubmit}>
          {editing ? "บันทึกการแก้ไข" : "โอนเงิน"}
        </SubmitButton>
      </form>

      {editing && (
        <form action={deleteAction} className="mt-3 border-t border-line pt-3">
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="id" value={editing.id} />

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
              ลบการโอนนี้
            </Button>
          )}
        </form>
      )}
    </>
  );
}

/** ต่างจาก AccountOptions ตรงที่ไม่มี "— ไม่ระบุ —" เพราะการโอนต้องระบุเสมอ */
function AccountChoices({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {bahtShort(a.balance)}
        </option>
      ))}
    </>
  );
}
