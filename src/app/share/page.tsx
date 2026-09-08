import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSummary, listCategoryTotals } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { resolvePeriod } from "@/lib/export-period";
import { bahtShort } from "@/lib/money";
import { getSelectedShop } from "@/lib/shop";
import { breakdownRows } from "./breakdown-rows";
import { BreakdownPanel, OverviewPanel } from "./panels";
import { SaveImageButton } from "./save-image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ภาพสรุป" };

/** ใช้ร่วมกันระหว่างการ์ดกับปุ่มบันทึกภาพ ต้องตรงกันเป๊ะ ไม่งั้นปุ่มหาการ์ดไม่เจอ */
const CARD_ID = "share-card";

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
    <div className="min-h-dvh bg-surface-2">
      {/**
       * แถบหัวเหมือนทุกหน้าในแอป พร้อมปุ่มกลับที่ติดอยู่บนสุดตลอด
       *
       * ⚠️ ปุ่มกลับเคยอยู่ใต้การ์ด แล้วเจ้าของร้านบอกว่า "ไม่มีปุ่มให้ย้อนกลับ"
       *    ซึ่งถูก — วัดบนจอ 430x932 การ์ดสูง 1108px ปุ่มจึงไปอยู่ต่ำกว่า
       *    ขอบจอ 212px ต้องเลื่อนลงถึงจะเจอ และไม่มีอะไรบอกว่ามีของอยู่ข้างล่าง
       *    หน้านี้อยู่นอกกลุ่ม (app) จึงไม่มีแถบเมนูล่างให้กดกลับด้วย
       *    sticky ทำให้ปุ่มอยู่ในสายตาเสมอไม่ว่าการ์ดจะยาวแค่ไหน
       *
       * ใช้สี chrome เดียวกับแถบหัวแอป เพื่อให้ต่อเนื่องกับแถบสถานะของมือถือ
       * เหมือนหน้าอื่น — เดิมทั้งหน้าเป็นพื้นแดงเต็มผืนซึ่งเจ้าของร้านบอกว่า
       * ไม่สวย และมันก็ไม่เหมือนหน้าไหนในแอปเลยสักหน้า
       */}
      <header className="bg-app-chrome sticky top-0 z-30 pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto flex max-w-[62rem] items-center gap-1 px-2 py-2">
          <Link
            href="/summary"
            className="-ml-1 flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-white transition hover:bg-white/10 active:bg-white/15"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            กลับไปหน้าสรุป
          </Link>

          {/**
           * ปุ่มบันทึกภาพชิดขวา คู่กับปุ่มย้อนกลับ
           *
           * มีเพราะการ์ดสูงกว่าจอ แคปทีเดียวไม่พอ (วัดได้ 1108px บนจอ 932px)
           * ปุ่มนี้ได้ทั้งการ์ดในไฟล์เดียวไม่ว่าจอจะสูงแค่ไหน
           *
           * อยู่นอกกรอบการ์ดตามกฎของหน้านี้ — ของที่กดได้ห้ามอยู่ในกรอบ
           * เพราะมันจะติดไปในภาพทั้งที่คนรับกดไม่ได้
           */}
          <div className="ml-auto">
            <SaveImageButton targetId={CARD_ID} fileName={`${shop.name} ${label}`} />
          </div>
        </div>
      </header>

      {/**
       * เว้นระยะเผื่อแถบ home ของ iPhone — หน้านี้อยู่นอกกลุ่ม (app)
       * จึงไม่ได้ระยะนี้มาจาก layout เหมือนหน้าอื่น ส่วนขอบบนแถบหัวรับไปแล้ว
       */}
      <main
        className={[
          "mx-auto flex w-full max-w-[62rem] flex-col items-center px-3 pt-4",
          "pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
        ].join(" ")}
      >
      {/**
       * การ์ดกว้างสุด 62rem — กว้างพอให้สามการ์ดยืนเรียงกันโดยชื่อประเภทไม่ถูกตัด
       * และยังไม่กว้างจนสามใบห่างกันเกินกว่าจะอ่านเป็นภาพเดียว
       */}
      <section
          id={CARD_ID}
          className="w-full rounded-2xl border border-line bg-surface p-3 shadow-sm sm:p-4"
        >
        <header className="flex items-center justify-between gap-4 px-1 pb-3">
          <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-ink">
            {shop.name}
          </h1>

          {/**
            * วันที่เป็นข้อความเฉยๆ ไม่ใช่ตัวเลือก เพราะทุกอย่างในกรอบนี้ติดไปในรูป
            *
            * ตัวใหญ่และสีเข้มเท่าชื่อร้าน เพราะเป็นสองอย่างที่ทำให้ภาพอธิบาย
            * ตัวเองได้ตอนไปอยู่ในแชท — ร้านไหน ของวันไหน
            */}
          <p className="shrink-0 text-lg font-bold text-ink">{label}</p>
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
            title="รายรับ"
            tone="in"
            rows={earning}
            total={summary.income}
            empty="ช่วงนี้ยังไม่มีรายรับ"
          />

          <BreakdownPanel
            title="รายจ่าย"
            tone="out"
            rows={spending}
            total={summary.expense}
            empty="ช่วงนี้ยังไม่มีรายจ่าย"
          />
        </div>

        {/**
          * เหลือบรรทัดเดียวที่ขาดไม่ได้ — ยอดที่ไม่ถูกนับเป็นกำไร
          *
          * ตัดจำนวนรายการกับชื่อแอปออกตามที่สั่ง แต่บรรทัดนี้ต้องอยู่ ไม่งั้น
          * เงินที่เดินจริงบางก้อนจะไม่ปรากฏที่ไหนเลยบนภาพ แล้วคนอ่านจะบวก
          * ตัวเลขตามไม่ได้ว่าทำไมยอดรวมสองฝั่งไม่เท่าเงินที่เข้าออกจริง
          */}
        {Number.parseFloat(summary.excluded) > 0 && (
          <p className="px-1 pt-2.5 text-xs text-ink-soft">
            ไม่นับเป็นกำไรอีก{" "}
            <span className="num font-semibold">{bahtShort(summary.excluded)}</span> บาท
          </p>
        )}
      </section>

      {/**
       * บอกวิธีให้ได้ภาพแนวนอนเต็มที่ — โผล่เฉพาะจอแคบ
       * อยู่นอกการ์ดจึงไม่ติดไปในภาพที่ครอบตัดมาแล้ว
       */}
        <p className="mt-3 text-center text-xs text-ink-soft sm:hidden">
          หมุนจอเป็นแนวนอนก่อนแคป จะได้ภาพที่กว้างและอ่านง่ายกว่า
        </p>
      </main>
    </div>
  );
}
