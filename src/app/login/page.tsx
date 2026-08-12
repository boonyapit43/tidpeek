import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

/**
 * หน้าล็อกอินใช้ชื่อแอปล้วน ไม่เติมชื่อหน้าไว้ข้างหน้า
 * เพราะเป็นหน้าแรกสุดที่คนเปิดค้างไว้ ชื่อสั้นอ่านออกง่ายกว่า
 *
 * ต้องใช้ absolute ไม่ใช่ string เฉยๆ ไม่งั้น template ของ root layout
 * ("%s · tidpeek") จะครอบทับจนกลายเป็น "tidpeek · tidpeek"
 */
export const metadata: Metadata = { title: { absolute: "tidpeek" } };

// หน้านี้อ่าน cookie จึงต้อง render ตอนมีคำขอเข้ามาเสมอ ห้าม cache
export const dynamic = "force-dynamic";

// บังคับ Node runtime ทุกหน้าและทุก route เพราะ Edge runtime รันบนโฮสต์
// ที่ใช้ Phusion Passenger (DirectAdmin) ไม่ได้
export const runtime = "nodejs";

/**
 * หน้าล็อกอิน ออกแบบให้พอดีหนึ่งจอเสมอ ไม่ต้องเลื่อน
 *
 * ใช้ h-dvh (ไม่ใช่ min-h) คู่กับ overflow-hidden เพื่อตรึงความสูงไว้ที่จอพอดี
 * แล้วให้แป้นตัวเลขยืดหดเอง ปุ่มจึงเต็มพื้นที่ที่เหลือทั้งบนจอเล็กอย่าง
 * iPhone SE และจอใหญ่อย่าง Pro Max โดยไม่มีที่ว่างเหลือทิ้ง
 *
 * dvh สำคัญตรงที่มันวัดความสูงจริงหลังหักแถบที่อยู่ของเบราว์เซอร์มือถือแล้ว
 * ต่างจาก vh ที่นับรวมแถบซึ่งทำให้เนื้อหาล้นออกไปใต้จอ
 */
export default async function LoginPage() {
  if (await hasSession()) redirect("/");

  return (
    <main
      className={[
        "relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden px-6",
        "pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]",
      ].join(" ")}
    >
      {/* แสงสีแบรนด์จางๆ ที่ขอบบน ให้หน้าแรกไม่ใช่พื้นเทาโล่งๆ
          เป็นแค่ฉากหลัง จึงกันคลิกและซ่อนจากโปรแกรมอ่านหน้าจอ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 50% 0%, color-mix(in oklab, var(--brand) 14%, transparent), transparent 70%)",
        }}
      />
      {/**
       * จำกัดความสูงไว้ที่ 620px
       *
       * บนมือถือความสูงจริงน้อยกว่านี้อยู่แล้ว กล่องจึงยืดเต็มจอตามปกติ
       * แต่บน iPad ที่สูงถึง 1024–1366px ถ้าไม่จำกัด แป้นตัวเลขจะยืดจนปุ่มละ
       * เกือบสองนิ้ว ซึ่งดูเหมือนของเสียมากกว่าปุ่มที่กดง่าย
       */}
      <div className="flex h-full max-h-[620px] w-full max-w-sm flex-col">
        <header className="flex shrink-0 flex-col items-center pt-2 pb-5">
          <Mark />
          <h1 className="mt-3 text-xl leading-tight font-bold tracking-tight text-ink">
            tidpeek
          </h1>
        </header>

        <LoginForm />
      </div>
    </main>
  );
}

/**
 * สัญลักษณ์ประจำแอป — ลายเดียวกับไอคอนใน src/app/icon.svg
 *
 * วาดซ้ำเป็น SVG ในโค้ดแทนการ <img src="/icon.svg"> เพราะขนาดนี้ไฟล์เล็กกว่า
 * คำขอ HTTP หนึ่งครั้ง และไม่มีจังหวะที่ช่องว่างเปล่ารอภาพโหลดบนเน็ตมือถือ
 *
 * ถ้าแก้ลายที่ icon.svg อย่าลืมแก้ที่นี่ด้วยให้ตรงกัน
 */
function Mark() {
  return (
    <div className="bg-brand-gradient flex size-12 items-center justify-center rounded-2xl shadow-lg shadow-brand/30">
      <svg viewBox="0 0 512 512" className="size-7" aria-hidden>
        <path
          fill="white"
          d="M104 352
             C 112 254 178 174 288 136
             C 246 192 224 246 218 292
             C 268 222 326 182 400 162
             C 356 222 328 274 314 318
             C 352 284 384 268 418 262
             C 372 336 268 374 138 374
             C 112 374 102 368 104 352 Z"
        />
      </svg>
    </div>
  );
}
