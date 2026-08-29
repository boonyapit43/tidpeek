import type { Summary } from "@/db/queries";
import { bahtShort, profitPercent } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * การ์ดสรุป ใช้ร่วมกันทั้งมุมมองวัน เดือน และปี
 *
 * ตัวเลขทุกตัวรวมมาจาก SQL แล้ว ไม่มีการบวกลบเงินในคอมโพเนนต์นี้เลย
 * ที่แปลงเป็น number มีสองที่คือเทียบว่าติดลบไหม กับคิดเปอร์เซ็นต์
 * ทั้งคู่ไม่ได้เอาผลลัพธ์ไปแสดงเป็นยอดเงิน จึงไม่มีปัญหาการปัดเศษสะสม
 */
export function SummaryCard({ summary, title }: { summary: Summary; title: string }) {
  const percent = profitPercent(summary.profit, summary.income);
  const loss = Number.parseFloat(summary.profit) < 0;
  const hasExcluded = Number.parseFloat(summary.excluded) > 0;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="sr-only">{title}</h2>

      <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
        <div className="px-4 py-3">
          <div className="text-xs text-ink-soft">รายรับ</div>
          <div className="num mt-0.5 text-xl font-bold text-income">
            {bahtShort(summary.income)}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-ink-soft">รายจ่าย</div>
          <div className="num mt-0.5 text-xl font-bold text-expense">
            {bahtShort(summary.expense)}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3.5",
          loss ? "bg-expense-wash" : "bg-income-wash",
        )}
      >
        <div>
          <div className={cn("text-xs font-medium", loss ? "text-expense" : "text-income")}>
            {loss ? "ขาดทุน" : "กำไร"}
          </div>
          <div
            className={cn(
              "num mt-0.5 text-2xl font-bold tracking-tight",
              loss ? "text-expense" : "text-income",
            )}
          >
            {/* รูปแบบเดียวกับรายรับรายจ่ายข้างบน — เดิมช่องนี้โชว์ .00 อยู่ช่องเดียว */}
            {bahtShort(summary.profit)}
          </div>
        </div>

        <div className={cn("text-right", loss ? "text-expense" : "text-income")}>
          <div className="num text-2xl font-bold">
            {percent === null ? "—" : percent.toFixed(1)}
          </div>
          <div className="text-[11px]">% ของรายรับ</div>
        </div>
      </div>

      {/* บอกให้เห็นว่ามีเงินอีกก้อนที่ไม่ได้อยู่ในตัวเลขข้างบน ไม่งั้นคนจะงง
          ว่าทำไมยอดบัญชีขยับมากกว่ากำไร แต่เขียนสั้นๆ พอ */}
      {hasExcluded && (
        <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">
          ไม่นับเป็นกำไรอีก{" "}
          <span className="num font-semibold">{bahtShort(summary.excluded)}</span> บาท
        </p>
      )}
    </section>
  );
}
