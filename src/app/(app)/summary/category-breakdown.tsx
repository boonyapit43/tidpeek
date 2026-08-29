import Link from "next/link";
import type { CategoryTotal } from "@/db/queries";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * เงินหมดไปกับอะไร และมาจากไหน
 *
 * ใช้แถบยาวสั้นเทียบกันแทนกราฟวงกลม เพราะบนจอมือถือแคบๆ วงกลมที่มี
 * หลายชิ้นอ่านสัดส่วนไม่ออกและต้องมีคำอธิบายสีแยกออกไปอีกก้อน
 * แถบแนวนอนวางชื่อกับตัวเลขไว้ในบรรทัดเดียวกันได้เลย
 *
 * ความยาวแถบเทียบกับรายการที่มากที่สุดในกลุ่ม ไม่ใช่เทียบกับผลรวม
 * เพราะจุดประสงค์คือ "อะไรใหญ่กว่าอะไร" ไม่ใช่ "แต่ละอันคิดเป็นกี่เปอร์เซ็นต์"
 */
/**
 * detailQs คือพารามิเตอร์ช่วงเวลาของหน้าสรุปที่กำลังดูอยู่ (เช่น p=month&m=...)
 * แต่ละแถวประกอบเป็นลิงก์เจาะดูรายการข้างในของช่วงเดียวกันเป๊ะ
 */
export function CategoryBreakdown({
  totals,
  detailQs,
}: {
  totals: CategoryTotal[];
  detailQs: string;
}) {
  if (totals.length === 0) return null;

  const outgoing = totals.filter((t) => t.direction === "out");
  const incoming = totals.filter((t) => t.direction === "in");

  return (
    <div className="space-y-3">
      <Group title="จ่ายไปกับอะไร" rows={outgoing} tone="expense" detailQs={detailQs} />
      <Group title="รับมาจากไหน" rows={incoming} tone="income" detailQs={detailQs} />
    </div>
  );
}

function Group({
  title,
  rows,
  tone,
  detailQs,
}: {
  title: string;
  rows: CategoryTotal[];
  tone: "income" | "expense";
  detailQs: string;
}) {
  if (rows.length === 0) return null;

  // rows เรียงจากมากไปน้อยมาจาก SQL แล้ว ตัวแรกจึงเป็นตัวที่มากที่สุด
  const max = Number.parseFloat(rows[0].total) || 1;

  // สัดส่วนคิดเป็นสตางค์จำนวนเต็ม — เป็นตัวเลขไว้ดูเฉยๆ ไม่ใช่ยอดเงิน
  // แต่บวก float หลายก้อนแล้วเศษสะสมจนเปอร์เซ็นต์รวมเพี้ยนได้ เลี่ยงไว้ก่อน
  const groupSatang = rows.reduce(
    (sum, r) => sum + Math.round(Number.parseFloat(r.total) * 100),
    0,
  );

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-soft">
        {title}
      </h2>

      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const width = (Number.parseFloat(row.total) / max) * 100;
          const satang = Math.round(Number.parseFloat(row.total) * 100);
          const percent = groupSatang > 0 ? Math.round((satang / groupSatang) * 100) : 0;

          return (
            <li key={`${row.categoryId ?? "none"}-${row.direction}`}>
              {/**
                * ทั้งแถวเป็นลิงก์เจาะเข้าไปดูว่ายอดนี้ประกอบจากรายการไหนบ้าง
                * — เกิดจากคำถามจริง "ค่าแรง 1,890 คืออะไรบ้าง"
                */}
              <Link
                href={`/summary?${detailQs}&c=${row.categoryId ?? "none"}&cd=${row.direction}`}
                className="block px-4 py-3 transition active:bg-surface-2"
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
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5 text-ink-soft/60"
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
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
