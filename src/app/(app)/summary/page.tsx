import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import {
  getSummary,
  listCategoryTotals,
  listDailyForMonth,
  listMonthlyForYear,
} from "@/db/queries";
import {
  addDays,
  addMonths,
  addYears,
  currentMonth,
  currentYear,
  relativeDayLabel,
  thaiDate,
  thaiDateLong,
  thaiMonth,
  thaiMonthShort,
  thaiYear,
  today,
} from "@/lib/date";
import { getShopContext } from "@/lib/shop";
import { dateSchema, monthSchema, yearSchema } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { BreakdownTable } from "./breakdown-table";
import { CategoryBreakdown } from "./category-breakdown";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "สรุป" };

/**
 * มุมมองสรุป — วัน เดือน ปี ใช้หน้าเดียวกันทั้งหมด
 *
 * ทั้งสามโหมดต่างกันแค่ขอบเขตของช่วงวันและหน่วยที่เอามาแจกแจง
 * ตัวเลขคำนวณจาก SQL ตัวเดียวกัน (getSummary) จึงไม่มีทางที่ยอดรวมของวัน
 * กับยอดรวมของเดือนจะคิดกันคนละวิธีแล้วบวกกันไม่ลง
 */
export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; d?: string; m?: string; y?: string }>;
}) {
  const context = await getShopContext();
  if (!context) return null;

  const shopId = context.shop.id;
  const params = await searchParams;

  const view = params.p === "day" ? "day" : params.p === "year" ? "year" : "month";

  // ค่าจาก URL แก้เองได้ ตรวจก่อนใช้เสมอ ไม่ผ่านก็ตกกลับมาเป็นช่วงปัจจุบัน
  const day = dateSchema.safeParse(params.d).data ?? today();
  const month = monthSchema.safeParse(params.m).data ?? currentMonth();
  const year = yearSchema.safeParse(params.y).data ?? currentYear();

  return (
    <div className="space-y-3">
      <ViewToggle view={view} day={day} month={month} year={year} />

      {view === "day" && <DayView shopId={shopId} day={day} />}
      {view === "month" && <MonthView shopId={shopId} month={month} />}
      {view === "year" && <YearView shopId={shopId} year={year} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ViewToggle({
  view,
  day,
  month,
  year,
}: {
  view: "day" | "month" | "year";
  day: string;
  month: string;
  year: string;
}) {
  const tabs = [
    { key: "day", label: "รายวัน", href: `/summary?p=day&d=${day}` },
    { key: "month", label: "รายเดือน", href: `/summary?p=month&m=${month}` },
    { key: "year", label: "รายปี", href: `/summary?p=year&y=${year}` },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-2 p-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={view === tab.key ? "page" : undefined}
          className={cn(
            "flex min-h-touch items-center justify-center rounded-lg text-sm font-semibold transition",
            view === tab.key ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** แถบเลื่อนช่วงเวลา ใช้ร่วมกันทั้งสามโหมด */
function PeriodNav({
  label,
  sublabel,
  prevHref,
  nextHref,
}: {
  label: string;
  sublabel?: string;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Arrow href={prevHref} direction="prev" label="ช่วงก่อนหน้า" />

      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-sm font-semibold text-ink">{label}</div>
        {sublabel && <div className="truncate text-xs text-ink-soft">{sublabel}</div>}
      </div>

      <Arrow href={nextHref} direction="next" label="ช่วงถัดไป" />
    </div>
  );
}

function Arrow({
  href,
  direction,
  label,
}: {
  href: string;
  direction: "prev" | "next";
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition hover:bg-surface-2 active:scale-95"
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

/* ------------------------------------------------------------------ */
/*  รายวัน                                                             */
/* ------------------------------------------------------------------ */

/**
 * โหมดรายวันไม่มีตารางแจกแจง เพราะวันหนึ่งไม่มีช่วงย่อยให้แบ่งอีก
 * สิ่งที่ตอบคำถามได้จริงคือแยกตามประเภท ว่าวันนี้เงินไปไหนมาบ้าง
 * ส่วนรายการทีละบรรทัดอยู่ที่แท็บรายวัน ซึ่งแก้ไขได้ด้วย
 */
async function DayView({ shopId, day }: { shopId: string; day: string }) {
  const [summary, categoryTotals] = await Promise.all([
    getSummary(shopId, { day }),
    listCategoryTotals(shopId, { day }),
  ]);

  const label = relativeDayLabel(day);

  return (
    <>
      <PeriodNav
        label={label ?? thaiDateLong(day)}
        sublabel={label ? thaiDateLong(day) : undefined}
        prevHref={`/summary?p=day&d=${addDays(day, -1)}`}
        nextHref={`/summary?p=day&d=${addDays(day, 1)}`}
      />

      <SummaryCard summary={summary} title={`สรุป${thaiDateLong(day)}`} />

      <div className="rounded-2xl bg-surface p-3 shadow-sm">
        <Link
          href={`/day?d=${day}`}
          className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-ink transition hover:bg-surface-2"
        >
          ดูรายการของวันนี้
        </Link>
      </div>

      <CategoryBreakdown totals={categoryTotals} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  รายเดือน                                                           */
/* ------------------------------------------------------------------ */

async function MonthView({ shopId, month }: { shopId: string; month: string }) {
  const [summary, days, categoryTotals] = await Promise.all([
    getSummary(shopId, { month }),
    listDailyForMonth(shopId, month),
    listCategoryTotals(shopId, { month }),
  ]);

  return (
    <>
      <PeriodNav
        label={thaiMonth(month)}
        prevHref={`/summary?p=month&m=${addMonths(month, -1)}`}
        nextHref={`/summary?p=month&m=${addMonths(month, 1)}`}
      />

      <SummaryCard summary={summary} title={`สรุปเดือน${thaiMonth(month)}`} />

      <BreakdownTable
        heading="แยกรายวัน"
        unitLabel="วันที่"
        emptyText="เดือนนี้ยังไม่มีรายการ"
        rows={days.map((d) => ({
          key: d.txnDate,
          // แตะแล้วไปดูสรุปของวันนั้นต่อได้เลย
          href: `/summary?p=day&d=${d.txnDate}`,
          label: thaiDate(d.txnDate),
          meta: `${d.txnCount} รายการ`,
          income: d.income,
          expense: d.expense,
          profit: d.profit,
        }))}
      />

      <CategoryBreakdown totals={categoryTotals} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  รายปี                                                              */
/* ------------------------------------------------------------------ */

async function YearView({ shopId, year }: { shopId: string; year: string }) {
  const [summary, months, categoryTotals] = await Promise.all([
    getSummary(shopId, { year }),
    listMonthlyForYear(shopId, year),
    listCategoryTotals(shopId, { year }),
  ]);

  return (
    <>
      <PeriodNav
        label={`ปี ${thaiYear(year)}`}
        prevHref={`/summary?p=year&y=${addYears(year, -1)}`}
        nextHref={`/summary?p=year&y=${addYears(year, 1)}`}
      />

      <SummaryCard summary={summary} title={`สรุปปี ${thaiYear(year)}`} />

      <BreakdownTable
        heading="แยกรายเดือน"
        unitLabel="เดือน"
        emptyText="ปีนี้ยังไม่มีรายการ"
        rows={months.map((m) => ({
          key: m.month,
          href: `/summary?p=month&m=${m.month}`,
          label: thaiMonthShort(m.month),
          meta: `${m.txnCount} รายการ`,
          income: m.income,
          expense: m.expense,
          profit: m.profit,
        }))}
      />

      <CategoryBreakdown totals={categoryTotals} />
    </>
  );
}
