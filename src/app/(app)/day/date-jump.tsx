"use client";

import { useRouter } from "next/navigation";
import { DateField } from "@/components/date-field";
import { today } from "@/lib/date";
import { cn } from "@/lib/cn";

/**
 * กระโดดไปวันที่ต้องการ
 *
 * ต้องใช้ JavaScript เพราะ input type=date ไม่มีทางส่งค่าเป็นลิงก์ได้เอง
 * ส่วนการเลื่อนวันทีละวันเป็นลิงก์จริงอยู่แล้วในหน้าหลัก ปุ่มที่ใช้บ่อยที่สุด
 * จึงยังทำงานได้แม้ JavaScript โหลดไม่ทัน
 */
export function DateJump({ date }: { date: string }) {
  const router = useRouter();
  const now = today();

  return (
    <div className="flex gap-2">
      <DateField
        value={date}
        onChange={(next) => router.push(`/day?d=${next}`)}
        label="เลือกวันที่จะดู"
        className="min-w-0 flex-1"
      />

      <button
        type="button"
        onClick={() => router.push(`/day?d=${now}`)}
        disabled={date === now}
        className={cn(
          "min-h-touch shrink-0 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium",
          "text-ink-soft transition hover:bg-surface-2",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        วันนี้
      </button>
    </div>
  );
}
