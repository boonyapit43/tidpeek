import type { Metadata } from "next";
import Link from "next/link";
import { listAccountMovements, listAccountsWithBalance } from "@/db/queries";
import { getShopContext } from "@/lib/shop";
import { AccountBoard } from "./account-board";
import { AccountDetail } from "./account-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "บัญชี" };

/**
 * เงินอยู่ที่ไหน เท่าไหร่
 *
 * คนละคำถามกับหน้าสรุป — หน้าสรุปตอบว่า "ร้านทำมาหากินได้เท่าไหร่"
 * ส่วนหน้านี้ตอบว่า "ตอนนี้มีเงินอยู่ในกระเป๋าไหนบ้าง" ซึ่งเป็นคำถามที่ถาม
 * ตอนปิดร้านนับเงิน และตอนจะจ่ายค่าของว่าบัญชีไหนพอ
 *
 * ?a=<id> เปลี่ยนเป็นมุมมองรายบัญชี ใช้ query string ไม่ใช่หน้าใหม่
 * เพราะปุ่มย้อนกลับของเบราว์เซอร์จะพากลับมาที่รายการบัญชีได้เอง
 * และแชร์ลิงก์ของบัญชีเดียวได้
 */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>;
}) {
  const context = await getShopContext();
  if (!context) return null;

  const shopId = context.shop.id;
  const selectedId = (await searchParams).a;

  /**
   * ยิงสอง query พร้อมกัน ไม่ไล่ await ทีละอัน
   *
   * ฐานข้อมูลอยู่ที่มุมไบ วัดแล้วไปกลับครั้งละ ~100ms ส่วนตัว query เองใช้
   * เวลาแค่ 0.09ms แปลว่าเวลาทั้งหมดคือระยะทาง ไม่ใช่การคำนวณ
   * ถ้าไล่ทีละอันหน้านี้จะช้าเป็นสองเท่าโดยไม่ได้อะไรเพิ่ม
   *
   * id ที่มั่วมาหรือเป็นของร้านอื่น listAccountMovements ตรวจเองแล้วคืนลิสต์ว่าง
   * ส่วนการทิ้งผลลัพธ์เมื่อ selected เป็น null ข้างล่างเป็นด่านซ้ำอีกชั้น
   */
  const [accounts, movements] = await Promise.all([
    listAccountsWithBalance(shopId),
    selectedId ? listAccountMovements(shopId, selectedId) : Promise.resolve([]),
  ]);

  // id จาก URL แก้เองได้ ต้องเทียบกับบัญชีที่ร้านนี้เห็นจริงเสมอ
  // ไม่เจอก็ตกกลับมาหน้ารายการ ดีกว่าโชว์หน้า error
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  if (selected) {
    return (
      <div className="space-y-3">
        <BackLink />
        <AccountDetail
          shopId={shopId}
          account={selected}
          accounts={accounts}
          movements={movements}
        />
      </div>
    );
  }

  return <AccountBoard shopId={shopId} accounts={accounts} />;
}

function BackLink() {
  return (
    <Link
      href="/accounts"
      className="inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      ทุกบัญชี
    </Link>
  );
}
