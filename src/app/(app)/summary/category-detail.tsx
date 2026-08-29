import Link from "next/link";
import { listCategoryEntries, listCategoryTotals, type Period } from "@/db/queries";
import type { Direction } from "@/db/schema";
import { thaiDate } from "@/lib/date";
import { bahtShort } from "@/lib/money";
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
}: {
  shopId: string;
  /** null = กลุ่มรายการที่ไม่ระบุประเภท ซึ่งเจาะดูได้เหมือนกลุ่มอื่น */
  categoryId: string | null;
  direction: Direction;
  period: Period;
  periodLabel: string;
  backHref: string;
}) {
  const [entries, totals] = await Promise.all([
    listCategoryEntries(shopId, period, categoryId, direction),
    listCategoryTotals(shopId, period),
  ]);

  // ชื่อและยอดรวมเอาจากแถวเดียวกับที่หน้าสรุปโชว์ ไม่คำนวณใหม่ให้มีโอกาสเพี้ยน
  const group = totals.find((t) => t.categoryId === categoryId && t.direction === direction);
  const name = group?.name ?? "ไม่ระบุประเภท";
  const income = direction === "in";

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
        กลับไปหน้าสรุป
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
              {income ? "รับเข้า" : "จ่ายออก"} · {periodLabel} · {entries.length} รายการ
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

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-ink-soft shadow-sm">
          ช่วงนี้ไม่มีรายการของประเภทนี้
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
    </div>
  );
}
