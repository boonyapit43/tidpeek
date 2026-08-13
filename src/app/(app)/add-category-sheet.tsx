"use client";

import { useActionState, useEffect, useId } from "react";
import { createCategory } from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import { Field, Input, StatusMessage, SubmitButton } from "@/components/form-parts";
import { Sheet } from "@/components/sheet";
import type { Direction } from "@/db/schema";

/**
 * เพิ่มประเภทใหม่ได้จากหน้าบันทึกเลย ไม่ต้องออกไปหน้าตั้งค่า
 *
 * ตั้งใจไม่มีตัวเลือก "อื่นๆ" ในรายการประเภท เพราะพอมีให้กด ทุกอย่างที่
 * ไม่ตรงหมวดจะไปกองรวมกันอยู่ตรงนั้น แล้วสรุปรายเดือนจะบอกอะไรไม่ได้เลย
 * ให้ตั้งชื่อประเภทใหม่ตอนนั้นเลยง่ายกว่าและได้ข้อมูลที่ใช้งานได้จริง
 */
export function AddCategorySheet({
  open,
  onClose,
  shopId,
  direction,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  direction: Direction;
  /** ส่ง id ของประเภทที่เพิ่งสร้างกลับไป ให้ฟอร์มเลือกไว้ให้เลย */
  onCreated: (categoryId: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="เพิ่มประเภทใหม่">
      {/* สร้างใหม่ทุกครั้งที่เปิด ชื่อที่พิมพ์ค้างไว้และข้อความของครั้งก่อนจึงไม่ตามมา
          key ผูกกับฝั่งด้วย สลับรับ/จ่ายแล้วช่องจะล้างตาม */}
      {open && (
        <AddCategoryForm
          key={direction}
          shopId={shopId}
          direction={direction}
          onCreated={onCreated}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function AddCategoryForm({
  shopId,
  direction,
  onCreated,
  onDone,
}: {
  shopId: string;
  direction: Direction;
  onCreated: (categoryId: string) => void;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(createCategory, IDLE);
  const nameId = useId();

  useEffect(() => {
    if (state.status !== "ok") return;

    // เลือกประเภทที่เพิ่งสร้างให้เลย เพราะคนกดเพิ่มตอนกำลังจะใช้มันพอดี
    if (state.id) onCreated(state.id);
    onDone();

    // ตั้งใจผูกกับ state อย่างเดียว ไม่งั้น callback ที่สร้างใหม่ทุก render
    // จะทำให้ effect นี้ทำงานซ้ำแล้วปิดแผ่นทันทีที่เปิด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="direction" value={direction} />

      <Field
        label={`ชื่อประเภท (ฝั่ง${direction === "in" ? "รับเข้า" : "จ่ายออก"})`}
        htmlFor={nameId}
      >
        <Input
          id={nameId}
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder={direction === "in" ? "เช่น ขายส่ง" : "เช่น ค่าเช่าที่"}
          enterKeyHint="done"
        />
      </Field>

      <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
        <input
          type="checkbox"
          name="counts"
          defaultChecked
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
        />
        <span className="text-sm text-ink">
          นับเป็น{direction === "in" ? "รายได้" : "รายจ่าย"}ตอนคิดกำไร
        </span>
      </label>

      <StatusMessage state={state} />

      <SubmitButton className="w-full" pendingLabel="กำลังเพิ่ม">
        เพิ่มประเภท
      </SubmitButton>
    </form>
  );
}
