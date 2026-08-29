"use client";

import { useActionState, useEffect, useId } from "react";
import { createCategory } from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import {
  Field,
  Input,
  StatusMessage,
  SubmitButton,
  useKeptValue,
} from "@/components/form-parts";
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
  const name = useKeptValue();

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
          {...name}
          id={nameId}
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder={direction === "in" ? "เช่น ขายส่ง" : "เช่น ค่าเช่าที่"}
          enterKeyHint="done"
        />
      </Field>

      {/**
        * ประเภทที่เพิ่มจากตรงนี้นับเป็นกำไรเสมอ
        *
        * เดิมมีช่องติ๊กให้เลือกตรงนี้ด้วย แต่จังหวะที่คนกดเพิ่มประเภทคือกลางคัน
        * ของการลงรายการ กำลังจะพิมพ์ยอดอยู่แล้วเจอว่าไม่มีประเภทที่ต้องการ
        * ตอนนั้นไม่มีใครหยุดคิดเรื่องนิยามของกำไร ติ๊กอะไรก็ติ๊กไปให้จบ
        *
        * ของที่ "ไม่นับเป็นกำไร" มีอยู่ไม่กี่อย่างและเป็นของตั้งครั้งเดียว —
        * ถอนเข้ากระเป๋าตัวเอง เติมทุน เงินทอนคืน ซึ่งตั้งจากหน้าตั้งค่าได้
        * และเป็นที่ที่คนอยู่ในอารมณ์จัดระบบพอดี
        *
        * ส่งเป็นช่องซ่อนไม่ใช่ตัดออกเฉยๆ เพราะ schema แปลง “ไม่ส่งมา” เป็น
        * false ตามธรรมเนียมของ checkbox ถ้าตัดทิ้งดื้อๆ ประเภทใหม่ทุกอัน
        * จะกลายเป็นไม่นับเป็นกำไรโดยไม่มีใครสั่ง แล้วกำไรที่โชว์จะหายไป
        * ทีละก้อนแบบที่มองไม่ออกว่าเริ่มผิดตั้งแต่ตรงไหน
        */}
      <input type="hidden" name="counts" value="on" />

      <StatusMessage state={state} />

      <SubmitButton className="w-full" pendingLabel="กำลังเพิ่ม">
        เพิ่มประเภท
      </SubmitButton>
    </form>
  );
}
