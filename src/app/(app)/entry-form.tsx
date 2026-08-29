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
import {
  AccountOptionItems,
  CategoryOptionItems,
  NO_ACCOUNTS_LABEL,
  NO_CATEGORIES_LABEL,
} from "@/components/pickers";
import type { AccountWithBalance } from "@/db/queries";
import type { Category, Direction } from "@/db/schema";
import { today } from "@/lib/date";

/**
 * ค่าของตัวเลือก "ไม่ระบุประเภท" ใน dropdown
 *
 * ค่า "" ถูกจองให้ตัวบอกสถานะ "ยังไม่ได้เลือก" (— เลือกประเภทก่อน —) แล้ว
 * ถ้าให้ไม่ระบุใช้ "" ด้วย สองความหมายจะแยกกันไม่ออก ซึ่งคือต้นเหตุของ
 * บั๊กเก่าที่เลือกไม่ระบุแล้วเด้งกลับ ค่านี้ถูกแปลงกลับเป็น "" ก่อนส่งเสมอ
 */
const NONE = "__none__";
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
  /** บัญชีที่ร้านนี้ใช้ลงรายการล่าสุด — ใช้เป็นค่าตั้งต้นของช่องบัญชี */
  titleHints: Record<Direction, TitleHint[]>;
}) {
  const [state, formAction] = useActionState(createTransaction, IDLE);
  const amountRef = useRef<HTMLInputElement>(null);
  const datalistId = useId();

  /**
   * เริ่มที่ฝั่งจ่ายออก ไม่ใช่รับเข้า
   *
   * เดิมตั้งไว้ที่รับเข้าเพราะคิดเองว่ายอดขายคือสิ่งที่ลงบ่อยสุด แต่ของจริง
   * ร้านลงรายจ่ายทีละรายการตลอดวัน (น้ำมัน น้ำแข็ง แก๊ส ซื้อของ) แล้วค่อยลง
   * ยอดขายรวมครั้งเดียวตอนปิดร้าน — วันหนึ่งจึงเป็นจ่าย 6 ต่อรับ 1
   *
   * ตั้งผิดด้านเท่ากับต้องกดสลับเพิ่มวันละหกครั้ง ส่วนครั้งเดียวที่ลงรับเข้า
   * เป็นตอนปิดร้านซึ่งไม่ได้รีบอะไร
   */
  const [direction, setDirection] = useState<Direction>("out");
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
  /**
   * แตะช่องประเภท "สำหรับรายการที่กำลังพิมพ์อยู่" หรือยัง — คนละเรื่องกับ
   * categoryId ที่ค้างข้ามรายการโดยตั้งใจ (ลงค่าแรกสามคนติดกันไม่ต้องเลือกซ้ำ)
   * ธงนี้รีเซ็ตทุกครั้งที่บันทึกสำเร็จหรือสลับฝั่ง ใช้กันตัวเดาประเภทไม่ให้
   * ทับสิ่งที่คนเพิ่งตั้งใจเลือกไว้กับรายการนี้
   */
  const [categoryTouched, setCategoryTouched] = useState(false);
  /** null = ยังไม่ได้เลือกเอง — ฟอร์มบันทึกใหม่ไม่มีตัวเลือกไม่ระบุ จึงเหลือสองสถานะ */
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
   * ประเภทที่เลือกอยู่จริงตอนนี้ — null คือยังไม่ได้เลือก และต้องโชว์เป็น
   * "เลือกประเภทก่อน" ไม่ใช่แอบเดาตัวแรกของฝั่งให้
   *
   * เคยเดาให้ แล้วผลคือรายการถูกจัดหมวดเป็นตัวแรกของลิสต์เงียบๆ ทั้งที่
   * ไม่ใช่ — สรุปแยกประเภทที่อุตส่าห์ออกแบบชุดประเภทมาก็เพี้ยนโดยไม่มีใคร
   * ทันเห็น การถามตรงๆ เสียหนึ่งแตะ แต่ตัวเลขในรายงานเชื่อถือได้
   * (ชื่อรายการที่เคยพิมพ์ยังช่วยเดาประเภทให้เหมือนเดิม — อันนั้นเดาจาก
   * ประวัติของคนใช้เอง ไม่ใช่จากลำดับในลิสต์)
   *
   * คำนวณตอน render แทนการเก็บ state + effect เพื่อไม่ให้มีเสี้ยววินาที
   * ที่หน้าจอโชว์ประเภทของฝั่งเก่าค้างอยู่ตอนสลับฝั่ง
   *
   * ⚠️ "" (เลือกไม่ระบุไว้เอง) ต้องนับว่าเป็นค่าที่ใช้ได้ ไม่ใช่ยังไม่เลือก
   */
  const categoryUsable =
    categoryId === "" || visibleCategories.some((c) => c.id === categoryId);

  const effectiveCategoryId = categoryId !== null && categoryUsable ? categoryId : null;

  /**
   * บัญชีที่เลือกอยู่ — ไม่เติมอะไรให้เลย ต้องเลือกเองทุกครั้ง
   *
   * เคยเติม "บัญชีที่ใช้ล่าสุด" ให้ โดยให้เหตุผลว่ามันคือสิ่งที่คนใช้เลือก
   * เองกับมือครั้งก่อน ไม่ใช่การเดา — แต่เจ้าของร้านบอกว่ายังไม่ใช่:
   * ครั้งก่อนเลือกเงินสด ไม่ได้แปลว่าครั้งนี้จะเป็นเงินสด และช่องที่มีค่า
   * ค้างอยู่แล้วคือช่องที่คนกวาดตาผ่านโดยไม่ได้อ่าน
   *
   * บั๊กเก่าที่รายการไม่ผูกบัญชีจนยอดไม่ขยับ ถูกกันด้วยปุ่มบันทึกที่กดไม่ได้
   * จนกว่าจะเลือก (ดู canSubmit) ไม่ใช่ด้วยการเติมค่าแทน และฟอร์มบันทึกใหม่
   * ไม่มีตัวเลือก "ไม่ระบุ" เลย เงินทุกรายการต้องมีที่มาที่ไป
   * (แผ่นแก้ไขยังมี เพื่อรายการเก่าที่เคยลงไว้โดยไม่ผูกบัญชี)
   *
   * เช็คว่ายังอยู่ในรายการไหมด้วย เพราะบัญชีอาจถูกปิดไปแล้ว
   */
  const effectiveAccountId =
    accountId !== null && accounts.some((a) => a.id === accountId) ? accountId : null;

  /**
   * ล้างทุกช่องหลังบันทึกสำเร็จ — รวมประเภทกับบัญชีด้วย
   *
   * เคยล้างแต่จำนวนเงินกับชื่อรายการ แล้วปล่อยสองช่องนี้ค้างไว้เพื่อให้ลง
   * รายการติดกันเร็วขึ้น ผลคือบันทึกเสร็จแล้วเหลือค่าเก่าค้างอยู่สองช่อง
   * ท่ามกลางช่องว่างที่เหลือ ซึ่งอ่านแล้วเหมือนฟอร์มล้างไม่หมดมากกว่า
   * เหมือนความตั้งใจ และผิดกฎเดียวกับที่เลิกเติมบัญชีที่ใช้ล่าสุดไปแล้ว —
   * ช่องที่มีค่าค้างอยู่คือช่องที่คนกวาดตาผ่านโดยไม่ได้อ่าน
   *
   * ปรับ state ตอน render โดยเทียบกับค่าที่เห็นล่าสุด ซึ่งเป็นวิธีที่ React
   * แนะนำสำหรับ "แก้ state เมื่อค่าที่รับเข้ามาเปลี่ยน" React จะทิ้งผลของ
   * render รอบนี้แล้วเริ่มใหม่ทันทีโดยยังไม่วาดลงจอ จึงไม่มีภาพกระพริบ
   * ต่างจากการทำใน effect ที่วาดของเก่าลงจอไปแล้วรอบหนึ่งก่อน
   */
  const [seenState, setSeenState] = useState(state);
  /**
   * นับรอบของ action ไว้ใช้เป็น key ของช่องเลือก
   *
   * React 19 สั่ง form.reset() เองหลัง action ทำงานจบ ซึ่งล้างค่าใน DOM
   * ของ <select> แต่ไม่ได้บอก React — React จึงยังคิดว่าค่าเดิมอยู่ครบและ
   * ไม่สั่งวาดใหม่ ผลคือจอโชว์หัวตาราง "เลือก...ก่อน" แต่ค่าที่ฟอร์มจะส่งจริง
   * ยังเป็นของเดิม — คนเห็นอย่างหนึ่ง ระบบทำอีกอย่าง
   *
   * พิสูจน์แล้วว่าเกิดจริง: กดบันทึกพลาดหนึ่งครั้ง ช่องเลือกกลายเป็นว่าง
   * แต่ปุ่มยังกดได้อยู่ เพราะเงื่อนไขอ่านจาก state ที่ยังมีค่าเต็ม
   *
   * เปลี่ยน key ทุกครั้งที่ action จบ = สร้างช่องใหม่จาก state ปัจจุบัน
   * DOM กับ state จึงกลับมาตรงกันเสมอ
   */
  const [formRound, setFormRound] = useState(0);

  if (seenState !== state) {
    setSeenState(state);
    setFormRound((n) => n + 1);

    if (state.status === "ok") {
      setAmount("");
      setTitle("");
      setNote("");
      // ยุบหมายเหตุกลับด้วย รายการถัดไปส่วนใหญ่ไม่ได้ใช้
      setNoteOpen(false);
      // การเลือกเมื่อกี้เป็นของรายการที่บันทึกจบไปแล้ว รายการใหม่เริ่มใหม่หมด
      setCategoryId(null);
      setAccountId(null);
      setCategoryTouched(false);
    }
  }

  // การย้ายโฟกัสเป็นการสั่ง DOM ไม่ใช่การเปลี่ยน state จึงอยู่ใน effect ได้
  // โฟกัสกลับไปช่องจำนวนเงินให้พิมพ์รายการถัดไปต่อได้เลยโดยไม่ต้องแตะจอ
  useEffect(() => {
    if (state.status === "ok") amountRef.current?.focus();
  }, [state]);

  /**
   * พิมพ์ชื่อที่เคยใช้แล้วเดาประเภทให้ ลดการแตะไปหนึ่งจังหวะต่อรายการ
   *
   * เดาเฉพาะตอนที่คนยังไม่ได้แตะช่องประเภทของรายการนี้ — ถ้าเพิ่งเลือกไว้
   * แม้แต่เลือก "ไม่ระบุ" ก็ถือว่าตั้งใจ ห้ามเดาทับ ไม่งั้นแค่กลับไปแก้
   * ตัวสะกดในชื่อรายการ ประเภทที่เลือกไว้ก็เด้งไปเป็นของที่ระบบจำได้
   * แล้วรายการถูกบันทึกผิดหมวดโดยไม่ทันเห็น
   */
  function handleTitle(value: string) {
    setTitle(value);
    if (categoryTouched) return;

    const hit = hints.find((h) => h.title === value);
    if (hit?.categoryId && visibleCategories.some((c) => c.id === hit.categoryId)) {
      setCategoryId(hit.categoryId);
    }
  }

  const isIncome = direction === "in";

  // ร้านที่ลิสต์ว่าง (เช่นยังไม่มีบัญชีเลย) ไม่ถูกล็อกจนบันทึกอะไรไม่ได้
  // ช่องนั้นจะโชว์ข้อความบอกทางไปเพิ่ม และยอมให้บันทึกแบบไม่ผูกไปก่อน
  const categoryReady = visibleCategories.length === 0 || effectiveCategoryId !== null;
  const accountReady = accounts.length === 0 || effectiveAccountId !== null;

  const canSubmit =
    title.trim().length > 0 && amount.trim().length > 0 && categoryReady && accountReady;

  return (
    <>
      <form action={formAction} className="space-y-4 rounded-2xl bg-surface p-4 shadow-sm">
        <input type="hidden" name="shopId" value={shopId} />
        <input type="hidden" name="direction" value={direction} />
        <input type="hidden" name="txnDate" value={date} />

        {/* สลับฝั่ง — ปุ่มใหญ่เต็มความกว้าง กดพลาดยากแม้ถือมือเดียว */}
        <DirectionToggle
          direction={direction}
          onChange={(next) => {
            setDirection(next);
            // สลับฝั่งแล้วประเภทเดิมใช้ไม่ได้อยู่แล้ว เปิดทางให้ตัวเดาทำงานใหม่
            setCategoryTouched(false);
          }}
        />

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
              key={`category-${formRound}`}
              id="category"
              value={
                effectiveCategoryId === null
                  ? ""
                  : effectiveCategoryId === ""
                    ? NONE
                    : effectiveCategoryId
              }
              onChange={(e) => {
                /**
                 * ค่าว่างจากช่องนี้แปลว่า "ยังไม่ได้เลือก" เสมอ ไม่ใช่ "ไม่ระบุ"
                 *
                 * ตัวเลือกหัวตารางถูก disabled ไว้ คนกดเลือกเองไม่ได้อยู่แล้ว
                 * แต่ React 19 สั่งรีเซ็ตฟอร์มให้เองหลัง action ทำงานจบ ซึ่ง
                 * ดันช่องกลับไปที่ตัวเลือกแรกแล้วยิง onChange ตามมาด้วยค่าว่าง
                 * ถ้าแปลค่าว่างเป็น "ไม่ระบุ" รายการถัดไปจะขึ้นว่าไม่ระบุประเภท
                 * เองเงียบๆ ทั้งที่ไม่มีใครไปแตะ — ซึ่งคือบั๊กที่คนใช้เจอจริง
                 *
                 * ไม่ระบุมีรหัสของตัวเอง (NONE) ทางเดียวที่จะได้มันคือเลือกเอง
                 */
                const picked = e.target.value;
                if (!picked) return;

                setCategoryId(picked === NONE ? "" : picked);
                setCategoryTouched(true);
              }}
              className="flex-1"
            >
              {visibleCategories.length === 0 ? (
                <option value="">{NO_CATEGORIES_LABEL}</option>
              ) : (
                <>
                  {/**
                    * ตัวเลือกหัวตารางเลือกได้ ไม่ได้ disabled ไว้
                    *
                    * React 19 สั่งรีเซ็ตฟอร์มเองหลัง action ทำงานจบ ซึ่งดันช่อง
                    * กลับไปที่ตัวเลือกแรก "ที่เลือกได้" — พอหัวตารางถูกปิดไว้
                    * มันเลยข้ามไปลงที่ "ไม่ระบุประเภท" แล้วยิงออกมาเป็นการเลือกจริง
                    * ผลคือรายการถัดไปกลายเป็นไม่ระบุประเภทเองโดยไม่มีใครแตะ
                    *
                    * เปิดให้เลือกได้แล้วรีเซ็ตจะมาลงตรงนี้พอดี = ยังไม่ได้เลือก
                    * ส่วนคนที่กดเลือกเองก็แค่ยกเลิกสิ่งที่เลือกไว้ ปุ่มบันทึกล็อกกลับ
                    * ซึ่งเป็นพฤติกรรมที่อ่านออก ไม่ใช่ทางตัน
                    */}
                  <option value="">— เลือกประเภทก่อน —</option>
                  <option value={NONE}>ไม่ระบุประเภท</option>
                  <CategoryOptionItems categories={visibleCategories} />
                </>
              )}
            </Select>
            {/* ค่าที่ส่งจริงอยู่ตรงนี้ — แปลงรหัสไม่ระบุกลับเป็นค่าว่างให้เซิร์ฟเวอร์ */}
            <input type="hidden" name="categoryId" value={effectiveCategoryId ?? ""} />
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
            key={`account-${formRound}`}
            id="account"
            value={effectiveAccountId ?? ""}
            // ไม่รับค่าว่าง ด้วยเหตุผลเดียวกับช่องประเภท
            onChange={(e) => {
              if (e.target.value) setAccountId(e.target.value);
            }}
          >
            {accounts.length === 0 ? (
              <option value="">{NO_ACCOUNTS_LABEL}</option>
            ) : (
              <>
                {/* เลือกได้ ด้วยเหตุผลเดียวกับช่องประเภท */}
                <option value="">— เลือกบัญชีก่อน —</option>
                <AccountOptionItems accounts={accounts} />
              </>
            )}
          </Select>
          <input type="hidden" name="accountId" value={effectiveAccountId ?? ""} />
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

