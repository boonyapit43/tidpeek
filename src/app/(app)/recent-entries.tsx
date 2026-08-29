import Link from "next/link";
import type { TxnRow } from "@/db/queries";
import { relativeDayLabel, thaiDate } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * รายการที่เพิ่งบันทึกไป วางไว้ใต้ฟอร์ม
 *
 * มีเพื่อตอบคำถามเดียว — "เมื่อกี้ที่กดบันทึก ลงถูกไหม"
 *
 * เดิมกดบันทึกเสร็จเห็นแค่ข้อความ "บันทึกแล้ว" ถ้าอยากตรวจว่าลงถูกจริงต้อง
 * สลับไปแท็บรายวันแล้วกลับมา ซึ่งบนมือถือคือการเสียจังหวะ และมักทำให้ลืมว่า
 * กำลังจะลงอะไรต่อ
 *
 * แตะแล้วไปหน้าแก้ไขของรายการนั้นที่หน้ารายวัน ใช้ทางเดียวกับหน้าเคลื่อนไหว
 * ของบัญชี — ไม่ทำหน้าแก้ไขซ้ำอีกอันไว้ตรงนี้ เพราะสองที่ที่แก้ของเดียวกันได้
 * แปลว่าต้องคอยดูแลให้เหมือนกันตลอดไป
 *
 * ไม่มีรายการเลยก็ไม่ต้องแสดงอะไร ร้านเปิดใหม่จะได้ไม่เจอกล่องว่างเปล่า
 * ที่ไม่ได้บอกอะไร
 */
export function RecentEntries({ items }: { items: TxnRow[] }) {
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="card-head">
        เพิ่งบันทึกไป
      </h2>

      <ul className="divide-y divide-line">
        {items.map((txn) => {
          const income = txn.direction === "in";

          /**
           * บอกวันเฉพาะตอนที่ไม่ใช่วันนี้
           *
           * เพราะรายการส่วนใหญ่เป็นของวันนี้ การเขียนวันซ้ำทุกบรรทัดมีแต่
           * รกเปล่าๆ แต่ถ้าเพิ่งลงย้อนหลังให้เมื่อวาน ต้องเห็นชัดว่าลงไปวันไหน
           * ไม่งั้นจะนึกว่าลงผิดวัน
           */
          const label = relativeDayLabel(txn.txnDate);
          const dayNote = label === "วันนี้" ? null : (label ?? thaiDate(txn.txnDate));

          return (
            <li key={txn.id}>
              <Link
                href={`/day?d=${txn.txnDate}&t=${txn.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition active:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-7 w-1 shrink-0 rounded-full",
                    income ? "bg-income" : "bg-expense",
                  )}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{txn.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">
                    {[dayNote, txn.categoryName, txn.accountName].filter(Boolean).join(" · ") ||
                      "ไม่ระบุประเภท"}
                  </span>
                </span>

                {/* เครื่องหมายบวกลบกำกับเสมอ ไม่ได้ใช้สีบอกทิศทางเงินอย่างเดียว */}
                <span
                  className={cn(
                    "num shrink-0 text-sm font-bold",
                    income ? "text-income" : "text-expense",
                  )}
                >
                  {income ? "+" : "−"}
                  {bahtShort(txn.amount)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
