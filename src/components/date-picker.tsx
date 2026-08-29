"use client";

import { useId } from "react";
import { DateField } from "./date-field";
import { Field } from "./form-parts";
import { addDays, today } from "@/lib/date";
import { cn } from "@/lib/cn";

/**
 * เลือกวันที่แบบกดปุ่มลัด
 *
 * เกือบทุกครั้งที่บันทึกคือของวันนี้หรือเมื่อวาน การให้กดปุ่มเดียวจบเร็วกว่า
 * เปิดปฏิทินของระบบแล้วเลื่อนหาวันมาก โดยเฉพาะบนมือถือ
 * ส่วนวันอื่นยังเลือกจากปฏิทินได้ตามปกติ
 *
 * ทั้งสามช่องเป็นปุ่มทรงเดียวกันเรียงกันหนึ่งแถว ตาจึงอ่านออกทันทีว่า
 * เป็นตัวเลือกชุดเดียวกันให้เลือกอย่างใดอย่างหนึ่ง — เดิมสองปุ่มแรกเป็นปุ่ม
 * ส่วนช่องที่สามเป็นกล่องกรอกหน้าตาคนละแบบ ดูเหมือนของคนละเรื่องมาวางต่อกัน
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
      <div className="flex gap-2">
        <QuickDate label="วันนี้" active={value === now} onClick={() => onChange(now)} />
        <QuickDate
          label="เมื่อวาน"
          active={value === yesterday}
          onClick={() => onChange(yesterday)}
        />

        <DateField
          id={id}
          value={value}
          onChange={onChange}
          label="เลือกวันอื่น"
          tone={isOther ? "brand" : "plain"}
          className="min-w-0 flex-1"
        />
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
        "min-h-touch shrink-0 rounded-xl border px-3.5 text-sm font-medium transition",
        active
          ? "border-brand bg-brand text-on-accent shadow-sm shadow-brand/20"
          : "border-line bg-surface text-ink-soft hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}
