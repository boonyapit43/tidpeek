import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import { listShopsWithToday } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { today } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { AddShopButton } from "./add-shop";
import { ShopCards } from "./shop-cards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "เลือกร้าน" };

/**
 * หน้าเลือกร้าน — หน้าแรกที่เห็นหลังใส่รหัส
 *
 * แยกออกมาเป็นหน้าของตัวเองแทนที่จะเป็นเมนูดรอปดาวน์ในแถบบน เพราะ
 * "กำลังบันทึกลงร้านไหน" เป็นสิ่งที่ผิดไม่ได้เลยในแอปบัญชี การให้เลือก
 * ชัดๆ ทีละครั้งตอนเข้าใช้งาน แน่นอนกว่าการหวังว่าคนจะเหลือบไปดูชื่อร้าน
 * เล็กๆ ที่มุมจอก่อนกดบันทึก
 *
 * ไม่มีแถบเมนูล่างและไม่มียอดบัญชีในหน้านี้ เพราะทั้งสองอย่างต้องรู้ก่อน
 * ว่าเป็นร้านไหน
 */
export default async function ShopsPage() {
  if (!(await hasSession())) redirect("/login");

  const shops = await listShopsWithToday(today());

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-2xl">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink">เลือกร้าน</h1>
        </div>

        {/* ปุ่มออกจากระบบมีกรอบและไอคอน ไม่ใช่ข้อความลอยๆ เพราะบนมือถือ
            ข้อความที่ไม่มีกรอบดูไม่ออกว่ากดได้ และเล็งยากว่าขอบเขตอยู่ตรงไหน */}
        <form action={logout} className="shrink-0">
          <button
            type="submit"
            className="flex min-h-touch items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink-soft shadow-sm transition hover:bg-surface-2 active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            ออกจากระบบ
          </button>
        </form>
      </header>

      {shops.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-ink-soft">ยังไม่มีร้าน</p>
          <AddShopButton autoFocus />
        </div>
      ) : (
        <ShopCards
          shops={shops.map((s) => ({
            id: s.id,
            name: s.name,
            todayProfit: bahtShort(s.todayProfit),
            isLoss: Number.parseFloat(s.todayProfit) < 0,
            todayCount: s.todayCount,
            totalCount: s.totalCount,
          }))}
          trailing={<AddShopButton />}
        />
      )}
    </main>
  );
}
