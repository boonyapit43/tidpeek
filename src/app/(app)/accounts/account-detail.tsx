"use client";

import { useState } from "react";
import type { AccountWithBalance, MovementRow } from "@/db/queries";
import { baht, bahtShort } from "@/lib/money";
import { thaiDate } from "@/lib/date";
import { cn } from "@/lib/cn";
import { type EditableTransfer, TransferSheet } from "./transfer-sheet";

/**
 * เงินเข้าออกของบัญชีเดียว
 *
 * รวมทั้งรายการปกติและการโอนไว้ในรายการเดียวกัน เรียงตามวัน เพราะคนดู
 * ไม่ได้สนใจว่าเบื้องหลังเก็บอยู่คนละตาราง สนใจแค่ว่า "เงินในบัญชีนี้
 * เข้าออกอะไรไปบ้าง" — และผลรวมของทุกบรรทัดบวกยอดตั้งต้น ต้องได้ยอด
 * คงเหลือที่โชว์อยู่ข้างบนพอดี ถ้าไม่พอดีแปลว่ามีอะไรตกหล่น
 *
 * แตะบรรทัดที่เป็นการโอนเพื่อแก้หรือลบได้ ส่วนรายการปกติแก้ที่หน้ารายวัน
 * ตามเดิม ไม่ได้ทำสองที่ให้ต้องคอยดูแลให้เหมือนกัน
 */
export function AccountDetail({
  shopId,
  account,
  accounts,
  movements,
}: {
  shopId: string;
  account: AccountWithBalance;
  accounts: AccountWithBalance[];
  movements: MovementRow[];
}) {
  const [editing, setEditing] = useState<EditableTransfer | null>(null);

  const balance = Number.parseFloat(account.balance);

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="truncate text-base font-bold text-ink">{account.name}</h1>
            {account.shopId === null && (
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                ใช้ร่วมทุกร้าน
              </span>
            )}
          </div>

          <div
            className={cn(
              "num mt-1 text-3xl font-bold tracking-tight",
              balance < 0 ? "text-expense" : "text-ink",
            )}
          >
            {baht(account.balance)}
          </div>

          <div className="mt-1 text-xs text-ink-soft">
            ยอดตั้งต้น <span className="num">{bahtShort(account.openingBalance)}</span>
            {account.accountNo && ` · ${account.accountNo}`}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-soft">
          เงินเข้าออกบัญชีนี้
        </h2>

        {movements.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-soft">
            ยังไม่มีเงินเข้าออกบัญชีนี้
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {movements.map((row) => (
              <MovementLine
                key={`${row.kind}-${row.id}`}
                row={row}
                onEditTransfer={() => setEditing(toEditable(row))}
              />
            ))}
          </ul>
        )}
      </section>

      <TransferSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        shopId={shopId}
        accounts={accounts}
        editing={editing}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MovementLine({
  row,
  onEditTransfer,
}: {
  row: MovementRow;
  onEditTransfer: () => void;
}) {
  const incoming = !row.signed.startsWith("-");
  const isTransfer = row.kind === "transfer";

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "h-9 w-1 shrink-0 rounded-full",
          isTransfer ? "bg-brand/50" : incoming ? "bg-income" : "bg-expense",
        )}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">
            {isTransfer ? `${incoming ? "จาก" : "ไป"} ${row.label}` : row.label}
          </span>
          {isTransfer && (
            <span className="shrink-0 rounded bg-brand-soft px-1.5 py-px text-[10px] text-brand">
              โอน
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-soft">
          {[thaiDate(row.txnDate), row.categoryName, row.note].filter(Boolean).join(" · ")}
        </span>
      </span>

      {/* เครื่องหมายบวกลบกำกับเสมอ ไม่ได้ใช้สีบอกทิศทางเงินอย่างเดียว */}
      <span
        className={cn(
          "num shrink-0 text-sm font-bold",
          incoming ? "text-income" : "text-expense",
        )}
      >
        {incoming ? "+" : "−"}
        {bahtShort(row.signed.replace("-", ""))}
      </span>
    </>
  );

  return (
    <li>
      {isTransfer ? (
        <button
          type="button"
          onClick={onEditTransfer}
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-surface-2"
        >
          {body}
        </button>
      ) : (
        // รายการปกติแก้ที่หน้ารายวัน ตรงนี้แสดงอย่างเดียว
        <div className="flex items-center gap-3 px-3 py-3">{body}</div>
      )}
    </li>
  );
}

/**
 * แปลงบรรทัดที่แสดงอยู่ ให้เป็นค่าตั้งต้นของฟอร์มแก้ไขการโอน
 *
 * id ของทั้งสองฝั่งติดมากับข้อมูลอยู่แล้ว (row.transfer) ไม่ได้เดาย้อนจาก
 * ชื่อบัญชี เพราะชื่อซ้ำกันได้ เช่นมีบัญชีชื่อ "เงินสด" ทั้งของร้านและของกลาง
 * แล้วจะจับคู่ผิดเป็นคนละบัญชีโดยไม่มีอะไรฟ้อง
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์ตรวจซ้ำทุกครั้งอยู่แล้วว่าการโอนนี้เป็นของร้านนี้จริง
 *    ค่าตรงนี้จึงเป็นแค่ค่าตั้งต้นของฟอร์ม ไม่ใช่ด่านความปลอดภัย
 */
function toEditable(row: MovementRow): EditableTransfer {
  return {
    id: row.id,
    fromAccountId: row.transfer?.fromAccountId ?? "",
    toAccountId: row.transfer?.toAccountId ?? "",
    txnDate: row.txnDate,
    // signed เป็นผลต่อบัญชีที่กำลังดู แต่ฟอร์มต้องการจำนวนที่โอนซึ่งเป็นบวกเสมอ
    amount: row.signed.replace("-", ""),
    note: row.note,
  };
}
