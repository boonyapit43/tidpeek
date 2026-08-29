"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CategoryTotal, PeriodEntry } from "@/db/queries";
import { thaiDate } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * เงินหมดไปกับอะไร และมาจากไหน — แตะแถวแล้วกางดูรายการข้างในได้เลย
 *
 * ใช้แถบยาวสั้นเทียบกันแทนกราฟวงกลม เพราะบนจอมือถือแคบๆ วงกลมที่มี
 * หลายชิ้นอ่านสัดส่วนไม่ออกและต้องมีคำอธิบายสีแยกออกไปอีกก้อน
 * แถบแนวนอนวางชื่อกับตัวเลขไว้ในบรรทัดเดียวกันได้เลย
 *
 * ความยาวแถบเทียบกับรายการที่มากที่สุดในกลุ่ม ไม่ใช่เทียบกับผลรวม
 * เพราะจุดประสงค์คือ "อะไรใหญ่กว่าอะไร" ไม่ใช่ "แต่ละอันคิดเป็นกี่เปอร์เซ็นต์"
 *
 * ⚠️ การกางใช้ข้อมูลที่แนบมากับหน้าแล้ว ไม่ยิงขอใหม่ตอนกด — กดแล้วกางทันที
 *    แม้เน็ตหลุด ซึ่งเป็นสภาพปกติของการยืนดูตัวเลขหน้าร้าน
 */
export function CategoryBreakdown({
  totals,
  entries,
  detailQs,
}: {
  totals: CategoryTotal[];
  /** รายการล่าสุดของทุกประเภทในช่วงนี้ จำกัดต่อประเภทมาแล้วจากฐานข้อมูล */
  entries: PeriodEntry[];
  /** พารามิเตอร์ช่วงเวลาของหน้าที่กำลังดู ใช้ต่อลิงก์ดูทั้งหมดของประเภทนั้น */
  detailQs: string;
}) {
  if (totals.length === 0) return null;

  const outgoing = totals.filter((t) => t.direction === "out");
  const incoming = totals.filter((t) => t.direction === "in");

  return (
    <div className="space-y-3">
      <Group
        title="จ่ายไปกับอะไร"
        rows={outgoing}
        entries={entries}
        tone="expense"
        detailQs={detailQs}
      />
      <Group
        title="รับมาจากไหน"
        rows={incoming}
        entries={entries}
        tone="income"
        detailQs={detailQs}
      />
    </div>
  );
}

function Group({
  title,
  rows,
  entries,
  tone,
  detailQs,
}: {
  title: string;
  rows: CategoryTotal[];
  entries: PeriodEntry[];
  tone: "income" | "expense";
  detailQs: string;
}) {
  /**
   * กางได้ทีละหลายอัน ไม่ใช่แบบ accordion ที่เปิดอันใหม่แล้วอันเก่าหุบ
   * เพราะคำถามจริงคือ "ค่าแรงกับค่าของรวมกันเท่าไหร่" ซึ่งต้องเห็นพร้อมกัน
   */
  const [open, setOpen] = useState<Set<string>>(new Set());

  /**
   * จัดรายการเข้ากลุ่มครั้งเดียว ไม่ใช่ filter ใหม่ในทุกแถวทุกรอบที่ render
   *
   * มุมมองปีมีสามสิบกลุ่มและรายการเป็นร้อย การ filter ต่อแถวคือการไล่
   * ทั้งกองใหม่สามสิบรอบ ทุกครั้งที่กางหรือหุบสักอัน
   */
  const grouped = useMemo(() => {
    const map = new Map<string, PeriodEntry[]>();
    for (const e of entries) {
      const k = `${e.categoryId ?? "none"}-${e.direction}`;
      const list = map.get(k);
      if (list) list.push(e);
      else map.set(k, [e]);
    }
    return map;
  }, [entries]);

  if (rows.length === 0) return null;

  // rows เรียงจากมากไปน้อยมาจาก SQL แล้ว ตัวแรกจึงเป็นตัวที่มากที่สุด
  const max = Number.parseFloat(rows[0].total) || 1;

  // สัดส่วนคิดเป็นสตางค์จำนวนเต็ม — เป็นตัวเลขไว้ดูเฉยๆ ไม่ใช่ยอดเงิน
  // แต่บวก float หลายก้อนแล้วเศษสะสมจนเปอร์เซ็นต์รวมเพี้ยนได้ เลี่ยงไว้ก่อน
  const groupSatang = rows.reduce(
    (sum, r) => sum + Math.round(Number.parseFloat(r.total) * 100),
    0,
  );

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="card-head">
        {title}
      </h2>

      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const key = `${row.categoryId ?? "none"}-${row.direction}`;
          const expanded = open.has(key);
          const width = (Number.parseFloat(row.total) / max) * 100;
          const satang = Math.round(Number.parseFloat(row.total) * 100);
          const percent = groupSatang > 0 ? Math.round((satang / groupSatang) * 100) : 0;

          const mine = grouped.get(key) ?? [];
          // ประเภทที่รายการเยอะเกินโควตา — บอกตรงๆ ว่าเห็นไม่ครบ พร้อมทางไปดูเต็ม
          const truncated = row.txnCount > mine.length;

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={expanded}
                className={cn(
                  "block w-full px-4 py-3 text-left transition active:bg-surface-2",
                  // แถวที่เปิดอยู่เข้มขึ้นนิดเดียว พอให้สายตาจับได้ว่ารายการ
                  // ข้างล่างเป็นของแถวไหน ตอนกางพร้อมกันหลายอัน
                  expanded && "bg-surface-2/60",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">{row.name}</span>
                    {!row.counts && (
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                        ไม่นับ
                      </span>
                    )}
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "num text-sm font-semibold",
                        tone === "income" ? "text-income" : "text-expense",
                      )}
                    >
                      {bahtShort(row.total)}
                    </span>
                    {/* ลูกศรหมุนลงตอนกาง — บอกสถานะโดยไม่ต้องพึ่งสี */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "size-3.5 text-ink-soft/70 transition-transform",
                        expanded && "rotate-90",
                      )}
                      aria-hidden
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </div>

                {/* แถบเป็นภาพประกอบล้วน ตัวเลขจริงอยู่ข้างบนแล้ว
                    จึงซ่อนจากโปรแกรมอ่านหน้าจอไม่ให้อ่านซ้ำ */}
                <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      tone === "income" ? "bg-income" : "bg-expense",
                      !row.counts && "opacity-40",
                    )}
                    style={{ width: `${Math.max(width, 2)}%` }}
                  />
                </div>

                <div className="mt-1 text-[11px] text-ink-soft">
                  {row.txnCount} รายการ · {percent}% ของฝั่งนี้
                </div>
              </button>

              {expanded && (
                <div
                  className={cn(
                    // เส้นซ้ายหนาสีเดียวกับแถบ บอกว่าก้อนนี้เป็นลูกของแถวข้างบน
                    // ไม่ใช่ประเภทใหม่ที่โผล่มาแทรก
                    "border-t border-line bg-surface-2 py-1 pr-4 pl-4",
                    "border-l-[3px]",
                    tone === "income" ? "border-l-income/40" : "border-l-expense/40",
                  )}
                >
                  {mine.length === 0 ? (
                    <p className="py-2 text-xs text-ink-soft">ไม่มีรายการในช่วงนี้</p>
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {mine.map((entry) => (
                        <li key={entry.id}>
                          {/* แตะรายการแล้วไปเปิดแผ่นแก้ไขของรายการนั้นที่หน้ารายวัน */}
                          <Link
                            href={`/day?d=${entry.txnDate}&t=${entry.id}`}
                            className="flex items-center gap-3 py-2.5"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs text-ink">
                                {entry.title}
                              </span>
                              <span className="block truncate text-[11px] text-ink-soft">
                                {thaiDate(entry.txnDate)}
                                {entry.accountName ? ` · ${entry.accountName}` : ""}
                                {entry.note ? ` · ${entry.note}` : ""}
                              </span>
                            </span>

                            <span
                              className={cn(
                                "num shrink-0 text-xs font-semibold",
                                tone === "income" ? "text-income" : "text-expense",
                              )}
                            >
                              {bahtShort(entry.amount)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {truncated && (
                    <Link
                      href={`${detailQs}&c=${row.categoryId ?? "none"}&cd=${row.direction}`}
                      className="flex min-h-touch items-center justify-center text-xs font-semibold text-brand"
                    >
                      ดูทั้งหมด {row.txnCount} รายการ →
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
