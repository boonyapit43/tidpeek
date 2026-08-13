import type { Metadata } from "next";
import {
  getSummary,
  lastUsedAccountId,
  listAccountsWithBalance,
  listCategories,
  listRecentTitles,
} from "@/db/queries";
import { today } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { getShopContext } from "@/lib/shop";
import { EntryForm } from "./entry-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "บันทึกรายการ" };

export default async function EntryPage() {
  const context = await getShopContext();
  // layout จัดการกรณีไม่มีร้านไว้แล้ว ตรงนี้แค่กันไม่ให้ TypeScript บ่น
  if (!context) return null;

  const shopId = context.shop.id;
  const day = today();

  // ดึงพร้อมกันทั้งหมด ไม่ไล่ await ทีละอัน ไม่งั้นเวลารอจะบวกกันเป็นทอดๆ
  // ซึ่งรู้สึกได้ชัดบนเน็ตมือถือ
  const [accounts, categories, hintsOut, hintsIn, summary, lastAccountId] = await Promise.all([
    listAccountsWithBalance(shopId),
    listCategories(shopId),
    listRecentTitles(shopId, "out"),
    listRecentTitles(shopId, "in"),
    getSummary(shopId, { day }),
    lastUsedAccountId(shopId),
  ]);

  return (
    <div className="space-y-3">
      <TodayStrip
        income={summary.income}
        expense={summary.expense}
        profit={summary.profit}
      />

      <EntryForm
        shopId={shopId}
        accounts={accounts}
        categories={categories}
        lastAccountId={lastAccountId}
        titleHints={{
          in: hintsIn.map(({ title, categoryId }) => ({ title, categoryId })),
          out: hintsOut.map(({ title, categoryId }) => ({ title, categoryId })),
        }}
      />
    </div>
  );
}

/**
 * ยอดของวันนี้แบบย่อ วางไว้เหนือฟอร์ม
 *
 * มีเพื่อให้เห็นว่าที่บันทึกไปแล้ววันนี้รวมเป็นเท่าไหร่ โดยไม่ต้องสลับแท็บ
 * ไปกลับ ซึ่งบนมือถือคือการเสียจังหวะและมักทำให้ลืมว่ากำลังจะกรอกอะไร
 */
function TodayStrip({
  income,
  expense,
  profit,
}: {
  income: string;
  expense: string;
  profit: string;
}) {
  const loss = Number.parseFloat(profit) < 0;

  return (
    <div className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface px-1 py-3 shadow-sm">
      <Cell label="รับวันนี้" value={bahtShort(income)} dot="bg-income" tone="text-income" />
      <Cell label="จ่ายวันนี้" value={bahtShort(expense)} dot="bg-expense" tone="text-expense" />
      <Cell
        label="กำไรวันนี้"
        value={bahtShort(profit)}
        dot={loss ? "bg-expense" : "bg-brand"}
        tone={loss ? "text-expense" : "text-ink"}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  dot,
  tone,
}: {
  label: string;
  value: string;
  dot: string;
  tone: string;
}) {
  return (
    <div className="px-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[11px] text-ink-soft">
        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className={`num mt-0.5 text-base font-bold ${tone}`}>{value}</div>
    </div>
  );
}
