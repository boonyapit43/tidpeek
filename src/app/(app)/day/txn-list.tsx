"use client";

import { useState } from "react";
import type { AccountWithBalance, TxnRow } from "@/db/queries";
import type { Category } from "@/db/schema";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";
import { EditSheet } from "./edit-sheet";

/**
 * รายการเคลื่อนไหวของวัน
 *
 * ทั้งแถวเป็นปุ่ม แตะตรงไหนก็เปิดหน้าแก้ไขได้ ไม่ต้องเล็งไอคอนเล็กๆ
 * ซึ่งเป็นเรื่องใหญ่บนมือถือที่ใช้นิ้วโป้งกด
 *
 * ใช้แถบสีที่ขอบซ้ายบอกทิศทางเงิน คู่กับเครื่องหมาย + − ที่จำนวนเงิน
 * ไม่พึ่งสีอย่างเดียว เพราะคนตาบอดสีแยกเขียวกับแดงไม่ออก
 */
export function TxnList({
  items,
  shopId,
  accounts,
  categories,
  openTxnId,
}: {
  items: TxnRow[];
  shopId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  /**
   * id ของรายการที่ให้เปิดหน้าแก้ไขทันทีที่โหลดหน้า
   *
   * มาจาก ?t= ใน URL ซึ่งหน้าเคลื่อนไหวของบัญชีลิงก์มา — คนแตะรายการที่นั่น
   * เพราะอยากแก้รายการนั้น ถ้าพามาถึงหน้ารายวันแล้วปล่อยให้ไล่หาเองในลิสต์
   * ทั้งวัน ก็เท่ากับไม่ได้พามา
   */
  openTxnId?: string;
}) {
  /**
   * ตั้งค่าเริ่มต้นครั้งเดียวตอน mount ไม่ได้ผูกกับ openTxnId ตลอดเวลา
   *
   * ถ้าผูกไว้ พอปิดแผ่นแล้วมันจะเด้งกลับมาเปิดใหม่ทันที เพราะ URL ยังมี ?t=
   * อยู่เหมือนเดิม ปิดไม่ลงจนกว่าจะเปลี่ยนหน้า
   *
   * id ที่ไม่ตรงกับรายการไหนในวันนี้ (เช่นวันผิด หรือถูกลบไปแล้ว) จะได้ null
   * คือเปิดหน้ารายวันตามปกติ ไม่ต้องมี error ให้ตกใจ
   */
  const [editing, setEditing] = useState<TxnRow | null>(
    () => items.find((t) => t.id === openTxnId) ?? null,
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-surface px-4 py-10 text-center shadow-sm">
        <p className="text-sm text-ink-soft">ยังไม่มีรายการ</p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm">
        {items.map((txn) => {
          const income = txn.direction === "in";

          return (
            <li key={txn.id}>
              <button
                type="button"
                onClick={() => setEditing(txn)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-9 w-1 shrink-0 rounded-full",
                    income ? "bg-income" : "bg-expense",
                  )}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-ink">{txn.title}</span>
                    {!txn.counts && (
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                        ไม่นับ
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">
                    {[txn.categoryName, txn.accountName, txn.note].filter(Boolean).join(" · ") ||
                      "ไม่ระบุประเภท"}
                  </span>
                </span>

                <span
                  className={cn(
                    "num shrink-0 font-bold tabular-nums",
                    income ? "text-income" : "text-expense",
                  )}
                >
                  {income ? "+" : "−"}
                  {bahtShort(txn.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <EditSheet
        txn={editing}
        onClose={() => setEditing(null)}
        shopId={shopId}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
