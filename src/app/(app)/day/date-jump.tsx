"use client";

import { useRouter } from "next/navigation";
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
      <div className="flex min-h-touch flex-1 items-center rounded-xl border border-line bg-surface px-3">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) router.push(`/day?d=${e.target.value}`);
          }}
          aria-label="เลือกวันที่จะดู"
          // text-base ไม่ใช่ text-sm — ต่ำกว่า 16px แล้ว iOS ซูมทั้งหน้าตอนโฟกัส
          className="w-full bg-transparent text-base text-ink focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => router.push(`/day?d=${now}`)}
        disabled={date === now}
        className={cn(
          "min-h-touch rounded-xl border border-line bg-surface px-4 text-sm font-medium",
          "text-ink-soft transition hover:bg-surface-2",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        วันนี้
      </button>
    </div>
  );
}
