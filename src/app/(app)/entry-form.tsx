"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createTransaction } from "@/actions/transactions";
import { IDLE } from "@/actions/shared";
import {
  DirectionToggle,
  Field,
  Input,
  MoneyInput,
  Select,
  StatusMessage,
  SubmitButton,
  fieldError,
} from "@/components/form-parts";
import type { AccountWithBalance } from "@/db/queries";
import type { Category, Direction } from "@/db/schema";
import { addDays, thaiDate, today } from "@/lib/date";
import { cn } from "@/lib/cn";
import { AddCategorySheet } from "./add-category-sheet";

export type TitleHint = { title: string; categoryId: string | null };

/**
 * ฟอร์มบันทึกรายการ — หน้าจอที่ถูกใช้บ่อยที่สุดของแอป
 *
 * ลำดับช่องเรียงตามความถี่ที่ต้องแตะจริง ไม่ใช่ตามลำดับคอลัมน์ในฐานข้อมูล
 * จำนวนเงินอยู่บนสุดเพราะเป็นสิ่งเดียวที่ต้องพิมพ์ทุกครั้ง ส่วนวันที่กับ
 * หมายเหตุอยู่ล่างสุดเพราะส่วนใหญ่ปล่อยค่าเดิม
 *
 * หลังบันทึกสำเร็จจะล้างเฉพาะจำนวนเงิน ชื่อรายการ และหมายเหตุ
 * ส่วนวัน ฝั่ง และบัญชียังอยู่เหมือนเดิม เพราะคนมักลงหลายรายการรวดเดียว
 * ของวันเดียวกันและบัญชีเดียวกัน แล้วโฟกัสกลับไปที่ช่องเงินให้พิมพ์ต่อได้เลย
 */
export function EntryForm({
  shopId,
  accounts,
  categories,
  titleHints,
}: {
  shopId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  titleHints: Record<Direction, TitleHint[]>;
}) {
  const [state, formAction] = useActionState(createTransaction, IDLE);
  const amountRef = useRef<HTMLInputElement>(null);
  const datalistId = useId();

  // เริ่มที่ฝั่งรับเข้า เพราะยอดขายคือรายการที่ร้านบันทึกบ่อยที่สุด
  const [direction, setDirection] = useState<Direction>("in");
  const [date, setDate] = useState(today);
  /**
   * ประเภทที่เลือกไว้ มีสามสถานะ ไม่ใช่สอง
   *
   *   null  ยังไม่ได้เลือกเอง — ให้ระบบเลือกตัวแรกของฝั่งนั้นให้
   *   ""    เลือก "ไม่ระบุ" ไว้เองโดยตั้งใจ
   *   uuid  เลือกประเภทนั้นไว้
   *
   * ต้องแยก null กับ "" ออกจากกัน เพราะถ้าใช้ "" แทนทั้งสองความหมาย
   * ตอนคนเลือก "ไม่ระบุ" ระบบจะนึกว่ายังไม่ได้เลือกแล้วเด้งกลับไปตัวแรกทันที
   */
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.direction === direction),
    [categories, direction],
  );

  const hints = titleHints[direction];

  /**
   * ประเภทที่ใช้ได้จริงในตอนนี้
   *
   * คำนวณตอน render แทนการเก็บเป็น state แล้วใช้ effect คอยแก้เมื่อสลับฝั่ง
   * เพราะการ setState ใน effect ทำให้ render สองรอบต่อการกดหนึ่งครั้ง
   * และจะมีเสี้ยววินาทีที่หน้าจอโชว์ประเภทของฝั่งเก่าค้างอยู่
   *
   * ⚠️ "" (ไม่ระบุ) ต้องนับว่าเป็นค่าที่ใช้ได้ด้วย
   *    ถ้าเช็คแค่ว่ามีอยู่ในรายการไหม string ว่างจะไม่ผ่านแล้วเด้งกลับไป
   *    ตัวแรกทันที ทำให้เลือก "ไม่ระบุ" ไม่ได้เลย
   */
  const chosen = categoryId !== null;
  const stillUsable = categoryId === "" || visibleCategories.some((c) => c.id === categoryId);

  const effectiveCategoryId =
    chosen && stillUsable ? categoryId : (visibleCategories[0]?.id ?? "");

  /**
   * ล้างช่องที่ต้องกรอกใหม่ทุกครั้ง หลังบันทึกสำเร็จ
   *
   * ปรับ state ตอน render โดยเทียบกับค่าที่เห็นล่าสุด ซึ่งเป็นวิธีที่ React
   * แนะนำสำหรับ "แก้ state เมื่อค่าที่รับเข้ามาเปลี่ยน" React จะทิ้งผลของ
   * render รอบนี้แล้วเริ่มใหม่ทันทีโดยยังไม่วาดลงจอ จึงไม่มีภาพกระพริบ
   * ต่างจากการทำใน effect ที่วาดของเก่าลงจอไปแล้วรอบหนึ่งก่อน
   */
  const [seenState, setSeenState] = useState(state);

  if (seenState !== state) {
    setSeenState(state);

    if (state.status === "ok") {
      setAmount("");
      setTitle("");
      setNote("");
    }
  }

  // การย้ายโฟกัสเป็นการสั่ง DOM ไม่ใช่การเปลี่ยน state จึงอยู่ใน effect ได้
  // โฟกัสกลับไปช่องจำนวนเงินให้พิมพ์รายการถัดไปต่อได้เลยโดยไม่ต้องแตะจอ
  useEffect(() => {
    if (state.status === "ok") amountRef.current?.focus();
  }, [state]);

  /** พิมพ์ชื่อที่เคยใช้แล้วเดาประเภทให้ ลดการแตะไปหนึ่งจังหวะต่อรายการ */
  function handleTitle(value: string) {
    setTitle(value);

    const hit = hints.find((h) => h.title === value);
    if (hit?.categoryId && visibleCategories.some((c) => c.id === hit.categoryId)) {
      setCategoryId(hit.categoryId);
    }
  }

  const isIncome = direction === "in";
  const canSubmit = title.trim().length > 0 && amount.trim().length > 0;

  return (
    <>
      <form action={formAction} className="space-y-4 rounded-2xl bg-surface p-4 shadow-sm">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="direction" value={direction} />
        <input type="hidden" name="txnDate" value={date} />

        {/* สลับฝั่ง — ปุ่มใหญ่เต็มความกว้าง กดพลาดยากแม้ถือมือเดียว */}
        <DirectionToggle direction={direction} onChange={setDirection} />

        <Field label="จำนวนเงิน" htmlFor="amount" error={fieldError(state, "amount")}>
          <MoneyInput
            ref={amountRef}
            id="amount"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            enterKeyHint="next"
          />
        </Field>

        <Field label="รายการ" htmlFor="title" error={fieldError(state, "title")}>
          <Input
            id="title"
            name="title"
            // datalist ให้เบราว์เซอร์เสนอคำที่เคยพิมพ์ ทำงานได้ทั้ง iOS และ Android
            list={datalistId}
            value={title}
            onChange={(e) => handleTitle(e.target.value)}
            placeholder={isIncome ? "เช่น ยอดขายวันนี้" : "เช่น นม, ค่าส่งของ"}
            required
            maxLength={200}
            enterKeyHint="next"
          />
          <datalist id={datalistId}>
            {hints.map((h) => (
              <option key={h.title} value={h.title} />
            ))}
          </datalist>
        </Field>

        {/* ไม่มีคำอธิบายใต้ช่องนี้ เพราะประเภทที่ไม่นับเป็นกำไรมีวงเล็บกำกับ
            อยู่ในตัวเลือกแล้ว การเขียนซ้ำอีกรอบมีแต่ทำให้ฟอร์มยาวขึ้นเปล่าๆ */}
        <Field label="ประเภท" htmlFor="category">
          <div className="flex gap-2">
            <Select
              id="category"
              name="categoryId"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex-1"
            >
              <option value="">— ไม่ระบุ —</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.counts ? "" : "  (ไม่นับเป็นกำไร)"}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="เพิ่มประเภทใหม่"
              className="flex min-h-touch w-12 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft hover:bg-surface-2"
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
            </button>
          </div>
        </Field>

        <Field label={isIncome ? "เงินเข้าบัญชี" : "จ่ายจากบัญชี"} htmlFor="account">
          <Select
            id="account"
            name="accountId"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">— ไม่ระบุ —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.shopId === null ? "  (ใช้ร่วม)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <DatePicker value={date} onChange={setDate} error={fieldError(state, "txnDate")} />

        <Field label="หมายเหตุ (ไม่บังคับ)" htmlFor="note">
          <Input
            id="note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            enterKeyHint="done"
          />
        </Field>

        <StatusMessage state={state} />

        <SubmitButton className="w-full" disabled={!canSubmit}>
          บันทึกรายการ
        </SubmitButton>
      </form>

      {/* ต้องอยู่นอก <form> ข้างบน เพราะ HTML ไม่อนุญาตให้ form ซ้อน form */}
      <AddCategorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        shopId={shopId}
        direction={direction}
        onCreated={() => undefined}
      />
    </>
  );
}

/**
 * เลือกวันที่แบบกดปุ่มลัด
 *
 * เกือบทุกครั้งที่บันทึกคือของวันนี้หรือเมื่อวาน การให้กดปุ่มเดียวจบ
 * เร็วกว่าเปิดปฏิทินของระบบแล้วเลื่อนหาวันมาก โดยเฉพาะบนมือถือ
 * ส่วนวันอื่นยังเลือกจากปฏิทินได้ตามปกติ
 */
function DatePicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (date: string) => void;
  error?: string;
}) {
  const now = today();
  const yesterday = addDays(now, -1);
  const isOther = value !== now && value !== yesterday;

  return (
    <Field label="วันที่" htmlFor="date-input" error={error}>
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
            id="date-input"
            type="date"
            value={value}
            onChange={(e) => {
              // เบราว์เซอร์ส่ง "" มาเมื่อคนกดล้างค่าในปฏิทิน
              // ถ้าปล่อยผ่าน ฟอร์มจะส่งวันว่างไปให้เซิร์ฟเวอร์ปฏิเสธ
              if (e.target.value) onChange(e.target.value);
            }}
            aria-label="เลือกวันอื่น"
            className="w-full bg-transparent text-sm focus:outline-none"
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
        active
          ? "border-brand bg-brand text-white"
          : "border-line text-ink-soft hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}
