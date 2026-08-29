import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { hasSession } from "@/lib/auth";
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
 * แถบบนเหลือแค่ชื่อร้านอย่างเดียว
 *
 * เดิมมีการ์ดยอดแต่ละบัญชีและยอดรวมทุกบัญชี เอาออกทั้งคู่แล้ว
 * เพราะยอดรวมจะถูกก็ต่อเมื่อตั้งยอดตั้งต้นของทุกบัญชีไว้ตรงกับความจริง
 * ถ้ายังไม่ได้ตั้ง มันจะโชว์ติดลบทั้งที่เงินจริงไม่ได้ติดลบ
 * ตัวเลขที่ผิดแย่กว่าไม่มีตัวเลข เพราะคนจะเชื่อแล้วตัดสินใจผิด
 *
 * ยอดรายบัญชียังดูได้ที่หน้าตั้งค่า ส่วนการแยกดูแบบจัดกลุ่มจะกลับมา
 * ที่หน้าสรุปกับรายวันทีหลัง
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasSession())) redirect("/login");

  const shop = await getSelectedShop();

  // ยังไม่ได้เลือกร้าน หรือร้านที่เคยเลือกถูกลบ/ปิดไปแล้ว
  // เด้งไปให้เลือกใหม่ ไม่เดาร้านให้เอง
  if (!shop) redirect("/shops");

  return (
    <div className="min-h-dvh">
      {/**
       * แถบบนติดหนึบตอนเลื่อน เพราะชื่อร้านคือบริบทที่ต้องเห็นตลอดเวลา
       * ไม่งั้นพอเลื่อนดูรายการยาวๆ แล้วลืมว่ากำลังดูร้านไหนอยู่
       *
       * เป็นแถบสีแบรนด์ ไม่ใช่พื้นขาว — บนมือถือที่ปักแอปไว้หน้าโฮม
       * แถบสถานะจะใช้สีจาก manifest ถ้าหัวแอปเป็นสีขาวจะเห็นรอยต่อ
       * สีตัดกันคาจอตลอดเวลา แบบนี้ไล่ต่อกันเป็นผืนเดียว
       */}
      <header className="bg-app-band sticky top-0 z-30 pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
          {/* ชื่อร้านเป็นลิงก์กลับไปหน้าเลือกร้าน ซึ่งเป็นที่เดียวที่สลับร้านได้
              จงใจไม่ทำเป็นดรอปดาวน์ในแถบนี้ เพราะสลับร้านพลาดระหว่างกรอก
              จะทำให้บันทึกลงผิดร้านโดยไม่ทันสังเกต */}
          <Link
            href="/shops"
            className="-ml-2 flex min-h-touch min-w-0 items-center gap-1.5 rounded-lg px-2 transition hover:bg-white/10"
          >
            <span className="truncate text-sm font-semibold text-white">{shop.name}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 shrink-0 text-white/70"
              aria-hidden
            >
              <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
            </svg>
            <span className="sr-only">เปลี่ยนร้าน</span>
          </Link>
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
