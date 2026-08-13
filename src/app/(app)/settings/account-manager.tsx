"use client";

import { useState } from "react";
import { AddAccountSheet, EditAccountSheet, KIND_LABEL } from "@/components/account-sheet";
import type { AccountWithBalance } from "@/db/queries";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * จัดการบัญชี
 *
 * "ลบ" บัญชีคือการปิดใช้งาน ไม่ใช่ลบแถวออกจริง เพราะรายการเก่าอ้างถึงบัญชีนี้
 * อยู่ ถ้าลบจริงรายการเหล่านั้นจะกลายเป็นไม่มีบัญชี แล้วยอดที่เคยผ่านบัญชีนี้
 * จะตามรอยไม่ได้อีกเลย บัญชีที่ปิดแล้วจะไม่โผล่ในฟอร์มบันทึกแต่ยอดเก่ายังอยู่ครบ
 *
 * ตัวแผ่นเพิ่มและแก้ไขอยู่ที่ components/account-sheet.tsx เพราะหน้าบัญชี
 * ก็เรียกใช้แผ่นเดียวกันนี้ ตอนแตะบัญชีเข้าไปแล้วอยากตั้งยอดตั้งต้นตรงนั้นเลย
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
      <EditAccountSheet account={editing} onClose={() => setEditing(null)} shopId={shopId} />
    </section>
  );
}
