"use client";

import { useActionState, useEffect, useState } from "react";
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
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

const KIND_OPTIONS = [
  { value: "cash", label: "เงินสด" },
  { value: "bank", label: "บัญชีธนาคาร" },
  { value: "ewallet", label: "วอลเล็ต" },
] as const;

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
                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                  {account.accountNo ?? account.bank ?? "ไม่ระบุเลขบัญชี"}
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

function AddAccountSheet({
  open,
  onClose,
  shopId,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
}) {
  const [state, formAction] = useActionState(createAccount, IDLE);

  useEffect(() => {
    if (state.status === "ok") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Sheet open={open} onClose={onClose} title="เพิ่มบัญชี">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="shopId" value={shopId} />
        <AccountFields />
        <SharedToggle defaultChecked={false} />
        <StatusMessage state={state} />
        <SubmitButton className="w-full">เพิ่มบัญชี</SubmitButton>
      </form>
    </Sheet>
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
  const [state, formAction] = useActionState(updateAccount, IDLE);

  useEffect(() => {
    if (state.status === "ok") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Sheet open={account !== null} onClose={onClose} title="แก้ไขบัญชี">
      {account && (
        <>
          <form key={account.id} action={formAction} className="space-y-4">
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
            onDone={onClose}
          />
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function AccountFields({ account }: { account?: AccountWithBalance }) {
  return (
    <>
      <Field label="ชื่อบัญชี" htmlFor="acc-name">
        <Input
          id="acc-name"
          name="name"
          defaultValue={account?.name}
          required
          maxLength={120}
          placeholder="เช่น กสิกรไทย, เงินสดหน้าร้าน"
        />
      </Field>

      <Field label="ประเภทบัญชี" htmlFor="acc-kind">
        <Select id="acc-kind" name="kind" defaultValue={account?.kind ?? "bank"}>
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ธนาคาร (ไม่บังคับ)" htmlFor="acc-bank">
        <Input id="acc-bank" name="bank" defaultValue={account?.bank ?? ""} maxLength={80} />
      </Field>

      <Field label="เลขบัญชี (ไม่บังคับ)" htmlFor="acc-no">
        <Input
          id="acc-no"
          name="accountNo"
          defaultValue={account?.accountNo ?? ""}
          maxLength={40}
          inputMode="numeric"
        />
      </Field>

      <Field
        label="ยอดตั้งต้น"
        htmlFor="acc-opening"
        hint="ยอดที่มีอยู่ในบัญชีก่อนเริ่มใช้แอปนี้ ใส่ 0 ได้ถ้าเริ่มนับจากศูนย์"
      >
        <MoneyInput
          id="acc-opening"
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
      <span className="text-sm text-ink">
        ใช้ร่วมกันทุกร้าน
        <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
          ติ๊กเมื่อบัญชีใบนี้ใช้กับหลายร้าน เช่นบัญชีธนาคารใบเดียวรับเงินให้สองร้าน
          ยอดคงเหลือจะรวมรายการของทุกร้านที่ใช้บัญชีนี้
        </span>
      </span>
    </label>
  );
}
