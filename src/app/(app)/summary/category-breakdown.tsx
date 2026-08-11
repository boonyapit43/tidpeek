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
export function CategoryBreakdown({ totals }: { totals: CategoryTotal[] }) {
  if (totals.length === 0) return null;

  const outgoing = totals.filter((t) => t.direction === "out");
  const incoming = totals.filter((t) => t.direction === "in");

  return (
    <div className="space-y-3">
      <Group title="จ่ายไปกับอะไร" rows={outgoing} tone="expense" />
      <Group title="รับมาจากไหน" rows={incoming} tone="income" />
    </div>
  );
}

function Group({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CategoryTotal[];
  tone: "income" | "expense";
}) {
  if (rows.length === 0) return null;

  // rows เรียงจากมากไปน้อยมาจาก SQL แล้ว ตัวแรกจึงเป็นตัวที่มากที่สุด
  const max = Number.parseFloat(rows[0].total) || 1;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-soft">
        {title}
      </h2>

      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const width = (Number.parseFloat(row.total) / max) * 100;

          return (
            <li key={`${row.categoryId ?? "none"}-${row.direction}`} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm text-ink">{row.name}</span>
                  {!row.counts && (
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                      ไม่นับ
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "num shrink-0 text-sm font-semibold",
                    tone === "income" ? "text-income" : "text-expense",
                  )}
                >
                  {bahtShort(row.total)}
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
