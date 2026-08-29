"use client";

import Link from "next/link";
import { useState } from "react";
import { KIND_LABEL } from "@/components/account-sheet";
import { Button } from "@/components/form-parts";
import type { AccountWithBalance } from "@/db/queries";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";
import { TransferSheet } from "./transfer-sheet";

/**
 * รายชื่อบัญชีพร้อมยอดคงเหลือ
 *
 * ยอดรวมอยู่บนสุดเพราะเป็นตัวเลขที่ถูกถามบ่อยที่สุด ("ตอนนี้มีเงินเท่าไหร่")
 * แล้วค่อยแจกแจงว่าอยู่ในกระเป๋าไหนบ้าง
 */
export function AccountBoard({
  shopId,
  accounts,
}: {
  shopId: string;
  accounts: AccountWithBalance[];
}) {
  const [transferring, setTransferring] = useState(false);

  /**
   * รวมยอดด้วย number ตรงนี้ได้ เพราะเป็นตัวเลขสำหรับดูเฉยๆ ไม่ได้เอาไปเก็บ
   * หรือคิดต่อ และจำนวนบัญชีมีไม่กี่ใบ ส่วนยอดของแต่ละบัญชียังคิดใน SQL
   * เหมือนเดิมทุกบัญชี
   */
  // บวกเป็น "สตางค์" จำนวนเต็ม ไม่ใช่บาททศนิยม — 0.1 + 0.2 ของ float
  // ไม่เท่า 0.3 พอดี ยอดที่ควรเป็นศูนย์เป๊ะจะเหลือเศษ 1e-13 แล้วทั้งตัวเลข
  // ที่โชว์และเงื่อนไข total !== 0 ข้างล่างเพี้ยนตาม
  const totalSatang = accounts.reduce(
    (sum, a) => sum + Math.round(Number.parseFloat(a.balance) * 100),
    0,
  );
  const total = totalSatang / 100;

  /**
   * ทุกบัญชียังไม่ได้ตั้งยอดตั้งต้นเลยสักใบ แต่มีเงินเดินแล้ว
   *
   * แปลว่าตัวเลขที่เห็นคือ "เดินไปเท่าไหร่ตั้งแต่เริ่มใช้แอป" ไม่ใช่
   * "มีอยู่จริงเท่าไหร่" ซึ่งต่างกันมากและมองไม่ออกจากตัวเลขอย่างเดียว
   *
   * บรรทัดนี้หายไปเองทันทีที่ตั้งยอดสักบัญชี จึงไม่ใช่คำเตือนที่ค้างถาวร
   */
  const neverSetOpening =
    accounts.length > 0 &&
    accounts.every((a) => Number.parseFloat(a.openingBalance) === 0) &&
    totalSatang !== 0;

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl bg-surface px-4 py-10 text-center shadow-sm">
        <p className="text-sm text-ink-soft">ยังไม่มีบัญชี</p>
        <Link href="/settings" className="mt-2 inline-block text-sm font-semibold text-brand">
          เพิ่มบัญชีที่หน้าตั้งค่า
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <div className="bg-brand-gradient text-on-accent px-4 py-4">
          <div className="text-xs opacity-90">เงินรวมทุกบัญชี</div>
          <div className="num mt-0.5 text-3xl font-bold tracking-tight">{bahtShort(total)}</div>
        </div>

        <ul className="divide-y divide-line">
          {accounts.map((account) => {
            const balance = Number.parseFloat(account.balance);

            return (
              <li key={account.id}>
                <Link
                  href={`/accounts?a=${account.id}`}
                  className="flex min-h-touch items-center gap-3 px-4 py-3 transition active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">
                        {account.name}
                      </span>
                      {account.shopId === null && (
                        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                          ร่วม
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                      {account.bank ?? KIND_LABEL[account.kind]}
                    </span>
                  </span>

                  {/* ติดลบใช้สีแดงคู่กับเครื่องหมายลบที่ตัวเลขเอง ไม่ได้พึ่งสีอย่างเดียว */}
                  <span
                    className={cn(
                      "num shrink-0 text-base font-bold",
                      balance < 0 ? "text-expense" : "text-ink",
                    )}
                  >
                    {bahtShort(account.balance)}
                  </span>

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 shrink-0 text-ink-soft"
                    aria-hidden
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ปุ่มอยู่ติดกับรายการบัญชีเลย ไม่ได้ไปต่อท้ายคำเตือน
          เพราะคำเตือนยาวสามบรรทัด ถ้าวางไว้หลังมันปุ่มจะตกไปอยู่ล่างสุดของหน้า
          ซึ่งเป็นที่ที่ไม่มีใครมองหาปุ่มทำอะไร */}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setTransferring(true)}
        disabled={accounts.length < 2}
      >
        โอนเงินระหว่างบัญชี
      </Button>

      {neverSetOpening && (
        <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-ink-soft shadow-sm">
          ยอดที่เห็นคือเงินที่เดินไปตั้งแต่เริ่มใช้แอป ยังไม่ใช่เงินที่มีอยู่จริง —
          แตะบัญชีแล้วตั้ง <span className="font-semibold text-brand">ยอดตั้งต้น</span>{" "}
          ครั้งเดียว แล้วยอดจะตรงตลอดไป
        </p>
      )}

      <TransferSheet
        open={transferring}
        onClose={() => setTransferring(false)}
        shopId={shopId}
        accounts={accounts}
      />
    </div>
  );
}
