import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSummary, listCategoryTotals } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { resolvePeriod } from "@/lib/export-period";
import { bahtShort } from "@/lib/money";
import { getSelectedShop } from "@/lib/shop";
import { cn } from "@/lib/cn";
import { breakdownRows } from "./breakdown-rows";
import { BreakdownPanel, OverviewPanel } from "./panels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ภาพสรุป" };

/**
 * ภาพสรุปสำหรับแคปหน้าจอส่งต่อ
 *
 * ทำไมต้องแยกหน้า ไม่ให้แคปหน้าสรุปเอา — หน้าสรุปมีแท็บสี่อัน ลูกศรเลื่อนช่วง
 * ปุ่มส่งออก และเมนูล่าง ซึ่งติดมาในภาพหมดและไม่มีความหมายกับคนรับ
 *
 * ผังสามการ์ดนี้เจ้าของร้านออกแบบมาเอง — ภาพรวม · รับมาจากไหน · ใช้ไปกับอะไร
 *
 * ⚠️ ห้ามใส่อะไรที่กดได้ลงในกรอบการ์ด
 *    เคยมีปุ่มส่งออกกับตัวเลือกวันที่อยู่ในหัวการ์ด ซึ่งติดไปในรูปทุกครั้ง
 *    ทั้งที่คนรับกดไม่ได้ ปุ่มทั้งหมดต้องอยู่นอกกรอบเสมอ
 *
 * ⚠️ ชื่อร้านต้องอยู่ในภาพ พอรูปไปอยู่ในแชทแล้วมันต้องอธิบายตัวเองได้
 *    คนรับไม่มีทางรู้ว่าเป็นของร้านไหนวันไหนถ้าหัวเขียนแค่ "สรุปการเงิน"
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
   * เอาเฉพาะประเภทที่นับเป็นกำไร ให้ลิสต์บวกกันแล้วเท่าแถบรวมของการ์ดนั้น
   *
   * ยอดรายรับ/รายจ่ายนับเฉพาะของที่ติดธง counts อยู่แล้ว ถ้าลิสต์ใส่ทุกประเภท
   * ผลบวกจะไม่เท่าแถบรวม — เจอจริงตอนทดสอบ ลิสต์บวกได้ 40,880.75 แต่ยอด
   * รายจ่ายคือ 30,880.75 เพราะมี "ถอนเข้ากระเป๋าตัวเอง" ปนอยู่
   *
   * ของที่ถูกกันออกไม่ได้หายไปจากภาพ — รวมเป็นยอดเดียวอยู่ที่แถบล่าง
   */
  const counted = categories.filter((c) => c.counts);
  const earning = breakdownRows(
    counted.filter((c) => c.direction === "in"),
    summary.income,
  );
  const spending = breakdownRows(
    counted.filter((c) => c.direction === "out"),
    summary.expense,
  );

  return (
    <main className="bg-app-band flex min-h-dvh flex-col items-center justify-center px-3 py-5">
      {/**
       * การ์ดกว้างสุด 62rem — กว้างพอให้สามการ์ดยืนเรียงกันโดยชื่อประเภทไม่ถูกตัด
       * และยังไม่กว้างจนสามใบห่างกันเกินกว่าจะอ่านเป็นภาพเดียว
       */}
      <section className="w-full max-w-[62rem] rounded-2xl bg-surface-2 p-3 shadow-xl sm:p-4">
        <header className="flex items-start justify-between gap-3 px-1 pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-ink">{shop.name}</h1>
            <p className="text-xs text-ink-soft">ภาพรวมรายรับ – รายจ่าย</p>
          </div>

          {/* วันที่เป็นข้อความเฉยๆ ไม่ใช่ตัวเลือก เพราะทุกอย่างในกรอบนี้ติดไปในรูป */}
          <p className="shrink-0 pt-0.5 text-sm font-medium text-ink-soft">{label}</p>
        </header>

        {/* สามการ์ดเรียงกันบนจอกว้าง จอแคบให้ภาพรวมอยู่บนแล้วสองฝั่งเรียงลงมา
            ไม่ยุบเป็นคอลัมน์เดียวทั้งหมด เพราะทั้งหน้ามีไว้ให้ได้ภาพแนวนอน */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1fr)]">
          <OverviewPanel
            income={summary.income}
            expense={summary.expense}
            profit={summary.profit}
          />

          <BreakdownPanel
            title="รับมาจากไหน"
            tone="in"
            rows={earning}
            total={summary.income}
            empty="ช่วงนี้ยังไม่มีรายรับ"
          />

          <BreakdownPanel
            title="ใช้ไปกับอะไร"
            tone="out"
            rows={spending}
            total={summary.expense}
            empty="ช่วงนี้ยังไม่มีรายจ่าย"
          />
        </div>

        <footer className="flex items-baseline justify-between gap-3 px-1 pt-3 text-[11px] text-ink-soft">
          <span className="num">{txnCount} รายการ</span>

          {Number.parseFloat(summary.excluded) > 0 && (
            <span>
              ไม่นับเป็นกำไรอีก{" "}
              <span className="num font-semibold">{bahtShort(summary.excluded)}</span> บาท
            </span>
          )}

          <span>
            ข้อมูลจาก <span className="font-semibold text-brand">tidpeek</span>
          </span>
        </footer>
      </section>

      {/**
       * ปุ่มกลับอยู่นอกการ์ด ใต้สุด — แคปหน้าจอบนมือถือได้ทั้งจอเสมอ
       * ถ้าวางไว้ในกรอบจะติดมาในภาพทุกครั้ง อยู่ข้างล่างยังพอครอบตัดทิ้งได้ง่าย
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
       * อยู่นอกการ์ดจึงไม่ติดไปในภาพที่ครอบตัดมาแล้ว
       */}
      <p className="mt-2 text-center text-xs text-white/70 sm:hidden">
        หมุนจอเป็นแนวนอนก่อนแคป จะได้ภาพที่กว้างและอ่านง่ายกว่า
      </p>
    </main>
  );
}
