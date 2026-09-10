import Link from "next/link";
import {
  listCategoryEntries,
  listCategoryTitleTotals,
  listCategoryTotals,
  type Period,
} from "@/db/queries";
import type { Direction } from "@/db/schema";
import { thaiDate } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { LoadMore } from "@/components/load-more";
import { cn } from "@/lib/cn";

/**
 * เจาะดูว่ายอดของประเภทหนึ่งประกอบจากรายการไหนบ้าง
 *
 * เกิดจากคำถามจริงของคนใช้ — เห็น "ค่าแรง 1,890" ในหน้าสรุปแล้วอยากรู้ว่า
 * คืออะไรบ้าง เดิมต้องจำตัวเลขไว้แล้วไปไล่หาเอาเองในหน้ารายวันทีละวัน
 * ตอนนี้แตะที่แถวประเภทแล้วมาลงหน้านี้ เห็นครบทีละบรรทัด แตะต่อไปแก้ได้เลย
 *
 * ใช้ช่วงเวลาเดียวกับหน้าสรุปที่กดมาเป๊ะ ตัวเลขรวมข้างบนกับผลบวกของ
 * รายการข้างล่างจึงเป็นก้อนเดียวกันเสมอ ไม่มีทางเล่าคนละเรื่อง
 */
export async function CategoryDetail({
  shopId,
  categoryId,
  direction,
  period,
  periodLabel,
  backHref,
  shown,
  moreHref,
  title,
  titleHref,
}: {
  shopId: string;
  /** null = กลุ่มรายการที่ไม่ระบุประเภท ซึ่งเจาะดูได้เหมือนกลุ่มอื่น */
  categoryId: string | null;
  direction: Direction;
  period: Period;
  periodLabel: string;
  backHref: string;
  /** จำนวนรายการที่จะโหลดมาแสดง ที่เหลือรอกดดูเพิ่ม */
  shown: number;
  moreHref: string;
  /**
   * เจาะลงไปอีกชั้น — ชื่อรายการกลุ่มที่เลือกไว้
   *
   * ไม่มีค่า = โหมดรวมยอดตามชื่อ ซึ่งเป็นหน้าแรกที่เห็นตอนแตะประเภท
   * มีค่า    = โหมดไล่ทีละรายการของชื่อนั้น
   */
  title?: string;
  /** ตัวสร้างลิงก์ไปกลุ่มหนึ่ง ใช้ตอนอยู่ในโหมดรวมยอด */
  titleHref: (key: string) => string;
}) {
  const grouped = title === undefined;

  const [entries, byTitle, totals] = await Promise.all([
    // โหมดรวมยอดไม่ต้องดึงรายการทีละแถวเลย ประหยัดการไปกลับหนึ่งครั้ง
    grouped
      ? Promise.resolve([])
      : listCategoryEntries(shopId, period, categoryId, direction, shown, title),
    grouped
      ? listCategoryTitleTotals(shopId, period, categoryId, direction)
      : Promise.resolve([]),
    listCategoryTotals(shopId, period),
  ]);

  // ชื่อและยอดรวมเอาจากแถวเดียวกับที่หน้าสรุปโชว์ ไม่คำนวณใหม่ให้มีโอกาสเพี้ยน
  const group = totals.find((t) => t.categoryId === categoryId && t.direction === direction);
  const name = group?.name ?? "ไม่ระบุประเภท";
  const income = direction === "in";

  /**
   * จำนวนที่โชว์บนหัวต้องเป็นจำนวนจริงทั้งหมด ไม่ใช่จำนวนที่โหลดมา
   *
   * เดิมใช้ entries.length ได้เพราะไม่มีเพดาน สองอย่างนี้เท่ากันเสมอ
   * พอใส่เพดานแล้วมันแยกกันทันที และตัวที่ผิดคือตัวที่คนอ่านแล้วเชื่อ —
   * "ปี 2569 · 50 รายการ" ทั้งที่จริงมี 365 คือการรายงานตัวเลขผิด
   * ไม่ใช่แค่ UI ไม่สวย
   */
  const total = group?.txnCount ?? entries.length;

  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        className="inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {grouped ? "กลับไปหน้าสรุป" : `กลับไป${name}`}
      </Link>

      <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <div className="flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-base font-bold text-ink">{name}</h1>
              {group && !group.counts && (
                <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                  ไม่นับเป็นกำไร
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              {income ? "รับเข้า" : "จ่ายออก"} · {periodLabel} ·{" "}
              {grouped && <>{byTitle.length.toLocaleString("th-TH")} ชื่อ · </>}
              {total.toLocaleString("th-TH")} รายการ
            </p>
          </div>

          <div
            className={cn(
              "num shrink-0 text-2xl font-bold tracking-tight",
              income ? "text-income" : "text-expense",
            )}
          >
            {bahtShort(group?.total ?? "0")}
          </div>
        </div>
      </section>

      {/**
       * โหมดรวมยอดตามชื่อรายการ
       *
       * เกิดจากคำถามจริงของเจ้าของร้าน — "เดือนนี้จ่ายกอล์ฟไปเท่าไหร่แล้ว"
       * เดิมแตะประเภทค่าแรงแล้วได้ 46 บรรทัดเรียงตามวัน ต้องบวกเองในหัวทีละชื่อ
       * แบบนี้เหลือ 14 บรรทัดพร้อมยอดรวม แล้วแตะชื่อไล่ดูทีละรายการต่อได้
       *
       * รวมเฉพาะชื่อที่ตรงกันทุกตัวอักษร ไม่มีการรวมตัวสะกดให้ — ตั้งใจแบบนั้น
       * เจ้าของร้านจะได้เห็นเองว่าเคยพิมพ์ไว้สองแบบ แล้วแก้ที่ต้นทางได้
       * เหตุผลเต็มอยู่ที่ listCategoryTitleTotals ใน queries.ts
       */}
      {grouped ? (
        byTitle.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-ink-soft shadow-sm">
            ช่วงนี้ไม่มีรายการของประเภทนี้
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm">
            {byTitle.map((row) => (
              <li key={row.title}>
                <Link
                  href={titleHref(row.title)}
                  className="flex min-h-touch items-center gap-3 px-4 py-3 transition active:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{row.title}</div>
                    <div className="text-xs text-ink-soft">
                      {row.count.toLocaleString("th-TH")} รายการ
                    </div>
                  </div>

                  <span
                    className={cn(
                      "num shrink-0 text-sm font-semibold",
                      income ? "text-income" : "text-expense",
                    )}
                  >
                    {bahtShort(row.total)}
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
            ))}
          </ul>
        )
      ) : entries.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-ink-soft shadow-sm">
          ช่วงนี้ไม่มีรายการของชื่อนี้
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm">
          {entries.map((entry) => (
            <li key={entry.id}>
              {/* แตะแล้วไปเปิดแผ่นแก้ไขของรายการนั้นที่หน้ารายวันเลย */}
              <Link
                href={`/day?d=${entry.txnDate}&t=${entry.id}`}
                className="flex items-center gap-3 px-4 py-3 transition active:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{entry.title}</div>
                  <div className="truncate text-xs text-ink-soft">
                    {thaiDate(entry.txnDate)}
                    {entry.accountName ? ` · ${entry.accountName}` : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </div>
                </div>

                <span
                  className={cn(
                    "num shrink-0 text-sm font-semibold",
                    income ? "text-income" : "text-expense",
                  )}
                >
                  {income ? "+" : "−"}
                  {bahtShort(entry.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/**
       * โหมดรวมยอดดึงมาครบทุกชื่ออยู่แล้ว ไม่มีอะไรให้โหลดเพิ่ม
       *
       * และเพดานของโหมดเจาะกลุ่มต้องไม่ใช่ total ซึ่งเป็นจำนวนของทั้งประเภท
       * ไม่ใช่ของชื่อที่เลือก ถ้าใช้ ปุ่มโหลดเพิ่มจะค้างอยู่ตลอดทั้งที่ไล่ครบแล้ว
       */}
      {!grouped && (
        <LoadMore
          shown={entries.length}
          total={entries.length < shown ? entries.length : total}
          href={moreHref}
        />
      )}
    </div>
  );
}
