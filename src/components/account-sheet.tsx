"use client";

import { useActionState, useEffect, useId } from "react";
import {
  createAccount,
  deleteAccount,
  setAccountActive,
  updateAccount,
} from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import { DangerActions } from "./danger-actions";
import {
  Field,
  Input,
  MoneyInput,
  Select,
  StatusMessage,
  SubmitButton,
  useKeptValue,
} from "./form-parts";
import { Sheet } from "./sheet";
import type { AccountWithBalance } from "@/db/queries";
import type { AccountKind } from "@/db/schema";
import { bahtShort } from "@/lib/money";

/**
 * แผ่นเพิ่มและแก้ไขบัญชี
 *
 * อยู่ที่นี่เพราะใช้สองที่ — หน้าตั้งค่า (จัดการบัญชีทั้งหมด) และหน้าบัญชี
 * (แตะบัญชีเข้าไปแล้วอยากตั้งยอดตั้งต้นตรงนั้นเลย โดยไม่ต้องเดินไปหน้าตั้งค่า
 * แล้วไล่หาบัญชีเดิมอีกรอบ)
 *
 * ถ้าปล่อยให้ต่างคนต่างเขียน วันหนึ่งที่แก้ที่หนึ่ง อีกที่จะเหลือของเก่า
 * แล้วการตั้งยอดตั้งต้นจากสองทางจะให้ผลไม่เหมือนกันโดยไม่มีอะไรบอกว่าทำไม
 */

export const KIND_LABEL: Record<AccountKind, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  ewallet: "วอลเล็ต",
};

const KIND_OPTIONS = Object.entries(KIND_LABEL) as [AccountKind, string][];

/* ------------------------------------------------------------------ */

/**
 * เนื้อหาของแผ่นถูกสร้างใหม่ทุกครั้งที่เปิด และผูก key กับบัญชีที่กำลังแก้
 *
 * ถ้าปล่อยให้ค้างไว้ สถานะของ useActionState จะข้ามครั้งมา เปิดแผ่น "เพิ่มบัญชี"
 * แล้วเจอข้อความ "เพิ่มบัญชีแล้ว" ของครั้งก่อนค้างอยู่ หรือเปิดบัญชีถัดไป
 * แล้วเจอข้อความผิดพลาดของบัญชีก่อนหน้า ซึ่งอ่านแล้วเข้าใจผิดได้ทันที
 */
export function AddAccountSheet({
  open,
  onClose,
  shopId,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="เพิ่มบัญชี">
      {open && <AddAccountForm shopId={shopId} onDone={onClose} />}
    </Sheet>
  );
}

function AddAccountForm({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const [state, formAction] = useActionState(createAccount, IDLE);

  useEffect(() => {
    if (state.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="shopId" value={shopId} />
      <AccountFields />
      <StatusMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="กำลังเพิ่ม">
        เพิ่มบัญชี
      </SubmitButton>
    </form>
  );
}

export function EditAccountSheet({
  account,
  onClose,
  shopId,
}: {
  account: AccountWithBalance | null;
  onClose: () => void;
  shopId: string;
}) {
  return (
    <Sheet open={account !== null} onClose={onClose} title="แก้ไขบัญชี">
      {account && (
        <EditAccountForm key={account.id} account={account} shopId={shopId} onDone={onClose} />
      )}
    </Sheet>
  );
}

function EditAccountForm({
  account,
  shopId,
  onDone,
}: {
  account: AccountWithBalance;
  shopId: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(updateAccount, IDLE);

  useEffect(() => {
    if (state.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="id" value={account.id} />

        <AccountFields account={account} />

        {/* ยอดคงเหลือปัจจุบันวางไว้ให้เทียบตอนแก้ยอดตั้งต้น เพราะแก้แล้ว
            ยอดนี้จะขยับตามทันที (ยอดคงเหลือคำนวณสดจากยอดตั้งต้นเสมอ) */}
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-soft">
          ยอดคงเหลือตอนนี้{" "}
          <span className="num font-semibold text-ink">{bahtShort(account.balance)}</span> บาท
        </p>

        <StatusMessage state={state} />
        <SubmitButton className="w-full">บันทึกการแก้ไข</SubmitButton>
      </form>

      <DangerActions
        shopId={shopId}
        id={account.id}
        isActive={account.isActive}
        activeLabel="ปิดใช้งาน"
        deleteLabel="ลบบัญชี"
        toggleAction={setAccountActive}
        deleteAction={deleteAccount}
        onDone={onDone}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * ชุดช่องเดียวกันนี้ถูกใช้ทั้งแผ่นเพิ่มและแผ่นแก้ไข
 *
 * id จึงมาจาก useId ไม่ได้เขียนตายไว้ ถ้าเขียนตายแล้ววันหนึ่งทั้งสองแผ่น
 * ถูก render พร้อมกัน จะมี id ซ้ำในหน้าเดียว แล้วการแตะป้ายกำกับของแผ่นหนึ่ง
 * จะไปโฟกัสช่องของอีกแผ่น ซึ่งเป็นบั๊กที่หาต้นตอยากมาก
 */
function AccountFields({ account }: { account?: AccountWithBalance }) {
  const id = useId();

  // ทุกช่องเป็น controlled เพื่อไม่ให้สิ่งที่พิมพ์หายตอนบันทึกไม่สำเร็จ
  // บัญชีมีห้าช่อง เป็นฟอร์มที่เจ็บที่สุดถ้าต้องกรอกใหม่ทั้งชุด
  const name = useKeptValue(account?.name ?? "");
  const kind = useKeptValue(account?.kind ?? "bank");
  const bank = useKeptValue(account?.bank ?? "");
  const accountNo = useKeptValue(account?.accountNo ?? "");
  const opening = useKeptValue(account?.openingBalance ?? "0");

  return (
    <>
      <Field label="ชื่อบัญชี" htmlFor={`${id}-name`}>
        <Input
          {...name}
          id={`${id}-name`}
          name="name"
          required
          maxLength={120}
          placeholder="เช่น กสิกรไทย, ไทยพลัส, เงินสด"
        />
      </Field>

      <Field label="ประเภทบัญชี" htmlFor={`${id}-kind`}>
        <Select {...kind} id={`${id}-kind`} name="kind">
          {KIND_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ธนาคาร (ไม่บังคับ)" htmlFor={`${id}-bank`}>
        <Input {...bank} id={`${id}-bank`} name="bank" maxLength={80} />
      </Field>

      <Field label="เลขบัญชี (ไม่บังคับ)" htmlFor={`${id}-no`}>
        <Input {...accountNo} id={`${id}-no`} name="accountNo" maxLength={40} inputMode="numeric" />
      </Field>

      {/**
       * ยอดตั้งต้น = เงินที่มีอยู่ในบัญชีนี้ "ก่อน" เริ่มใช้แอป
       *
       * ตั้งครั้งเดียวแล้วยอดคงเหลือจะตรงกับความจริงตลอดไป เพราะยอดคงเหลือ
       * คำนวณสดจากยอดตั้งต้นบวกทุกอย่างที่เดินผ่านบัญชีเสมอ
       *
       * ถ้าปล่อยเป็น 0 ยอดที่เห็นจะเป็นแค่ "เดินไปเท่าไหร่ตั้งแต่เริ่มใช้"
       * ซึ่งไม่ใช่ตัวเลขที่เอาไปเทียบกับเงินในลิ้นชักหรือในแอปธนาคารได้
       */}
      <Field label="ยอดตั้งต้น (เงินที่มีอยู่ก่อนเริ่มใช้แอป)" htmlFor={`${id}-opening`}>
        <MoneyInput {...opening} id={`${id}-opening`} name="openingBalance" placeholder="0.00" />
      </Field>
    </>
  );
}

