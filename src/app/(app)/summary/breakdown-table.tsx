import Link from "next/link";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

export type BreakdownRow = {
  key: string;
  href: string;
  label: string;
  meta: string;
  income: string;
  expense: string;
  profit: string;
};

/**
 * ตารางแจกแจงยอด ใช้ทั้งรายวันของเดือน และรายเดือนของปี
 *
 * เป็น <table> จริง ไม่ใช่ div ที่จัดให้ดูเหมือนตาราง เพราะโปรแกรมอ่านหน้าจอ
 * จะประกาศหัวคอลัมน์ให้ทุกครั้งที่อ่านช่อง คนที่มองไม่เห็นจึงรู้ว่าตัวเลข
 * ที่กำลังฟังอยู่คือรายรับหรือรายจ่าย
 *
 * บนจอแคบกว่าความกว้างขั้นต่ำของตาราง จะเลื่อนแนวนอนได้ในกรอบของตัวเอง
 * ไม่ทำให้ทั้งหน้าเลื่อนตาม ซึ่งจะทำให้เมนูกับหัวข้อขยับหนีไปด้วย
 */
export function BreakdownTable({
  heading,
  unitLabel,
  emptyText,
  rows,
}: {
  heading: string;
  /** หัวคอลัมน์แรก เช่น "วันที่" หรือ "เดือน" */
  unitLabel: string;
  emptyText: string;
  rows: BreakdownRow[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="card-head">
        {heading}
      </h2>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-soft">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  {unitLabel}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  รายรับ
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  รายจ่าย
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  กำไร
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const loss = Number.parseFloat(row.profit) < 0;

                return (
                  <tr
                    key={row.key}
                    className="border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      {/* ทั้งช่องแรกเป็นลิงก์ไปดูรายละเอียดของช่วงนั้น */}
                      <Link href={row.href} className="block">
                        <span className="block font-medium text-ink">{row.label}</span>
                        <span className="block text-[11px] text-ink-soft">{row.meta}</span>
                      </Link>
                    </th>

                    <td className="num px-2 py-2.5 text-right text-income">
                      {bahtShort(row.income)}
                    </td>
                    <td className="num px-2 py-2.5 text-right text-expense">
                      {bahtShort(row.expense)}
                    </td>
                    <td
                      className={cn(
                        "num px-4 py-2.5 text-right font-bold",
                        loss ? "text-expense" : "text-ink",
                      )}
                    >
                      {bahtShort(row.profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
