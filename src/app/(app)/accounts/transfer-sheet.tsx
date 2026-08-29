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
  defaultFromId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  accounts: AccountWithBalance[];
  /** ถ้ามี = โหมดแก้ไข ถ้าไม่มี = โหมดสร้างใหม่ */
  editing?: EditableTransfer | null;
  /**
   * บัญชีต้นทางที่เลือกไว้ให้ล่วงหน้า
   *
   * ใช้ตอนกดโอนจากหน้าของบัญชีใดบัญชีหนึ่ง คนกดตั้งใจจะโอน "ออกจากบัญชีนี้"
   * อยู่แล้ว ไม่ควรต้องมาเลือกซ้ำอีกรอบว่าเงินออกจากไหน
   */
  defaultFromId?: string;
  /**
   * เรียกเมื่อสร้างการโอนใหม่สำเร็จ (ไม่เรียกตอนแก้ของเดิมหรือลบ)
   *
   * มีไว้ให้หน้าที่เปิดแผ่นนี้พาไปดูผลต่อได้ เพราะการโอนขยับเงินสองบัญชี
   * พร้อมกัน แต่หน้าที่กดโอนมาอาจเห็นแค่บัญชีเดียว
   */
  onCreated?: () => void;
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
          defaultFromId={defaultFromId}
          onDone={onClose}
          onCreated={onCreated}
        />
      )}
    </Sheet>
  );
}

function TransferForm({
  shopId,
  accounts,
  editing,
  defaultFromId,
  onDone,
  onCreated,
}: {
  shopId: string;
  accounts: AccountWithBalance[];
  editing: EditableTransfer | null;
  defaultFromId?: string;
  onDone: () => void;
  onCreated?: () => void;
}) {
  const [state, formAction] = useActionState(editing ? updateTransfer : createTransfer, IDLE);
  const [deleteState, deleteAction] = useActionState(deleteTransfer, IDLE);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const noteId = useId();

  /**
   * ใช้ useState ตรงๆ แทน useKeptValue เพราะปุ่ม "ทั้งหมด" ต้องเซ็ตค่าเองได้
   * ซึ่ง useKeptValue ไม่ได้คืน setter ออกมา (มันคือ useState ที่ห่อไว้อยู่แล้ว
   * เพื่อกัน React 19 ล้างค่า ซึ่ง controlled แบบนี้ก็กันได้เหมือนกัน)
   */
  const [amount, setAmount] = useState(editing?.amount ?? "");
  const note = useKeptValue(editing?.note ?? "");
  const [date, setDate] = useState(editing?.txnDate ?? today);

  /**
   * ไม่เดาบัญชีให้ — ทั้งสองช่องเริ่มที่ "เลือกบัญชีก่อน" แล้วให้เลือกเอง
   *
   * เคยเลือกสองบัญชีแรกไว้ให้เพื่อความไว แต่การย้ายเงินจริงที่ต้นทางถูกเดา
   * ผิดคือยอดสองบัญชีเพี้ยนพร้อมกันเงียบๆ ปุ่มโอนจึงล็อกไว้จนกว่าจะเลือกครบ
   *
   * ยกเว้นสองกรณีที่ไม่ใช่การเดา: แก้ของเดิม (ค่าจริงของแถวนั้น) และกดโอน
   * จากหน้าของบัญชีใดบัญชีหนึ่ง ซึ่งคนกดตั้งใจโอน "ออกจากบัญชีนี้" อยู่แล้ว
   */
  const initialFrom =
    editing?.fromAccountId ??
    (defaultFromId && accounts.some((a) => a.id === defaultFromId) ? defaultFromId : "");

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(editing?.toAccountId ?? "");

  /**
   * เปลี่ยนต้นทางไปทับปลายทางที่เลือกไว้ ปลายทางถอยกลับเป็น "เลือกบัญชีก่อน"
   *
   * สถานะซ้ำกันเกิดบนหน้าจอไม่ได้ตั้งแต่แรก และไม่แอบเดาบัญชีอื่นแทน —
   * การเดาตรงนี้คือสิ่งเดียวกับที่เพิ่งเลิกทำข้างบน
   */
  const effectiveTo = to === from ? "" : to;

  useEffect(() => {
    if (state.status === "ok" || deleteState.status === "ok") onDone();
    if (state.status === "ok" && !editing) onCreated?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, deleteState]);

  // ลบไม่สำเร็จแล้วถอยกลับไปปุ่มปกติ ไม่ค้างอยู่ที่ "ยืนยันลบ"
  /**
   * นับรอบของ action ไว้ใช้เป็น key ของช่องเลือก
   *
   * React 19 สั่ง form.reset() เองหลัง action ทำงานจบ ซึ่งล้างค่าใน DOM
   * ของ <select> แต่ไม่ได้บอก React — React จึงยังคิดว่าค่าเดิมอยู่ครบและ
   * ไม่สั่งวาดใหม่ ผลคือจอโชว์หัวตาราง "เลือก...ก่อน" แต่ค่าที่ฟอร์มจะส่งจริง
   * ยังเป็นของเดิม — คนเห็นอย่างหนึ่ง ระบบทำอีกอย่าง
   *
   * พิสูจน์แล้วว่าเกิดจริง: กดบันทึกพลาดหนึ่งครั้ง ช่องเลือกกลายเป็นว่าง
   * แต่ปุ่มยังกดได้อยู่ เพราะเงื่อนไขอ่านจาก state ที่ยังมีค่าเต็ม
   *
   * เปลี่ยน key ทุกครั้งที่ action จบ = สร้างช่องใหม่จาก state ปัจจุบัน
   * DOM กับ state จึงกลับมาตรงกันเสมอ
   */
  const [formRound, setFormRound] = useState(0);
  const [seenState, setSeenState] = useState(state);

  if (seenState !== state) {
    setSeenState(state);
    setFormRound((n) => n + 1);
  }

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

  const canSubmit = amount.trim().length > 0 && Boolean(from) && Boolean(effectiveTo);

  /**
   * ยอดคงเหลือของบัญชีต้นทาง ไว้ให้ปุ่ม "ทั้งหมด" เติมให้ในทีเดียว
   *
   * ท่าที่ร้านทำจริงคือปิดร้านแล้วฝากเงินสดทั้งกระเป๋าเข้าธนาคาร ซึ่งเดิม
   * ต้องเลื่อนไปอ่านยอดในตัวเลือกแล้วพิมพ์ตามทีละหลัก พิมพ์พลาดหลักเดียว
   * ยอดสองบัญชีก็เพี้ยนพร้อมกัน
   *
   * ส่งยอดเป็น string ต่อตรงจากฐานข้อมูล ไม่แปลงเป็น number ระหว่างทาง
   * ตามกฎเงินของแอป — ที่แปลงตรงนี้มีแค่การเทียบว่ามากกว่าศูนย์ไหม
   * ซึ่งไม่ได้เอาผลไปเป็นยอดเงิน
   */
  const fromBalance = accounts.find((a) => a.id === from)?.balance;
  const fullAmount =
    fromBalance && Number.parseFloat(fromBalance) > 0 ? fromBalance : null;

  return (
    <>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="shopId" value={shopId} />
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <input type="hidden" name="txnDate" value={date} />

        {/**
          * ลำดับช่อง: จากบัญชี → ไปบัญชี → จำนวนเงิน
          *
          * เดิมจำนวนเงินอยู่บนสุด ซึ่งทำให้ปุ่ม "ทั้งหมด" ที่ต้องรู้บัญชีต้นทาง
          * ก่อนถึงจะโผล่ ไปโผล่เหนือจุดที่คนเลื่อนผ่านไปแล้ว
          *
          * เรียงแบบนี้ตรงกับลำดับที่คนคิดตอนย้ายเงินจริง — เอาจากไหน ไปไหน
          * เท่าไหร่ — และตรงกับที่แอปธนาคารเรียง จำนวนเงินจึงเป็นช่องสุดท้าย
          * ที่กรอก ซึ่งเป็นตอนที่รู้ยอดคงเหลือของต้นทางแล้วพอดี
          *
          * เลิก autoFocus ด้วย ของเดิมเด้งคีย์บอร์ดตัวเลขขึ้นมาทันทีที่เปิดแผ่น
          * ซึ่งบังช่องเลือกบัญชีที่ตอนนี้เป็นสิ่งแรกที่ต้องทำ
          */}
        <Field label="จากบัญชี" htmlFor="transfer-from">
          <Select
            key={`from-${formRound}`}
            id="transfer-from"
            name="fromAccountId"
            value={from}
            /**
             * ไม่รับค่าว่างจาก onChange — กติกาเดียวกับช่องวันที่
             *
             * React 19 สั่งรีเซ็ตฟอร์มเองหลัง action ทำงานจบ ไม่ว่าจะสำเร็จหรือพลาด
             * ซึ่งดันช่องเลือกกลับไปที่หัวตารางแล้วยิง onChange ตามมาด้วยค่าว่าง
             * ถ้ารับไว้ สิ่งที่เลือกจะหายทั้งที่คนไม่ได้แตะ — กดบันทึกพลาดหนึ่งครั้ง
             * แล้วต้องเลือกใหม่หมด ซึ่งเป็นอาการที่โทษเน็ตแล้วจบ ไม่มีใครเอะใจว่าเป็นบั๊ก
             *
             * การล้างค่าตอนบันทึกสำเร็จทำที่บล็อกรีเซ็ตด้วย setState ตรงๆ อยู่แล้ว
             */
            onChange={(e) => {
              if (e.target.value) setFrom(e.target.value);
            }}
          >
            {/**
              * เลือกได้ ไม่ได้ disabled ไว้
              *
              * React 19 สั่งรีเซ็ตฟอร์มเองหลัง action ทำงานจบ ไม่ว่าจะสำเร็จ
              * หรือพลาด ซึ่งดันช่องกลับไปที่ตัวเลือกแรก "ที่เลือกได้" —
              * ถ้าหัวตารางถูกปิดไว้ มันจะข้ามไปลงที่บัญชีจริงตัวแรกแล้วยิง
              * ออกมาเป็นการเลือกจริง ผลคือกดโอนพลาดหนึ่งครั้ง ต้นทางเปลี่ยนเอง
              * โดยไม่มีใครแตะ ซึ่งกับการย้ายเงินคือเรื่องใหญ่
              */}
            <option value="">— เลือกบัญชีต้นทาง —</option>
            <AccountChoices accounts={accounts} />
          </Select>
        </Field>

        {/* ลูกศรบอกทิศทางเงิน ไม่ต้องอ่านป้ายกำกับก็รู้ว่าอันไหนต้นทางอันไหนปลายทาง */}
        <div aria-hidden className="-my-1 text-center text-lg leading-none text-ink-soft">
          ↓
        </div>

        <Field label="ไปบัญชี" htmlFor="transfer-to" error={fieldError(state, "toAccountId")}>
          <Select
            key={`to-${formRound}`}
            id="transfer-to"
            name="toAccountId"
            value={effectiveTo}
            // ไม่รับค่าว่าง ด้วยเหตุผลเดียวกับช่องต้นทาง
            onChange={(e) => {
              if (e.target.value) setTo(e.target.value);
            }}
          >
            {/* เลือกได้ ด้วยเหตุผลเดียวกับช่องต้นทาง */}
            <option value="">— เลือกบัญชีปลายทาง —</option>
            {/* ตัดบัญชีต้นทางออกจากตัวเลือก เลือกซ้ำกันไม่ได้ตั้งแต่แรก */}
            <AccountChoices accounts={accounts.filter((a) => a.id !== from)} />
          </Select>
        </Field>

        <Field label="จำนวนเงิน" htmlFor="transfer-amount" error={fieldError(state, "amount")}>
          <MoneyInput
            id="transfer-amount"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            enterKeyHint="done"
          />

          {/**
            * โผล่เฉพาะตอนที่รู้ว่าโอนจากบัญชีไหนและบัญชีนั้นมีเงินอยู่จริง
            * ปุ่มที่เติมค่าศูนย์หรือค่าติดลบให้ ไม่ได้ช่วยอะไรนอกจากทำให้กดพลาด
            */}
          {fullAmount && (
            <button
              type="button"
              onClick={() => setAmount(fullAmount)}
              className="mt-1.5 inline-flex min-h-touch items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition active:bg-surface-2"
            >
              ทั้งหมด
              <span className="num font-semibold text-ink">{bahtShort(fullAmount)}</span>
            </button>
          )}
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
