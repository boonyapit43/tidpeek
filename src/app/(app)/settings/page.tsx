import type { Metadata } from "next";
import { listAllAccountsForShop, listAllCategories } from "@/db/queries";
import { getShopContext } from "@/lib/shop";
import { AccountManager } from "./account-manager";
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
  const [accounts, categories] = await Promise.all([
    listAllAccountsForShop(shop.id),
    listAllCategories(shop.id),
  ]);

  return (
    <div className="space-y-3">
      <AccountManager shopId={shop.id} accounts={accounts} />
      <CategoryManager shopId={shop.id} categories={categories} />
      <ExportSection />
    </div>
  );
}

/**
 * ส่งออกข้อมูล
 *
 * เป็นลิงก์ธรรมดาไม่ใช่ปุ่มที่เรียก JavaScript เพราะเบราว์เซอร์จัดการ
 * การดาวน์โหลดเองได้ดีกว่า และทำงานได้แม้บนมือถือที่บล็อก popup
 *
 * มีอยู่ตั้งแต่วันแรกโดยตั้งใจ ข้อมูลบัญชีของร้านต้องเอาออกไปได้เสมอ
 * ไม่ว่าจะย้ายโฮสต์ ย้ายฐานข้อมูล หรือเลิกใช้แอปนี้ไปเลย
 */
function ExportSection() {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-soft">
        ส่งออกข้อมูล
      </h2>

      <div className="divide-y divide-line">
        <ExportLink href="/api/export" label="ทั้งฐานข้อมูล (JSON)" />
        <ExportLink href="/api/export?f=csv" label="รายการเคลื่อนไหว (CSV)" />
      </div>
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
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 shrink-0 text-ink-soft"
        aria-hidden
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    </a>
  );
}
