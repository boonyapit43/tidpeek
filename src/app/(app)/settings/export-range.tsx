"use client";

import { useState } from "react";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/form-parts";

/**
 * เลือกช่วงวันเองแล้วส่งออกเป็น Excel
 *
 * เป็นฟอร์ม GET ธรรมดา ไม่มี server action — กดแล้วเบราว์เซอร์เปิดลิงก์
 * /api/export?from=..&to=.. ซึ่งตอบกลับมาเป็นไฟล์ วิธีนี้ทำงานได้แม้สคริปต์
 * โหลดไม่ขึ้น และไม่โดนตัวบล็อก popup บนมือถือ
 *
 * ที่ต้องเป็น client component เพราะช่องวันที่โชว์วันเป็นภาษาไทย ซึ่งต้องมี
 * state ไว้อัปเดตป้ายตอนคนเปลี่ยนวัน ตัวฟอร์มยังส่งแบบธรรมดาเหมือนเดิม
 */
export function ExportRange({
  shopName,
  defaultFrom,
  defaultTo,
}: {
  shopName: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  // กรอกสลับกันมาแล้วเซิร์ฟเวอร์จะตกกลับไปเป็นเดือนปัจจุบันเงียบๆ
  // บอกตรงนี้เลยดีกว่า จะได้ไม่ได้ไฟล์ที่ไม่ตรงกับที่กรอกโดยไม่รู้ตัว
  const backwards = from > to;

  return (
    <form method="get" action="/api/export" className="space-y-3 border-b border-line p-4">
      <p className="text-xs text-ink-soft">
        เลือกช่วงวันเอง ได้ไฟล์ Excel ของ{shopName} แยกเป็นสี่ชีต สรุป · รายการ ·
        โอนระหว่างบัญชี · ยอดบัญชี
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">ตั้งแต่วันที่</span>
          <DateField name="from" value={from} onChange={setFrom} label="ตั้งแต่วันที่" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">ถึงวันที่</span>
          <DateField name="to" value={to} onChange={setTo} label="ถึงวันที่" />
        </label>
      </div>

      {backwards && (
        <p role="alert" className="text-xs font-medium text-expense">
          วันเริ่มต้องมาก่อนวันจบ
        </p>
      )}

      <Button type="submit" className="w-full text-sm" disabled={backwards}>
        <DownloadIcon />
        ส่งออกช่วงนี้เป็น Excel
      </Button>
    </form>
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
