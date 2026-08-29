"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditAccountSheet } from "@/components/account-sheet";
import { Button } from "@/components/form-parts";
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
  const router = useRouter();
  const [editingTransfer, setEditingTransfer] = useState<EditableTransfer | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);

  const balance = Number.parseFloat(account.balance);
  const openingNotSet = Number.parseFloat(account.openingBalance) === 0;

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

          {/**
           * ยอดตั้งต้นแตะแก้ได้ตรงนี้เลย ไม่ต้องเดินไปหน้าตั้งค่าแล้วไล่หา
           * บัญชีเดิมอีกรอบ — คนที่กำลังดูยอดของบัญชีนี้อยู่ คือคนที่รู้ว่า
           * เลขมันผิดและอยากแก้เดี๋ยวนั้น
           */}
          <button
            type="button"
            onClick={() => setEditingAccount(true)}
            className={cn(
              "mt-1 flex min-h-touch items-center gap-1.5 text-xs transition",
              openingNotSet ? "font-semibold text-brand" : "text-ink-soft hover:text-ink",
            )}
          >
            {openingNotSet ? (
              <>ยังไม่ได้ตั้งยอดตั้งต้น — แตะเพื่อใส่เงินที่มีอยู่จริง</>
            ) : (
              <>
                ยอดตั้งต้น <span className="num">{bahtShort(account.openingBalance)}</span>
                {account.accountNo && ` · ${account.accountNo}`}
              </>
            )}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 shrink-0"
              aria-hidden
            >
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>

        {/* ปุ่มโอนอยู่ในกล่องเดียวกับยอด เพราะคนที่คิดจะโอน คือคนที่เพิ่งดูยอด
            แล้วเห็นว่าบัญชีนี้มีเงินพอ (หรือไม่พอ) อยู่ตรงหน้าพอดี */}
        <div className="border-t border-line p-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setTransferring(true)}
            disabled={accounts.length < 2}
          >
            โอนเงินออกจากบัญชีนี้
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <h2 className="card-head">
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
                onEditTransfer={() => setEditingTransfer(toEditable(row))}
              />
            ))}
          </ul>
        )}
      </section>

      {/* แผ่นโอน มีสองโหมดในตัวเดียว — สร้างใหม่จากปุ่มข้างบน
          หรือแก้ของเดิมจากการแตะบรรทัดที่มีป้าย "โอน" */}
      <TransferSheet
        open={transferring || editingTransfer !== null}
        onClose={() => {
          setTransferring(false);
          setEditingTransfer(null);
        }}
        shopId={shopId}
        accounts={accounts}
        editing={editingTransfer}
        defaultFromId={account.id}
        /**
          * โอนเสร็จแล้วพากลับไปหน้ารวมบัญชี ไม่ค้างอยู่ที่บัญชีเดียว
          *
          * การโอนขยับเงินสองบัญชีพร้อมกัน แต่หน้านี้โชว์ได้ทีละบัญชี
          * ยืนดูอยู่ที่เดิมจึงเห็นแค่ขาที่เงินออก ไม่เห็นว่าปลายทางรับครบไหม
          * ซึ่งเป็นสิ่งเดียวที่คนโอนอยากรู้
          *
          * เฉพาะตอนโอนใหม่เท่านั้น แก้หรือลบของเดิมยังอยู่หน้าเดิม
          * เพราะตอนนั้นกำลังไล่ดูประวัติของบัญชีนี้อยู่ ไม่ควรถูกพาออกไป
          */
        onCreated={() => router.push("/accounts")}
      />

      <EditAccountSheet
        account={editingAccount ? account : null}
        onClose={() => setEditingAccount(false)}
        shopId={shopId}
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
        /**
         * รายการปกติพาไปแก้ที่หน้ารายวัน ซึ่งเป็นที่แก้ของมันที่เดียว
         *
         * ?t= พาไปถึงหน้าแก้ไขของรายการนั้นเลย ไม่ใช่แค่พาไปถึงวัน แล้วปล่อย
         * ให้ไล่หาเองในลิสต์ทั้งวัน ซึ่งวันที่ลงสามสิบรายการคือการหาของ
         *
         * ตั้งใจไม่ทำหน้าแก้ไขซ้ำอีกอันตรงนี้ เพราะสองที่ที่แก้ของเดียวกันได้
         * แปลว่าต้องคอยดูแลให้เหมือนกันตลอดไป แล้ววันหนึ่งมันจะไม่เหมือน
         */
        <Link
          href={`/day?d=${row.txnDate}&t=${row.id}`}
          className="flex items-center gap-3 px-3 py-3 transition active:bg-surface-2"
        >
          {body}
        </Link>
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
