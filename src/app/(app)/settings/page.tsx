import { PageTitle } from "@/components/page-title";
import type { Metadata } from "next";
import { hasDefaultCategories, listAllAccountsForShop, listAllCategories } from "@/db/queries";
import { currentMonth, monthRange, today } from "@/lib/date";
import { getShopContext } from "@/lib/shop";
import { AccountManager } from "./account-manager";
import { ExportRange } from "./export-range";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ตั้งค่า" };

/**
 * หน้าตั้งค่า v1 มีแค่สามอย่าง บัญชี ประเภท และส่งออกข้อมูล
 *
 * ตั้งใจไม่ใส่อะไรมากกว่านี้ ของที่เคยอยู่ตรงนี้แล้วย้ายออกไป
 *   • จัดการร้าน   ย้ายไปหน้าเลือกร้าน (/shops) ซึ่งเป็นที่ที่คนไปอยู่แล้ว
 *   • ออกจากระบบ  อยู่ที่หน้าเลือกร้านเช่นกัน ไม่ต้องมีสองที่
 *
 * หน้าตั้งค่าที่ยาวเป็นหางว่าวทำให้หาของที่ต้องใช้จริงไม่เจอ
 * โดยเฉพาะบนมือถือที่ต้องเลื่อนทีละหน้าจอ
 */
export default async function SettingsPage() {
  const context = await getShopContext();
  if (!context) return null;

  const { shop } = context;

  // ดึงรวมของที่ปิดใช้งานไว้ด้วย เพื่อให้เปิดกลับมาได้จากหน้านี้
  const [accounts, categories, hasDefaults] = await Promise.all([
    listAllAccountsForShop(shop.id),
    listAllCategories(shop.id),
    hasDefaultCategories(),
  ]);

  return (
    <div className="space-y-3">
      <PageTitle>ตั้งค่า</PageTitle>

      <AccountManager shopId={shop.id} accounts={accounts} />
      <CategoryManager
        shopId={shop.id}
        categories={categories}
        // ร้านที่สร้างก่อนที่ระบบจะใส่ชุดตั้งต้นให้อัตโนมัติ จะยังไม่มีของกลาง
        // เลยสักตัว ปุ่มเติมชุดตั้งต้นจึงโผล่เฉพาะกรณีนั้น กดแล้วหายไปเอง
        canAddDefaults={!hasDefaults}
      />
      <ExportSection shopName={shop.name} />
    </div>
  );
}

/**
 * ส่งออกข้อมูล
 *
 * ที่นี่คือทางออกของ "ช่วงกำหนดเอง" เท่านั้น ช่วงที่ใช้บ่อย (วัน สัปดาห์
 * เดือน ปี) มีปุ่มอยู่ท้ายหน้าสรุปของช่วงนั้นแล้ว ไม่ต้องเดินมาเลือกวันซ้ำ
 *
 * ฟอร์มเป็น GET ธรรมดา ไม่มี JavaScript เลย กดแล้วเบราว์เซอร์เปิดลิงก์
 * /api/export?from=..&to=.. ซึ่งตอบกลับมาเป็นไฟล์ วิธีนี้ทำงานได้แม้
 * สคริปต์โหลดไม่ขึ้น และไม่โดนตัวบล็อก popup บนมือถือ
 */
function ExportSection({ shopName }: { shopName: string }) {
  // ตั้งต้นเป็น "ต้นเดือนถึงวันนี้" ซึ่งเป็นช่วงที่คนขอบ่อยที่สุด
  // กดส่งเลยโดยไม่แตะอะไรก็ได้ของที่ใช้ได้จริง
  const [monthStart] = monthRange(currentMonth());

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="card-head">
        ส่งออกข้อมูล
      </h2>

      <ExportRange shopName={shopName} defaultFrom={monthStart} defaultTo={today()} />

      <ExportLink href="/api/export?f=json" label="สำรองทั้งฐานข้อมูล (JSON)" />
    </section>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex min-h-touch items-center justify-between gap-3 px-4 py-3 text-sm text-ink transition active:bg-surface-2"
    >
      {label}
      <span className="text-ink-soft">
        <DownloadIcon />
      </span>
    </a>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
