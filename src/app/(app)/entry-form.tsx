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
import { DatePicker } from "@/components/date-picker";
import { AccountOptions, CategoryOptions } from "@/components/pickers";
import type { AccountWithBalance } from "@/db/queries";
import type { Category, Direction } from "@/db/schema";
import { today } from "@/lib/date";
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
  lastAccountId,
  titleHints,
}: {
  shopId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  /** บัญชีที่ร้านนี้ใช้ลงรายการล่าสุด — ใช้เป็นค่าตั้งต้นของช่องบัญชี */
  lastAccountId: string | null;
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
  /** สามสถานะเหมือนประเภทข้างบน null = ยังไม่ได้เลือกเอง "" = เลือกไม่ระบุไว้ */
  const [accountId, setAccountId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
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
   * บัญชีตั้งต้น เรียงตามลำดับนี้ — ที่เลือกเอง → ที่ใช้ล่าสุด → ตัวแรกในรายการ
   *
   * เดิมตั้งต้นเป็น "ไม่ระบุ" ซึ่งดูเป็นกลางดี แต่ผลจริงคือรายการที่ลงเร็วๆ
   * ไม่ผูกกับบัญชีไหนเลย ยอดคงเหลือเลยไม่ขยับทั้งที่เงินเข้าออกจริง
   * เดาบัญชีให้แล้วเลือกผิดยังเห็นและแก้ได้ แต่ไม่เลือกให้เลยแล้วยอดนิ่ง
   * ไม่มีอะไรบอกว่าผิด กว่าจะรู้ก็ต้องไล่แก้ย้อนหลังทีละรายการ
   *
   * เช็คว่ายังอยู่ในรายการไหมด้วย เพราะบัญชีที่ใช้ล่าสุดอาจถูกปิดไปแล้ว
   * ถ้าไม่เช็คแล้วส่งค่าที่ไม่มีในตัวเลือก เบราว์เซอร์จะเด้งไปตัวแรกเงียบๆ
   */
  const accountChosen = accountId !== null;
  const accountUsable = accountId === "" || accounts.some((a) => a.id === accountId);
  const fallbackAccountId =
    (lastAccountId && accounts.some((a) => a.id === lastAccountId) ? lastAccountId : null) ??
    accounts[0]?.id ??
    "";

  const effectiveAccountId =
    accountChosen && accountUsable ? accountId : fallbackAccountId;

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
      // ยุบหมายเหตุกลับด้วย รายการถัดไปส่วนใหญ่ไม่ได้ใช้
      setNoteOpen(false);
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
              <CategoryOptions categories={visibleCategories} />
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
            value={effectiveAccountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <AccountOptions accounts={accounts} />
          </Select>
        </Field>

        <DatePicker value={date} onChange={setDate} error={fieldError(state, "txnDate")} />

        {/**
         * หมายเหตุยุบไว้จนกว่าจะกดเปิด
         *
         * เป็นช่องที่ไม่ได้ใช้ทุกรายการ แต่กินความสูง 72px ทุกครั้ง
         * ซึ่งคือส่วนหนึ่งที่ดันปุ่มบันทึกให้ตกไปใต้ขอบจอ
         */}
        {noteOpen ? (
          <Field label="หมายเหตุ" htmlFor="note">
            <Input
              id="note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              enterKeyHint="done"
              autoFocus
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="flex min-h-touch w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-medium text-ink-soft transition hover:border-brand/40 hover:text-brand"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-4"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            เพิ่มหมายเหตุ
          </button>
        )}

        <StatusMessage state={state} />

        {/**
         * ปุ่มบันทึกไหลไปตามฟอร์มตามปกติ ไม่ได้ลอยติดขอบจอ
         *
         * เคยทำเป็นปุ่มลอย (sticky) เพื่อไม่ต้องเลื่อนก่อนกด แต่แลกมาด้วย
         * ปุ่มที่ทับเนื้อหาอยู่ตลอดเวลา ต้องมีแถบไล่สีมากลบรอยต่อ และมีกฎ
         * แยกสำหรับจอใหญ่อีกชุด ทั้งหมดเพื่อประหยัดการเลื่อนนิ้วครั้งเดียว
         *
         * ปุ่มธรรมดาที่อยู่ท้ายฟอร์มอ่านง่ายกว่าและเดาตำแหน่งได้ — ฟอร์มจบตรงไหน
         * ปุ่มอยู่ตรงนั้น ไม่ต้องมีอะไรพิเศษให้พังทีหลัง
         */}
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
        // เลือกประเภทที่เพิ่งสร้างไว้ให้เลย คนกดเพิ่มตอนกำลังจะใช้มันพอดี
        onCreated={setCategoryId}
      />
    </>
  );
}

