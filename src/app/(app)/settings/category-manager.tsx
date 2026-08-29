"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  addDefaultCategories,
  createCategory,
  deleteCategory,
  setCategoryActive,
  updateCategory,
} from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import { DangerActions } from "@/components/danger-actions";
import {
  Field,
  Input,
  StatusMessage,
  SubmitButton,
  useKeptChecked,
  useKeptValue,
} from "@/components/form-parts";
import { Sheet } from "@/components/sheet";
import type { Category, Direction } from "@/db/schema";
import { cn } from "@/lib/cn";

/**
 * จัดการประเภทรายรับรายจ่าย
 *
 * แยกฝั่งรับกับฝั่งจ่ายเป็นสองแท็บ ไม่เอามารวมในรายการเดียวกัน เพราะทั้งสอง
 * ฝั่งไม่มีทางใช้แทนกันได้ การเห็นพร้อมกันจึงมีแต่ทำให้รายการยาวขึ้นเปล่าๆ
 * บนจอมือถือที่ต้องเลื่อนอยู่แล้ว
 */
export function CategoryManager({
  shopId,
  categories,
  canAddDefaults,
}: {
  shopId: string;
  categories: Category[];
  canAddDefaults: boolean;
}) {
  // เรียงฝั่งรับก่อนฝั่งจ่ายให้ตรงกับปุ่มสลับในฟอร์มบันทึก
  const [direction, setDirection] = useState<Direction>("in");
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = categories.filter((c) => c.direction === direction);

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-semibold text-ink-soft">ประเภทรายรับรายจ่าย</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-touch items-center px-2 -mr-2 text-sm font-semibold text-brand"
        >
          + เพิ่ม
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-b border-line p-2">
        {(["in", "out"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={direction === d}
            onClick={() => setDirection(d)}
            className={cn(
              "min-h-touch rounded-lg text-sm font-semibold transition",
              direction === d ? "bg-surface-2 text-ink" : "text-ink-soft",
            )}
          >
            {d === "out" ? "ฝั่งจ่ายออก" : "ฝั่งรับเข้า"}
          </button>
        ))}
      </div>

      <AddDefaultsRow shopId={shopId} canAdd={canAddDefaults} />

      <ul className="divide-y divide-line">
        {visible.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => setEditing(category)}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-3 text-left transition active:bg-surface-2",
                !category.isActive && "opacity-50",
              )}
            >
              <span className="flex-1 truncate text-sm text-ink">{category.name}</span>

              {!category.counts && (
                <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                  ไม่นับเป็นกำไร
                </span>
              )}
              {!category.isActive && (
                <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] text-ink-soft">
                  ปิดอยู่
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <AddSheet
        open={adding}
        onClose={() => setAdding(false)}
        shopId={shopId}
        direction={direction}
      />
      <EditSheet category={editing} onClose={() => setEditing(null)} shopId={shopId} />
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * เติมชุดประเภทมาตรฐานทีเดียว 33 รายการ
 *
 * โผล่เฉพาะร้านที่ยังไม่เคยได้ชุดตั้งต้น ประเภทที่มีชื่อซ้ำกับของเดิมจะถูกข้าม
 * ของที่พิมพ์เองไว้แล้วไม่หายและไม่ซ้ำ
 *
 * พอกดสำเร็จ ฝั่งเซิร์ฟเวอร์จะตอบว่าไม่ต้องโชว์ปุ่มแล้ว (canAdd เป็น false)
 * แต่ยังต้องค้างข้อความผลลัพธ์ไว้ให้อ่าน ไม่งั้นปุ่มจะหายไปเฉยๆ
 * แล้วคนกดไม่รู้ว่าเกิดอะไรขึ้น ข้อความจะหายไปเองตอนเปลี่ยนหน้า
 */
function AddDefaultsRow({ shopId, canAdd }: { shopId: string; canAdd: boolean }) {
  const [state, formAction] = useActionState(addDefaultCategories, IDLE);

  if (!canAdd && state.status !== "ok") return null;

  return (
    <div className="border-b border-line p-3">
      {state.status === "ok" ? (
        <StatusMessage state={state} />
      ) : (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="shopId" value={shopId} />
          <SubmitButton variant="ghost" className="w-full" pendingLabel="กำลังเพิ่ม">
            เพิ่มชุดประเภทตั้งต้น
          </SubmitButton>
          <StatusMessage state={state} />
        </form>
      )}
    </div>
  );
}

function AddSheet({
  open,
  onClose,
  shopId,
  direction,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  direction: Direction;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`เพิ่มประเภทฝั่ง${direction === "in" ? "รับเข้า" : "จ่ายออก"}`}
    >
      {/* key ผูกกับฝั่งด้วย สลับแท็บรับ/จ่ายแล้วช่องที่พิมพ์ค้างไว้จะล้างตาม */}
      {open && (
        <AddCategoryForm
          key={direction}
          shopId={shopId}
          direction={direction}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function AddCategoryForm({
  shopId,
  direction,
  onDone,
}: {
  shopId: string;
  direction: Direction;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(createCategory, IDLE);
  const id = useId();
  const name = useKeptValue();

  useEffect(() => {
    if (state.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="direction" value={direction} />

      <Field label="ชื่อประเภท" htmlFor={id}>
        <Input {...name} id={id} name="name" required maxLength={120} autoFocus />
      </Field>

      <CountsToggle direction={direction} defaultChecked />

      <StatusMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="กำลังเพิ่ม">
        เพิ่มประเภท
      </SubmitButton>
    </form>
  );
}

function EditSheet({
  category,
  onClose,
  shopId,
}: {
  category: Category | null;
  onClose: () => void;
  shopId: string;
}) {
  return (
    <Sheet open={category !== null} onClose={onClose} title="แก้ไขประเภท">
      {category && (
        <EditCategoryForm
          key={category.id}
          category={category}
          shopId={shopId}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function EditCategoryForm({
  category,
  shopId,
  onDone,
}: {
  category: Category;
  shopId: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(updateCategory, IDLE);
  const id = useId();
  const name = useKeptValue(category.name);

  useEffect(() => {
    if (state.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="id" value={category.id} />

        <Field label="ชื่อประเภท" htmlFor={id}>
          <Input {...name} id={id} name="name" required maxLength={120} />
        </Field>

        <CountsToggle direction={category.direction} defaultChecked={category.counts} />

        <StatusMessage state={state} />
        <SubmitButton className="w-full">บันทึกการแก้ไข</SubmitButton>
      </form>

      <DangerActions
        shopId={shopId}
        id={category.id}
        isActive={category.isActive}
        activeLabel="ปิดใช้งาน"
        deleteLabel="ลบประเภท"
        toggleAction={setCategoryActive}
        deleteAction={deleteCategory}
        onDone={onDone}
      />
    </>
  );
}

function CountsToggle({
  direction,
  defaultChecked,
}: {
  direction: Direction;
  defaultChecked: boolean;
}) {
  const counts = useKeptChecked(defaultChecked);

  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
      <input
        {...counts}
        type="checkbox"
        name="counts"
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
      />
      <span className="text-sm text-ink">
        นับเป็น{direction === "in" ? "รายได้" : "รายจ่าย"}ตอนคิดกำไร
      </span>
    </label>
  );
}
