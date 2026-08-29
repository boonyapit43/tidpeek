"use client";

import { useId } from "react";
import { Field } from "./form-parts";
import { addDays, thaiDate, today } from "@/lib/date";
import { cn } from "@/lib/cn";

/**
 * เลือกวันที่แบบกดปุ่มลัด
 *
 * เกือบทุกครั้งที่บันทึกคือของวันนี้หรือเมื่อวาน การให้กดปุ่มเดียวจบเร็วกว่า
 * เปิดปฏิทินของระบบแล้วเลื่อนหาวันมาก โดยเฉพาะบนมือถือ
 * ส่วนวันอื่นยังเลือกจากปฏิทินได้ตามปกติ
 *
 * อยู่ที่นี่เพราะใช้ทั้งฟอร์มบันทึกรายการและฟอร์มโอนเงิน ถ้าต่างคนต่างเขียน
 * วันหนึ่งที่แก้ที่หนึ่ง อีกที่จะเหลือของเก่าแล้วสองหน้าจะทำงานไม่เหมือนกัน
 * โดยไม่มีอะไรบอกว่าทำไม (บทเรียนเดียวกับ pickers.tsx)
 *
 * id มาจาก useId ไม่ได้เขียนตาย เพราะสองฟอร์มอาจอยู่ในหน้าเดียวกันได้
 */
export function DatePicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (date: string) => void;
  error?: string;
}) {
  const id = useId();
  const now = today();
  const yesterday = addDays(now, -1);
  const isOther = value !== now && value !== yesterday;

  return (
    <Field label="วันที่" htmlFor={id} error={error}>
      <div className="flex flex-wrap gap-2">
        <QuickDate label="วันนี้" active={value === now} onClick={() => onChange(now)} />
        <QuickDate
          label="เมื่อวาน"
          active={value === yesterday}
          onClick={() => onChange(yesterday)}
        />

        <div
          className={cn(
            "relative flex min-h-touch flex-1 items-center rounded-xl border px-3 transition",
            isOther ? "border-brand bg-brand/5 text-brand" : "border-line text-ink-soft",
          )}
        >
          <input
            id={id}
            type="date"
            value={value}
            onChange={(e) => {
              // เบราว์เซอร์ส่ง "" มาเมื่อคนกดล้างค่าในปฏิทิน
              // ถ้าปล่อยผ่าน ฟอร์มจะส่งวันว่างไปให้เซิร์ฟเวอร์ปฏิเสธ
              if (e.target.value) onChange(e.target.value);
            }}
            aria-label="เลือกวันอื่น"
            // text-base ไม่ใช่ text-sm — ต่ำกว่า 16px แล้ว iOS ซูมทั้งหน้าตอนโฟกัส
            className="w-full bg-transparent text-base focus:outline-none"
          />
          {isOther && (
            <span className="num pointer-events-none absolute right-3 text-xs font-semibold">
              {thaiDate(value)}
            </span>
          )}
        </div>
      </div>
    </Field>
  );
}

function QuickDate({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-touch rounded-xl border px-4 text-sm font-medium transition",
        active ? "border-brand bg-brand text-white" : "border-line text-ink-soft hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}
