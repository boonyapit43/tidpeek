"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  createAccount,
  deleteAccount,
  setAccountActive,
  updateAccount,
} from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import { DangerActions } from "@/components/danger-actions";
import {
  Field,
  Input,
  MoneyInput,
  Select,
  StatusMessage,
  SubmitButton,
} from "@/components/form-parts";
import { Sheet } from "@/components/sheet";
import type { AccountWithBalance } from "@/db/queries";
import type { AccountKind } from "@/db/schema";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

const KIND_LABEL: Record<AccountKind, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  ewallet: "วอลเล็ต",
};

const KIND_OPTIONS = Object.entries(KIND_LABEL) as [AccountKind, string][];

/**
 * จัดการบัญชี
 *
 * "ลบ" บัญชีคือการปิดใช้งาน ไม่ใช่ลบแถวออกจริง เพราะรายการเก่าอ้างถึงบัญชีนี้
 * อยู่ ถ้าลบจริงรายการเหล่านั้นจะกลายเป็นไม่มีบัญชี แล้วยอดที่เคยผ่านบัญชีนี้
 * จะตามรอยไม่ได้อีกเลย บัญชีที่ปิดแล้วจะไม่โผล่ในฟอร์มบันทึกแต่ยอดเก่ายังอยู่ครบ
 */
export function AccountManager({
  shopId,
  accounts,
}: {
  shopId: string;
  accounts: AccountWithBalance[];
}) {
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-semibold text-ink-soft">บัญชีและช่องทางเงิน</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm font-semibold text-brand"
        >
          + เพิ่ม
        </button>
      </div>

      <ul className="divide-y divide-line">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => setEditing(account)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2",
                !account.isActive && "opacity-50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-ink">{account.name}</span>
                  {account.shopId === null && (
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                      ร่วม
                    </span>
                  )}
                  {!account.isActive && (
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                      ปิดอยู่
                    </span>
                  )}
                </span>
                {/* บอกชนิดบัญชีเมื่อยังไม่ได้กรอกเลขบัญชีหรือชื่อธนาคาร
                    ดีกว่าเขียนว่า "ไม่ระบุเลขบัญชี" ซึ่งไม่ได้บอกอะไรเลย
                    และผิดความจริงสำหรับเงินสดที่ไม่มีเลขบัญชีอยู่แล้ว */}
                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                  {account.accountNo ?? account.bank ?? KIND_LABEL[account.kind]}
                </span>
              </span>

              <span className="num shrink-0 text-sm font-bold text-ink">
                {bahtShort(account.balance)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <AddAccountSheet open={adding} onClose={() => setAdding(false)} shopId={shopId} />
      <EditAccountSheet
        account={editing}
        onClose={() => setEditing(null)}
        shopId={shopId}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * เนื้อหาของแผ่นถูกสร้างใหม่ทุกครั้งที่เปิด และผูก key กับบัญชีที่กำลังแก้
 *
 * ถ้าปล่อยให้ค้างไว้ สถานะของ useActionState จะข้ามครั้งมา เปิดแผ่น "เพิ่มบัญชี"
 * แล้วเจอข้อความ "เพิ่มบัญชีแล้ว" ของครั้งก่อนค้างอยู่ หรือเปิดบัญชีถัดไป
 * แล้วเจอข้อความผิดพลาดของบัญชีก่อนหน้า ซึ่งอ่านแล้วเข้าใจผิดได้ทันที
 */
function AddAccountSheet({
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
      <SharedToggle defaultChecked={false} />
      <StatusMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="กำลังเพิ่ม">
        เพิ่มบัญชี
      </SubmitButton>
    </form>
  );
}

function EditAccountSheet({
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
        <SharedToggle defaultChecked={account.shopId === null} />

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

  return (
    <>
      <Field label="ชื่อบัญชี" htmlFor={`${id}-name`}>
        <Input
          id={`${id}-name`}
          name="name"
          defaultValue={account?.name}
          required
          maxLength={120}
          placeholder="เช่น กสิกรไทย, ไทยพลัส, เงินสด"
        />
      </Field>

      <Field label="ประเภทบัญชี" htmlFor={`${id}-kind`}>
        <Select id={`${id}-kind`} name="kind" defaultValue={account?.kind ?? "bank"}>
          {KIND_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ธนาคาร (ไม่บังคับ)" htmlFor={`${id}-bank`}>
        <Input id={`${id}-bank`} name="bank" defaultValue={account?.bank ?? ""} maxLength={80} />
      </Field>

      <Field label="เลขบัญชี (ไม่บังคับ)" htmlFor={`${id}-no`}>
        <Input
          id={`${id}-no`}
          name="accountNo"
          defaultValue={account?.accountNo ?? ""}
          maxLength={40}
          inputMode="numeric"
        />
      </Field>

      {/* ยอดตั้งต้นคือเงินที่มีอยู่ในบัญชีนี้ก่อนเริ่มใช้แอป ถ้าปล่อยเป็น 0
          ยอดคงเหลือที่เห็นจะเป็นแค่ "เดินไปเท่าไหร่" ไม่ใช่ "มีอยู่เท่าไหร่" */}
      <Field label="ยอดตั้งต้น" htmlFor={`${id}-opening`}>
        <MoneyInput
          id={`${id}-opening`}
          name="openingBalance"
          defaultValue={account?.openingBalance ?? "0"}
          placeholder="0.00"
        />
      </Field>
    </>
  );
}

function SharedToggle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
      <input
        type="checkbox"
        name="shared"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
      />
      <span className="text-sm text-ink">ใช้ร่วมกันทุกร้าน</span>
    </label>
  );
}
