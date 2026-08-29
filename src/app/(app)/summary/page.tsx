import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import {
  getSummary,
  listCategoryTotals,
  listDailyForMonth,
  listDailyForWeek,
  listMonthlyForYear,
} from "@/db/queries";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  currentMonth,
  currentYear,
  relativeDayLabel,
  thaiDate,
  thaiDateLong,
  thaiMonth,
  thaiMonthShort,
  thaiWeek,
  thaiYear,
  today,
  monthOf,
  weekOf,
  weekRange,
  yearOf,
} from "@/lib/date";
import { getShopContext } from "@/lib/shop";
import { dateSchema, monthSchema, yearSchema } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { daysOfMonth, daysOfWeek, monthsOfYear, thaiWeekdayShort } from "@/lib/chart";
import { BreakdownTable } from "./breakdown-table";
import { TrendChart, pointTitle, type TrendPoint } from "./trend-chart";
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
  searchParams: Promise<{ p?: string; d?: string; w?: string; m?: string; y?: string }>;
}) {
  const context = await getShopContext();
  if (!context) return null;

  const shopId = context.shop.id;
  const params = await searchParams;

  // ไม่ระบุมุมมองมา = วันนี้ — หน้านี้เป็นหน้าแรกของแอปแล้ว
  // เปิดมาต้องตอบ "วันนี้เป็นยังไง" ทันที ไม่ใช่ภาพทั้งเดือน
  const view =
    params.p === "week"
      ? "week"
      : params.p === "month"
        ? "month"
        : params.p === "year"
          ? "year"
          : "day";

  // ค่าจาก URL แก้เองได้ ตรวจก่อนใช้เสมอ ไม่ผ่านก็ตกกลับมาเป็นช่วงปัจจุบัน
  const day = dateSchema.safeParse(params.d).data ?? today();
  // สัปดาห์แทนด้วยวันจันทร์ จึงตรวจด้วย dateSchema ได้เลยเพราะเป็นวันที่จริง
  // แล้วดึงกลับไปหาวันจันทร์อีกที เผื่อมีคนส่งวันกลางสัปดาห์มาใน URL
  const week = weekOf(dateSchema.safeParse(params.w).data ?? today());
  const month = monthSchema.safeParse(params.m).data ?? currentMonth();
  const year = yearSchema.safeParse(params.y).data ?? currentYear();

  /**
   * วันตัวแทนของช่วงที่กำลังดู — แท็บอื่นพาไปช่วงที่ครอบวันนี้เสมอ
   *
   * เดิมแต่ละแท็บจำช่วงของตัวเองแยกกัน เปิดดูเดือนกรกฎาแล้วจิ้มเข้าไปดู
   * วันที่ 15 พอกดกลับแท็บเดือน กลายเป็นเดือนสิงหา (เดือนปัจจุบัน) เพราะ
   * URL ไม่มี m ติดมา ช่วงที่กำลังไล่ดูหายไปเฉยๆ
   *
   * ถ้าช่วงที่ดูครอบวันนี้อยู่ ใช้วันนี้เป็นตัวแทน (กดไปแท็บวันแล้วได้วันนี้
   * ไม่ใช่วันที่ 1) ถ้าเป็นช่วงอดีต ใช้วันแรกของช่วงนั้น
   */
  const now = today();
  const anchor =
    view === "day"
      ? day
      : view === "week"
        ? now >= week && now <= weekRange(week)[1]
          ? now
          : week
        : view === "month"
          ? monthOf(now) === month
            ? now
            : `${month}-01`
          : yearOf(now) === year
            ? now
            : `${year}-01-01`;

  return (
    <div className="space-y-3">
      <ViewToggle
        view={view}
        day={anchor}
        week={weekOf(anchor)}
        month={monthOf(anchor)}
        year={yearOf(anchor)}
      />

      {view === "day" && <DayView shopId={shopId} day={day} />}
      {view === "week" && <WeekView shopId={shopId} week={week} />}
      {view === "month" && <MonthView shopId={shopId} month={month} />}
      {view === "year" && <YearView shopId={shopId} year={year} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ViewToggle({
  view,
  day,
  week,
  month,
  year,
}: {
  view: "day" | "week" | "month" | "year";
  day: string;
  week: string;
  month: string;
  year: string;
}) {
  const tabs = [
    { key: "day", label: "วัน", href: `/summary?p=day&d=${day}` },
    { key: "week", label: "สัปดาห์", href: `/summary?p=week&w=${week}` },
    { key: "month", label: "เดือน", href: `/summary?p=month&m=${month}` },
    { key: "year", label: "ปี", href: `/summary?p=year&y=${year}` },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-surface-2 p-1.5">
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

/**
 * ส่งออกช่วงที่กำลังดูอยู่เป็นไฟล์ Excel
 *
 * อยู่ท้ายทุกมุมมองโดยตั้งใจ เพราะช่วงเวลาที่คนอยากได้ไฟล์ คือช่วงที่
 * เพิ่งดูตัวเลขจนพอใจแล้ว ไม่ต้องไปเลือกวันซ้ำอีกรอบในหน้าอื่น
 *
 * ใช้คำว่า "ช่วงนี้" เหมือนกันทั้งสี่มุมมอง ไม่ใช่ "วันนี้/เดือนนี้" เพราะคน
 * เลื่อนไปดูวันหรือเดือนย้อนหลังได้ ปุ่มที่เขียนว่าวันนี้ทั้งที่กำลังดูเมื่อวาน
 * คือคำโกหกเล็กๆ ที่ทำให้ไม่แน่ใจว่าไฟล์ที่ได้เป็นของวันไหนกันแน่
 *
 * เป็นลิงก์ธรรมดา ไม่ใช่ปุ่มที่เรียก JavaScript เบราว์เซอร์จัดการ
 * ดาวน์โหลดเองได้ดีกว่า และไม่โดนบล็อกบนมือถือ
 */
function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex min-h-touch items-center justify-center gap-2 rounded-2xl bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition active:bg-surface-2"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 shrink-0 text-ink-soft"
        aria-hidden
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      {label}
    </a>
  );
}

/**
 * ประกอบจุดของกราฟจากแถวที่ฐานข้อมูลคืนมา
 *
 * แถวจากฐานมีเฉพาะช่วงที่มีรายการ ต้องเติมช่องว่างให้ครบทุกวัน/เดือน
 * ไม่งั้นแกนเวลาบิด — เดือนที่ขายแค่สามวันจะได้กราฟสามแท่งชิดกัน
 * ดูเหมือนขายต่อเนื่องทั้งที่ห่างกันเป็นสัปดาห์
 */
function dailyPoints(
  slots: string[],
  rows: { txnDate: string; profit: string }[],
  label: (date: string, index: number) => string,
): TrendPoint[] {
  const byDate = new Map(rows.map((r) => [r.txnDate, r.profit]));

  return slots.map((date, i) => {
    const profit = byDate.get(date) ?? "0";

    return {
      key: date,
      label: label(date, i),
      title: pointTitle(thaiDate(date), profit),
      profit,
      href: `/summary?p=day&d=${date}`,
    };
  });
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
          {/* บอกวันตามจริง — ปุ่มที่เขียนว่าวันนี้ทั้งที่กำลังดูเมื่อวานคือคำโกหกเล็กๆ */}
          ดูรายการของ{label ?? "วันนั้น"}
        </Link>
      </div>

      <CategoryBreakdown totals={categoryTotals} />

      <ExportLink href={`/api/export?p=day&d=${day}`} label="ส่งออกช่วงนี้เป็น Excel" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  รายสัปดาห์                                                         */
/* ------------------------------------------------------------------ */

/**
 * สัปดาห์คือช่วงที่ร้านใช้ตอบตัวเองบ่อยที่สุด
 *
 * "เดือนนี้ได้เท่าไหร่" ตอบยากตอนเดือนยังไม่จบ เพราะไม่รู้ว่าจะเทียบกับอะไร
 * แต่ "อาทิตย์นี้ได้เท่าไหร่" เป็นช่วงที่จบเร็วพอจะเห็นผลของสิ่งที่เพิ่งทำ
 * และยาวพอที่วันแย่วันเดียวจะไม่ทำให้ตกใจ
 *
 * ใช้ getSummary กับ listDailyIn ตัวเดียวกับมุมมองอื่นทั้งหมด ต่างกันแค่
 * ขอบเขตวัน ยอดรายวันจึงบวกขึ้นเป็นสัปดาห์ และสัปดาห์บวกขึ้นเป็นเดือนได้ตรงกัน
 */
async function WeekView({ shopId, week }: { shopId: string; week: string }) {
  const [summary, days, categoryTotals] = await Promise.all([
    getSummary(shopId, { week }),
    listDailyForWeek(shopId, week),
    listCategoryTotals(shopId, { week }),
  ]);

  const thisWeek = weekOf(today());
  const label =
    week === thisWeek
      ? "สัปดาห์นี้"
      : week === addWeeks(thisWeek, -1)
        ? "สัปดาห์ที่แล้ว"
        : null;

  return (
    <>
      <PeriodNav
        label={label ?? thaiWeek(week)}
        sublabel={label ? thaiWeek(week) : undefined}
        prevHref={`/summary?p=week&w=${addWeeks(week, -1)}`}
        nextHref={`/summary?p=week&w=${addWeeks(week, 1)}`}
      />

      <SummaryCard summary={summary} title={`สรุปสัปดาห์ ${thaiWeek(week)}`} />

      <TrendChart
        heading="กำไรรายวัน"
        points={dailyPoints(daysOfWeek(week), days, (d) => thaiWeekdayShort(d))}
      />

      <BreakdownTable
        heading="แยกรายวัน"
        unitLabel="วันที่"
        emptyText="สัปดาห์นี้ยังไม่มีรายการ"
        rows={days.map((d) => ({
          key: d.txnDate,
          href: `/summary?p=day&d=${d.txnDate}`,
          label: relativeDayLabel(d.txnDate) ?? thaiDate(d.txnDate),
          meta: `${d.txnCount} รายการ`,
          income: d.income,
          expense: d.expense,
          profit: d.profit,
        }))}
      />

      <CategoryBreakdown totals={categoryTotals} />

      <ExportLink href={`/api/export?p=week&w=${week}`} label="ส่งออกช่วงนี้เป็น Excel" />
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

      <TrendChart
        heading="กำไรรายวัน"
        // ป้ายเว้นช่วงทุกเจ็ดวัน — สามสิบเอ็ดช่องบนจอมือถือใส่เลขทุกวันไม่ไหว
        points={dailyPoints(daysOfMonth(month), days, (d, i) =>
          i % 7 === 0 ? String(Number(d.slice(-2))) : "",
        )}
      />

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

      <ExportLink href={`/api/export?p=month&m=${month}`} label="ส่งออกช่วงนี้เป็น Excel" />
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

      <TrendChart
        heading="กำไรรายเดือน"
        points={monthlyPoints(year, months)}
      />

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

      <ExportLink href={`/api/export?p=year&y=${year}`} label="ส่งออกช่วงนี้เป็น Excel" />
    </>
  );
}

function monthlyPoints(
  year: string,
  rows: { month: string; profit: string }[],
): TrendPoint[] {
  const byMonth = new Map(rows.map((r) => [r.month, r.profit]));

  return monthsOfYear(year).map((month) => {
    const profit = byMonth.get(month) ?? "0";

    return {
      key: month,
      label: thaiMonthShort(month),
      title: pointTitle(thaiMonthShort(month), profit),
      profit,
      href: `/summary?p=month&m=${month}`,
    };
  });
}
