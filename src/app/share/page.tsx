import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSummary, listCategoryTotals } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { resolvePeriod } from "@/lib/export-period";
import { bahtShort, profitPercent } from "@/lib/money";
import { getSelectedShop } from "@/lib/shop";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ภาพสรุป" };

/** จำนวนประเภทต่อฝั่งที่ใส่ในภาพ — เกินนี้รวบเป็นบรรทัดเดียว */
const TOP_CATEGORIES = 5;

/**
 * ภาพสรุปสำหรับแคปหน้าจอส่งต่อ
 *
 * ทำไมต้องแยกหน้า ไม่ให้แคปหน้าสรุปเอา — หน้าสรุปมีแท็บสี่อัน ลูกศรเลื่อนช่วง
 * ปุ่มส่งออก และเมนูล่าง ซึ่งติดมาในภาพหมดและไม่มีความหมายกับคนรับ
 * แถมยาวเกินหนึ่งหน้าจอ ต้องแคปสามรูปถึงจะครบ
 *
 * หน้านี้จึงตัดทุกอย่างที่กดได้ออก เหลือเฉพาะตัวเลขที่คนรับต้องอ่าน
 * และย่อให้จบในหน้าจอเดียวเพื่อให้แคปรูปเดียวจบ
 *
 * ⚠️ ชื่อร้านกับช่วงเวลาต้องอยู่ในภาพเสมอ เพราะพอรูปไปอยู่ในแชทแล้ว
 *    มันต้องอธิบายตัวเองได้ คนรับไม่มีทางรู้ว่าเป็นของร้านไหนวันไหน
 *
 * อยู่นอกกลุ่ม (app) เพื่อไม่ให้ได้แถบหัวกับเมนูล่างติดมาด้วย
 * จึงต้องตรวจสิทธิ์เองเหมือนหน้าเลือกร้าน
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await hasSession())) redirect("/login");

  const shop = await getSelectedShop();
  if (!shop) redirect("/shops");

  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
  );

  // ใช้ตัวแปลช่วงเวลาตัวเดียวกับไฟล์ส่งออก ลิงก์จึงหน้าตาเหมือนกันทั้งแอป
  // และค่าที่แก้มือมาเสียก็ตกกลับเป็นเดือนปัจจุบันเหมือนกัน
  const { period, label } = resolvePeriod(query);

  const [summary, categories] = await Promise.all([
    getSummary(shop.id, period),
    listCategoryTotals(shop.id, period),
  ]);

  const loss = Number.parseFloat(summary.profit) < 0;
  const percent = profitPercent(summary.profit, summary.income);
  const txnCount = categories.reduce((sum, c) => sum + c.txnCount, 0);

  return (
    <main className="bg-app-band flex min-h-dvh flex-col items-center px-4 py-6">
      {/**
       * การ์ดกว้างสุด 26rem — พอดีจอมือถือและยังอ่านออกตอนย่อในแชท
       * ถ้าปล่อยเต็มความกว้างบนจอคอม ตัวเลขจะกระจายห่างกันจนอ่านเป็นชุดไม่ได้
       */}
      <section className="w-full max-w-[26rem] overflow-hidden rounded-3xl bg-surface shadow-xl">
        <header className="border-b border-line px-5 pt-5 pb-4">
          <h1 className="text-lg font-bold text-ink">{shop.name}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{label}</p>
        </header>

        <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
          <Cell label="รายรับ" value={bahtShort(summary.income)} tone="text-income" />
          <Cell label="รายจ่าย" value={bahtShort(summary.expense)} tone="text-expense" />
        </div>

        <div
          className={cn(
            "flex items-end justify-between gap-3 border-b border-line px-5 py-4",
            loss ? "bg-expense-wash" : "bg-income-wash",
          )}
        >
          <div>
            <div className={cn("text-xs font-medium", loss ? "text-expense" : "text-income")}>
              {loss ? "ขาดทุน" : "กำไร"}
            </div>
            <div
              className={cn(
                "num mt-0.5 text-3xl font-bold tracking-tight",
                loss ? "text-expense" : "text-income",
              )}
            >
              {/* รูปแบบเดียวกับรายรับรายจ่ายข้างบน ไม่ให้มีช่องเดียวที่โชว์ .00 */}
              {bahtShort(summary.profit)}
            </div>
          </div>

          {percent !== null && (
            <div className={cn("text-right", loss ? "text-expense" : "text-income")}>
              <div className="num text-xl font-bold">{percent.toFixed(1)}</div>
              <div className="text-[11px]">% ของรายรับ</div>
            </div>
          )}
        </div>

        <Breakdown
          title="จ่ายไปกับอะไร"
          rows={categories.filter((c) => c.direction === "out")}
          tone="text-expense"
        />
        <Breakdown
          title="รับมาจากไหน"
          rows={categories.filter((c) => c.direction === "in")}
          tone="text-income"
        />

        {Number.parseFloat(summary.excluded) > 0 && (
          <p className="border-t border-line px-5 py-2.5 text-xs text-ink-soft">
            ไม่นับเป็นกำไรอีก{" "}
            <span className="num font-semibold">{bahtShort(summary.excluded)}</span> บาท
            (เช่นเติมทุน หรือถอนใช้ส่วนตัว)
          </p>
        )}

        <footer className="border-t border-line px-5 py-2.5 text-[11px] text-ink-soft">
          {txnCount} รายการ · tidpeek
        </footer>
      </section>

      {/**
       * ปุ่มกลับอยู่ใต้การ์ด ไม่ใช่ข้างบน — แคปหน้าจอบนมือถือได้ทั้งจอเสมอ
       * ถ้าวางไว้ข้างบนจะติดมาในภาพทุกครั้ง อยู่ข้างล่างยังพอครอบตัดทิ้งได้ง่าย
       */}
      <Link
        href="/summary"
        className="mt-5 inline-flex min-h-touch items-center rounded-xl bg-white/15 px-4 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
      >
        กลับไปหน้าสรุป
      </Link>
    </main>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-5 py-3.5">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={cn("num mt-0.5 text-xl font-bold", tone)}>{value}</div>
    </div>
  );
}

/**
 * แจกแจงประเภท เอาแค่ห้าอันดับแรก ที่เหลือรวบเป็นบรรทัดเดียว
 *
 * เพราะเป้าหมายคือให้จบในหน้าจอเดียว ร้านที่มีสิบห้าประเภทจะได้ภาพยาวเกิน
 * จนต้องแคปสองรูป ซึ่งเสียจุดประสงค์ของหน้านี้ไปเลย
 */
function Breakdown({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { categoryId: string | null; name: string; total: string; counts: boolean }[];
  tone: string;
}) {
  if (rows.length === 0) return null;

  const shown = rows.slice(0, TOP_CATEGORIES);
  const rest = rows.slice(TOP_CATEGORIES);
  const restTotal = rest.reduce((sum, r) => sum + Number.parseFloat(r.total), 0);

  return (
    <div className="border-t border-line px-5 py-3">
      <h2 className="text-xs font-semibold text-ink-soft">{title}</h2>

      <ul className="mt-1.5 space-y-1">
        {shown.map((row) => (
          <li
            key={`${row.categoryId ?? "none"}-${title}`}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate text-ink">
              {row.name}
              {!row.counts && <span className="text-xs text-ink-soft"> (ไม่นับ)</span>}
            </span>
            <span className={cn("num shrink-0 font-semibold", tone)}>
              {bahtShort(row.total)}
            </span>
          </li>
        ))}

        {rest.length > 0 && (
          <li className="flex items-baseline justify-between gap-3 text-sm text-ink-soft">
            <span>อีก {rest.length} ประเภท</span>
            <span className="num shrink-0">{bahtShort(restTotal)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
