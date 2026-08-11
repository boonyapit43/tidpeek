import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getTotalBalance } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { bahtShort } from "@/lib/money";
import { getSelectedShop } from "@/lib/shop";

// ทุกหน้าในกลุ่มนี้อ่าน cookie และข้อมูลสด จึงต้อง render ตอนมีคำขอเสมอ
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * เปลือกของแอป — แถบบน เมนู และเนื้อหา
 *
 * ตรวจสองอย่างก่อนปล่อยผ่าน ล็อกอินแล้วหรือยัง และเลือกร้านหรือยัง
 * ทำที่นี่ที่เดียวแทนการใช้ middleware.ts เพราะ middleware รันบน Edge
 * runtime ซึ่งโฮสต์ที่ใช้ Phusion Passenger รันไม่ได้
 *
 * การ์ดนี้กันคนเข้าหน้าเว็บ ส่วนการเขียนข้อมูลมีการ์ดของตัวเองอีกชั้น
 * อยู่ในทุก server action เพราะ action ยิงตรงได้โดยไม่ผ่าน layout นี้
 *
 * เดิมมีแถบการ์ดยอดแต่ละบัญชีอยู่ตรงนี้ เอาออกไปแล้วเพื่อให้ v1 เบาลง
 * เหลือแค่ยอดรวมบนแถบบน ส่วนการแยกดูรายบัญชีจะกลับมาในรูปแบบการจัดกลุ่ม
 * ที่หน้าสรุปกับรายวันแทน
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasSession())) redirect("/login");

  const shop = await getSelectedShop();

  // ยังไม่ได้เลือกร้าน หรือร้านที่เคยเลือกถูกลบ/ปิดไปแล้ว
  // เด้งไปให้เลือกใหม่ ไม่เดาร้านให้เอง
  if (!shop) redirect("/shops");

  const total = await getTotalBalance(shop.id);

  return (
    <div className="min-h-dvh">
      {/**
       * แถบบนติดหนึบตอนเลื่อน เพราะชื่อร้านกับยอดรวมคือบริบทที่ต้องเห็น
       * ตลอดเวลา ไม่งั้นพอเลื่อนดูรายการยาวๆ แล้วลืมว่ากำลังดูร้านไหนอยู่
       */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          {/* ชื่อร้านเป็นลิงก์กลับไปหน้าเลือกร้าน ซึ่งเป็นที่เดียวที่สลับร้านได้
              จงใจไม่ทำเป็นดรอปดาวน์ในแถบนี้ เพราะสลับร้านพลาดระหว่างกรอก
              จะทำให้บันทึกลงผิดร้านโดยไม่ทันสังเกต */}
          <Link
            href="/shops"
            className="-ml-2 flex min-h-touch min-w-0 items-center gap-1 rounded-lg px-2 transition hover:bg-surface-2"
          >
            <span className="truncate text-sm font-semibold text-ink">{shop.name}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 shrink-0 text-ink-soft"
              aria-hidden
            >
              <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
            </svg>
            <span className="sr-only">เปลี่ยนร้าน</span>
          </Link>

          <div className="text-right">
            <div className="text-[11px] leading-none text-ink-soft">เงินรวมทุกบัญชี</div>
            <div className="num text-base leading-tight font-bold text-ink">
              {bahtShort(total)}
              <span className="ml-1 text-xs font-normal text-ink-soft">บาท</span>
            </div>
          </div>
        </div>
      </header>

      {/**
       * เว้นที่ด้านล่างให้แถบเมนูที่ลอยทับอยู่บนมือถือ ไม่งั้นเนื้อหาบรรทัด
       * สุดท้ายจะถูกบังจนกดไม่ได้ ตัวเลข = ความสูงเมนู + safe area ของ iPhone
       */}
      <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
        {/**
         * เมนูอยู่ก่อนเนื้อหาใน DOM โดยตั้งใจ
         *
         * บนมือถือมันเป็น fixed ตรงขอบล่าง ตำแหน่งใน DOM จึงไม่มีผลกับที่ที่เห็น
         * แต่บนจอใหญ่ที่มันกลับมาไหลตามเนื้อหา ต้องอยู่ตรงนี้ถึงจะโผล่ใต้แถบบน
         * ถ้าวางไว้ท้ายไฟล์ เมนูจะไปโผล่ใต้เนื้อหาที่ยาวเป็นหางว่าว
         */}
        <div className="pt-3 md:pt-4">
          <Nav />
        </div>

        <main className="pt-3">{children}</main>
      </div>
    </div>
  );
}
