import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSummary, listCategoryTotals } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { resolvePeriod } from "@/lib/export-period";
import { bahtShort } from "@/lib/money";
import { getSelectedShop } from "@/lib/shop";
import { cn } from "@/lib/cn";
import { NetDonut } from "./donut";
import { breakdownRows, type BreakdownRow } from "./breakdown-rows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ภาพสรุป" };

/**
 * ภาพสรุปสำหรับแคปหน้าจอส่งต่อ
 *
 * ทำไมต้องแยกหน้า ไม่ให้แคปหน้าสรุปเอา — หน้าสรุปมีแท็บสี่อัน ลูกศรเลื่อนช่วง
 * ปุ่มส่งออก และเมนูล่าง ซึ่งติดมาในภาพหมดและไม่มีความหมายกับคนรับ
 *
 * มีของอยู่สองอย่างเท่านั้น วงแหวนบอกว่าได้เท่าไหร่เหลือเท่าไหร่ กับลิสต์บอกว่า
 * เงินไปกับอะไร — เคยใส่กราฟแท่งรายวันกับวงแหวนแยกสีตามประเภทไว้ด้วย
 * แล้วเจ้าของร้านบอกให้เอาออก มันดูยาก ซึ่งถูก: ภาพที่ส่งเข้าแชทมีเวลาให้มอง
 * ไม่กี่วินาที ของที่ต้องเพ่งถึงจะเข้าใจ เท่ากับไม่ได้อยู่ในภาพ
 *
 * วางเป็นแนวนอน เพราะภาพที่ส่งเข้าแชทถูกย่อตามความกว้างของช่องแชท
 * ภาพแนวตั้งจึงถูกย่อจนตัวเลขอ่านไม่ออก ส่วนภาพแนวนอนได้ความกว้างเต็มช่อง
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

  const txnCount = categories.reduce((sum, c) => sum + c.txnCount, 0);

  /**
   * เอาเฉพาะประเภทที่นับเป็นกำไร ให้ลิสต์บวกกันแล้วเท่ายอดรายจ่ายในวง
   *
   * ยอดรายจ่ายนับเฉพาะของที่ติดธง counts อยู่แล้ว ถ้าลิสต์ใส่ทุกประเภท
   * ผลบวกของลิสต์จะไม่เท่ายอดที่วงบอก — เจอจริงตอนทดสอบ ลิสต์บวกได้
   * 40,880.75 แต่ยอดรายจ่ายคือ 30,880.75 เพราะมี "ถอนเข้ากระเป๋าตัวเอง"
   * ปนอยู่ ซึ่งเป็นตัวเลขที่ขัดกันเองบนภาพที่ตั้งใจส่งให้เจ้าของร้านอ่าน
   *
   * ของที่ถูกกันออกไม่ได้หายไปจากภาพ — รวมเป็นยอดเดียวอยู่ที่แถบล่าง
   */
  const counted = categories.filter((c) => c.counts);
  const earning = breakdownRows(counted.filter((c) => c.direction === "in"), summary.income);
  const spending = breakdownRows(counted.filter((c) => c.direction === "out"), summary.expense);

  return (
    <main className="bg-app-band flex min-h-dvh flex-col items-center justify-center px-3 py-5">
      {/**
       * การ์ดกว้างสุด 48rem — กว้างพอให้วงกับลิสต์สองฝั่งยืนเรียงกันสามช่อง
       * โดยชื่อประเภทไม่ถูกตัด และยังไม่กว้างจนอ่านเป็นภาพเดียวไม่ได้
       */}
      <section className="w-full max-w-[48rem] overflow-hidden rounded-2xl bg-surface shadow-xl">
        <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
          <h1 className="min-w-0 truncate text-base font-bold text-ink">{shop.name}</h1>
          <p className="shrink-0 text-xs text-ink-soft">{label}</p>
        </header>

        {/* วงซ้าย ลิสต์สองฝั่งขวา — เงินเข้ามาจากไหน แล้วออกไปไหน
            บอกแค่ฝั่งจ่ายอย่างเดียวเหมือนโชว์แต่รายการหัก ไม่ได้บอกว่าหักจากอะไร */}
        <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] divide-x divide-line">
          <div className="px-3 py-4 sm:px-4">
            <NetDonut income={summary.income} expense={summary.expense} profit={summary.profit} />
          </div>

          {/* จอกว้างวางสองลิสต์เคียงกัน จอแคบเรียงลงมา ไม่ยุบไปใต้วง
              เพราะทั้งหน้ามีไว้เพื่อให้ได้ภาพแนวนอน */}
          <div className="grid min-w-0 grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <Breakdown title="รับมาจากไหน" rows={earning} tone="income" empty="ช่วงนี้ยังไม่มีรายรับ" />
            <Breakdown title="ใช้ไปกับอะไร" rows={spending} tone="expense" empty="ช่วงนี้ยังไม่มีรายจ่าย" />
          </div>
        </div>

        <footer className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-1.5 text-[10px] text-ink-soft">
          <span>{txnCount} รายการ</span>

          {Number.parseFloat(summary.excluded) > 0 && (
            <span>
              ไม่นับเป็นกำไรอีก{" "}
              <span className="num font-semibold">{bahtShort(summary.excluded)}</span> บาท
            </span>
          )}

          <span>tidpeek</span>
        </footer>
      </section>

      {/**
       * ปุ่มกลับอยู่ใต้การ์ด ไม่ใช่ข้างบน — แคปหน้าจอบนมือถือได้ทั้งจอเสมอ
       * ถ้าวางไว้ข้างบนจะติดมาในภาพทุกครั้ง อยู่ข้างล่างยังพอครอบตัดทิ้งได้ง่าย
       */}
      <Link
        href="/summary"
        className={cn(
          "mt-4 inline-flex min-h-touch items-center rounded-xl bg-white/15 px-4",
          "text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25",
        )}
      >
        กลับไปหน้าสรุป
      </Link>

      {/**
       * บอกวิธีให้ได้ภาพแนวนอนเต็มที่ — โผล่เฉพาะจอแคบ
       *
       * จอมือถือแนวตั้งกว้าง 375px ใส่สามช่องเรียงกันไม่ไหว ลิสต์สองฝั่งจึง
       * เรียงลงมาแทน การ์ดเลยเกือบจัตุรัส พอหมุนจอได้ความกว้างเป็นสองเท่า
       * มันจะกางเป็นสามช่องแนวนอนเองและตัวหนังสือใหญ่ขึ้น
       *
       * อยู่นอกการ์ดและอยู่ล่างสุด จึงไม่ติดไปในภาพที่ครอบตัดมาแล้ว
       */}
      <p className="mt-2 text-center text-xs text-white/70 sm:hidden">
        หมุนจอเป็นแนวนอนก่อนแคป จะได้ภาพที่กว้างและอ่านง่ายกว่า
      </p>
    </main>
  );
}

/**
 * ลิสต์แจกแจงฝั่งหนึ่ง — ใช้ร่วมกันทั้งฝั่งรับและฝั่งจ่าย
 *
 * รูปแบบเดียวกันเป๊ะทั้งสองฝั่ง ต่างแค่สีของตัวเลข คนอ่านจึงเทียบสองฝั่ง
 * ได้ด้วยการกวาดตาลงมาตรงๆ ไม่ต้องเรียนรู้ผังใหม่
 */
function Breakdown({
  title,
  rows,
  tone,
  empty,
}: {
  title: string;
  rows: BreakdownRow[];
  tone: "income" | "expense";
  empty: string;
}) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <h2 className="text-[10px] font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline gap-1.5 text-xs sm:gap-2">
              <span className="min-w-0 flex-1 truncate text-ink">{row.name}</span>
              <span
                className={cn(
                  "num shrink-0 font-semibold",
                  tone === "income" ? "text-income" : "text-expense",
                )}
              >
                {bahtShort(row.total)}
              </span>
              {/**
                * เปอร์เซ็นต์หายไปบนจอแคบ ไม่ใช่ข้อมูลที่ขาดไม่ได้ — ยอดบอกขนาดอยู่แล้ว
                * ส่วนชื่อประเภทที่ถูกตัดเหลือ "ค่..." ไม่ได้บอกอะไรกับคนอ่านเลย
                */}
              <span className="num hidden w-8 shrink-0 text-right text-ink-soft sm:inline">
                {row.percent}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
