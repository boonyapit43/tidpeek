"use client";

import Link, { useLinkStatus } from "next/link";
import { MAX_ROWS, PAGE_SIZE } from "@/lib/paging";
import { cn } from "@/lib/cn";

/**
 * ข้อความบนปุ่มที่เปลี่ยนเป็น "กำลังโหลด" ระหว่างรอ
 *
 * ต้องแยกเป็นคอมโพเนนต์ของตัวเอง เพราะ useLinkStatus อ่านสถานะจาก <Link>
 * ที่ครอบอยู่ เรียกในตัวเดียวกับที่ประกาศ <Link> ไม่ได้
 *
 * มีเพราะปิด prefetch ไว้ การกดจึงต้องรอเซิร์ฟเวอร์จริง ถ้าปุ่มไม่เปลี่ยนอะไร
 * เลยระหว่างนั้น คนบนเน็ตมือถือจะนึกว่ากดไม่ติดแล้วกดซ้ำ
 */
function Label({ idle }: { idle: string }) {
  const { pending } = useLinkStatus();
  return <>{pending ? "กำลังโหลด…" : idle}</>;
}

/**
 * ท้ายลิสต์ที่ยาวเกินหนึ่งชุด — บอกว่าเห็นอยู่เท่าไหร่จากทั้งหมดเท่าไหร่
 * และให้กดดูเพิ่มได้โดยไม่เสียตำแหน่งที่เลื่อนค้างไว้
 *
 * ตั้งใจไม่ใช้การโหลดอัตโนมัติตอนเลื่อนถึงท้าย เพราะลิสต์เงินต้องมี "ท้ายสุด"
 * ที่ไปถึงได้จริง การโหลดเองไปเรื่อยๆ ทำให้ไม่มีวันถึงท้าย และตำแหน่งที่เลื่อน
 * ค้างไว้จะเพี้ยนเวลากดย้อนกลับ
 */
export function LoadMore({
  shown,
  total,
  href,
  className,
}: {
  /** จำนวนแถวที่แสดงอยู่จริงตอนนี้ */
  shown: number;
  /** จำนวนแถวทั้งหมดที่มี ไม่ใช่จำนวนที่โหลดมา */
  total: number;
  href: string;
  className?: string;
}) {
  // ลิสต์ที่สั้นกว่าหนึ่งชุดไม่ต้องบอกอะไร จำนวนก็เห็นอยู่แล้วจากการเลื่อน
  if (total <= PAGE_SIZE) return null;

  const remaining = total - shown;
  const capped = remaining > 0 && shown >= MAX_ROWS;

  return (
    <div className={cn("space-y-2 pt-1 text-center", className)}>
      {remaining > 0 && !capped && (
        <Link
          href={href}
          scroll={false}
          /**
           * ปิด prefetch ไว้ตั้งใจ — ปุ่มนี้อยู่ท้ายลิสต์ มันจึงเข้ามาในจอ
           * ทุกครั้งที่คนเลื่อนผ่านไปดูรายการเก่าสุด ถ้าเปิดไว้จะยิงโหลดชุด
           * ถัดไปให้ทุกคนที่แค่เลื่อนผ่าน ซึ่งบนเน็ตมือถือคือเน็ตที่เสียฟรี
           */
          prefetch={false}
          className="inline-flex min-h-touch w-full items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition active:bg-surface-2"
        >
          <Label idle={`ดูเพิ่มอีก ${Math.min(remaining, PAGE_SIZE)} รายการ`} />
        </Link>
      )}

      {capped && (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-ink-soft">
          แสดงได้สูงสุด {MAX_ROWS.toLocaleString("th-TH")} รายการต่อหน้า
          <br />
          ยังเหลืออีก {remaining.toLocaleString("th-TH")} รายการ — ใช้ปุ่มส่งออก Excel
          เพื่อดูให้ครบ
        </p>
      )}

      {/* บอกความจริงเสมอ ทั้งตอนยังมีอีกและตอนครบแล้ว
          ที่ต้องมีตอนครบด้วย เพราะ "ไม่มีปุ่มแล้ว" ตีความได้สองอย่าง —
          ครบแล้ว หรือพัง */}
      <p className="text-xs text-ink-soft">
        {remaining > 0
          ? `แสดง ${shown.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} รายการ`
          : `ครบทั้ง ${total.toLocaleString("th-TH")} รายการแล้ว`}
      </p>
    </div>
  );
}
