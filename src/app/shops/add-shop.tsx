"use client";

import { useActionState, useEffect, useState } from "react";
import { createShop } from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import { Field, Input, StatusMessage, SubmitButton } from "@/components/form-parts";
import { Sheet } from "@/components/sheet";

/**
 * เพิ่มร้านจากหน้าเลือกร้านได้เลย
 *
 * จำเป็นต้องมีตรงนี้เพราะตอนที่ยังไม่มีร้านสักร้าน หน้าตั้งค่าเข้าไม่ได้
 * (ทุกหน้าในแอปต้องรู้ก่อนว่าเป็นร้านไหน) ถ้าไม่มีปุ่มนี้จะติดอยู่ที่หน้าว่าง
 * แล้วต้องไปสร้างร้านใน SQL เอง
 */
export function AddShopButton({ autoFocus = false }: { autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* สูงเท่าการ์ดร้านพอดี จะได้เข้าแถวกันสวยตอนอยู่ในตารางเดียวกัน
          เส้นประบอกว่าเป็นช่องว่างที่เติมได้ ไม่ใช่ร้านที่มีอยู่แล้ว */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full min-h-[5.25rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 text-sm font-semibold text-ink-soft transition hover:border-brand/50 hover:bg-surface hover:text-brand active:scale-[0.99]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="size-5"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        เพิ่มร้าน
      </button>

      <AddShopSheet open={open} onClose={() => setOpen(false)} autoFocus={autoFocus} />
    </>
  );
}

/**
 * ฟอร์มถูกสร้างใหม่ทุกครั้งที่เปิดแผ่น ({open && ...})
 *
 * ถ้าปล่อยให้ค้างอยู่ตลอด ทั้งชื่อที่พิมพ์ไว้และข้อความผลลัพธ์ของครั้งก่อน
 * จะยังอยู่ตอนเปิดใหม่ ผลคือเปิดแผ่น "เพิ่มร้าน" แล้วเจอข้อความ "เพิ่มร้านแล้ว"
 * ทั้งที่ยังไม่ได้ทำอะไร และช่องชื่อมีชื่อร้านที่เพิ่งเพิ่มไปค้างอยู่
 * ซึ่งกดต่อไปจะได้ร้านชื่อซ้ำ
 */
function AddShopSheet({
  open,
  onClose,
  autoFocus,
}: {
  open: boolean;
  onClose: () => void;
  autoFocus: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="เพิ่มร้าน">
      {open && <AddShopForm onDone={onClose} autoFocus={autoFocus} />}
    </Sheet>
  );
}

function AddShopForm({ onDone, autoFocus }: { onDone: () => void; autoFocus: boolean }) {
  const [state, formAction] = useActionState(createShop, IDLE);

  useEffect(() => {
    if (state.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="ชื่อร้าน" htmlFor="new-shop-name">
        <Input
          id="new-shop-name"
          name="name"
          required
          maxLength={120}
          autoFocus={autoFocus}
          placeholder="เช่น ร้านหน้าบ้าน"
          enterKeyHint="done"
        />
      </Field>

      <StatusMessage state={state} />
      <SubmitButton className="w-full">เพิ่มร้าน</SubmitButton>
    </form>
  );
}
