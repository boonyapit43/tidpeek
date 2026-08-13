import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import {
  getSummary,
  listAccountsWithBalance,
  listCategories,
  listTransactionsByDate,
} from "@/db/queries";
import { addDays, relativeDayLabel, thaiDateLong, today } from "@/lib/date";
import { getShopContext } from "@/lib/shop";
import { dateSchema } from "@/lib/validation";
import { DateJump } from "./date-jump";
import { TxnList } from "./txn-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "รายวัน" };

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; t?: string }>;
}) {
  const context = await getShopContext();
  if (!context) return null;

  const shopId = context.shop.id;

  const params = await searchParams;

  // วันที่มาจาก URL ซึ่งคนแก้เองได้ ต้องตรวจก่อนใช้เสมอ
  // ถ้าไม่ผ่านให้ตกกลับมาเป็นวันนี้ ดีกว่าโชว์หน้า error
  const parsed = params.d ? dateSchema.safeParse(params.d) : null;
  const date = parsed?.success ? parsed.data : today();

  /**
   * ?t= คือรายการที่ให้เปิดหน้าแก้ไขให้เลย มาจากหน้าเคลื่อนไหวของบัญชี
   *
   * ไม่ต้องตรวจว่าเป็น uuid จริงไหม เพราะมันถูกเอาไปเทียบกับรายการของวันนี้
   * ที่ผูกร้านมาแล้วเท่านั้น ค่ามั่วจะไม่ตรงกับอะไรเลยแล้วเงียบไปเอง
   */
  const openTxnId = params.t;

  const [items, summary, accounts, categories] = await Promise.all([
    listTransactionsByDate(shopId, date),
    getSummary(shopId, { day: date }),
    listAccountsWithBalance(shopId),
    listCategories(shopId),
  ]);

  const label = relativeDayLabel(date);

  return (
    <div className="space-y-3">
      {/**
       * แถบเลื่อนวัน — ปุ่มก่อนหน้า/ถัดไปเป็นลิงก์จริง ไม่ใช่ปุ่ม JavaScript
       * ทำให้ปุ่มย้อนกลับของเบราว์เซอร์ทำงานถูกต้อง และกดค้างเพื่อเปิดแท็บใหม่ได้
       */}
      <div className="flex items-center gap-2">
        <DayLink date={addDays(date, -1)} label="วันก่อนหน้า" direction="prev" />

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold text-ink">
            {label ?? thaiDateLong(date)}
          </div>
          {label && <div className="truncate text-xs text-ink-soft">{thaiDateLong(date)}</div>}
        </div>

        <DayLink date={addDays(date, 1)} label="วันถัดไป" direction="next" />
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <DateJump date={date} />
        </div>

        {/* ค้นหาอยู่ตรงนี้แทนที่จะเป็นแท็บที่ห้าในเมนูล่าง เพราะสี่ช่องคือขนาด
            ที่นิ้วโป้งกดไม่พลาด และค้นหาเป็นสิ่งที่ใช้นานๆ ครั้ง */}
        <Link
          href="/search"
          aria-label="ค้นหารายการ"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition active:scale-95 hover:bg-surface-2"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="size-5"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
      </div>

      {/* หัวข้อนี้มีไว้ให้โปรแกรมอ่านหน้าจอ จึงต้องเป็นวันแบบไทยเหมือนที่ตาเห็น
          ไม่ใช่ 2026-08-13 ซึ่งจะถูกอ่านออกมาเป็นตัวเลขเรียงกันรัวๆ */}
      <SummaryCard summary={summary} title={`สรุป${thaiDateLong(date)}`} />

      <TxnList
        items={items}
        shopId={shopId}
        accounts={accounts}
        categories={categories}
        openTxnId={openTxnId}
      />
    </div>
  );
}

function DayLink({
  date,
  label,
  direction,
}: {
  date: string;
  label: string;
  direction: "prev" | "next";
}) {
  return (
    <Link
      href={`/day?d=${date}`}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition active:scale-95 hover:bg-surface-2"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <path d={direction === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </Link>
  );
}
