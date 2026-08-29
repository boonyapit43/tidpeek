"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/shared";
import { cn } from "@/lib/cn";

/**
 * ช่องที่จำสิ่งที่พิมพ์ไว้ แม้บันทึกไม่สำเร็จ
 *
 * React 19 ล้างฟอร์มให้อัตโนมัติทุกครั้งที่ action ทำงานจบ ไม่ว่าจะสำเร็จ
 * หรือพลาด ซึ่งใช้ไม่ได้กับแอปนี้ — ร้านใช้เน็ตมือถือที่สะดุดเป็นเรื่องปกติ
 * ถ้ากรอกบัญชีครบห้าช่องแล้วเน็ตหลุด ทุกอย่างหายหมดต้องพิมพ์ใหม่ทั้งชุด
 *
 * ทางแก้คือทำให้ช่องเป็น controlled ค่าจึงอยู่ใน state ของ React
 * ไม่ได้อยู่ใน DOM ที่ถูกล้าง
 *
 * ⚠️ ช่องไหนอยู่ในฟอร์มที่ยิง server action ให้ใช้ตัวนี้เสมอ อย่าใช้
 *    defaultValue เปล่าๆ ไม่งั้นสิ่งที่พิมพ์จะหายตอนบันทึกพลาด
 *    ซึ่งเป็นอาการที่โทษเน็ตแล้วจบ ไม่มีใครเอะใจว่าเป็นบั๊ก
 */
export function useKeptValue(initial = "") {
  const [value, setValue] = useState(initial);

  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValue(e.target.value),
  };
}

/** เหมือนข้างบน แต่สำหรับ checkbox ซึ่งถูกล้างกลับเป็นค่าตั้งต้นเหมือนกัน */
export function useKeptChecked(initial: boolean) {
  const [checked, setChecked] = useState(initial);

  return {
    checked,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setChecked(e.target.checked),
  };
}

/**
 * ชิ้นส่วนฟอร์มที่ใช้ซ้ำทั้งแอป
 *
 * ทุกอย่างที่กดได้ในไฟล์นี้สูงอย่างน้อย 44px (min-h-touch) ตามขนาดที่นิ้วโป้ง
 * กดไม่พลาด และช่องกรอกทุกช่องตัวอักษร 16px ขึ้นไปเพื่อไม่ให้ iOS ซูมเอง
 */

const fieldBase =
  "w-full min-h-touch rounded-xl border border-line bg-surface px-3.5 py-2.5 " +
  "text-ink placeholder:text-ink-soft/60 transition-colors " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 " +
  "disabled:opacity-50";

/**
 * ป้ายกำกับ + ช่องกรอก + ข้อความผิดพลาด
 *
 * ตั้งใจไม่มีช่องคำอธิบายใต้ช่องกรอก ถ้าต้องเขียนอธิบายว่าช่องนี้คืออะไร
 * แปลว่าป้ายกำกับยังตั้งชื่อได้ไม่ดีพอ ให้ไปแก้ชื่อแทนการเติมคำอธิบาย
 */
export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {/* role=alert ทำให้โปรแกรมอ่านหน้าจออ่านข้อความผิดพลาดทันทีที่โผล่ */}
      {error && (
        <p role="alert" className="text-xs font-medium text-expense">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(fieldBase, "appearance-none bg-no-repeat pr-9", className)}
      style={{
        // ลูกศรวาดเป็น data URI เพื่อไม่ต้องโหลดไฟล์ภาพจากภายนอก
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%23888' stroke-width='1.5'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.85rem center",
        backgroundSize: "0.7rem",
      }}
      {...props}
    />
  );
}

/**
 * ช่องกรอกจำนวนเงิน
 *
 * ใช้ type=text คู่กับ inputMode=decimal ไม่ใช่ type=number เพราะ
 *   • type=number บน Android เปิดคีย์บอร์ดที่ไม่มีจุดทศนิยมในบางเครื่อง
 *   • ค่าที่อ่านจาก type=number ถูกแปลงเป็น number ไปแล้วหนึ่งรอบ
 *     ซึ่งขัดกับกฎที่ว่าเงินต้องเป็น string ตลอดทาง
 * pattern บังคับให้ Safari บน iOS เปิดแป้นตัวเลขเช่นกัน
 */
export function MoneyInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      autoComplete="off"
      className={cn(fieldBase, "num text-right text-2xl font-semibold tabular-nums", className)}
      {...props}
    />
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-touch items-center justify-center gap-2 rounded-xl px-4",
        "font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-brand-gradient text-on-accent shadow-md shadow-brand/25 hover:brightness-110",
        variant === "ghost" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "danger" && "border border-expense/30 text-expense hover:bg-expense-soft",
        className,
      )}
      {...props}
    />
  );
}

/**
 * ปุ่มส่งฟอร์มที่รู้สถานะของฟอร์มเอง
 *
 * useFormStatus ต้องอยู่ในคอมโพเนนต์ลูกของ <form> ไม่ใช่ตัวเดียวกับที่มี form
 * ถ้าเรียกในตัวเดียวกันจะได้ pending เป็น false ตลอด
 *
 * การล็อกปุ่มระหว่างส่งสำคัญมากบนมือถือ เพราะเน็ตช้าแล้วคนมักกดซ้ำ
 * ซึ่งจะได้รายการซ้ำสองบรรทัด
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant = "primary",
  disabled,
  ...props
}: React.ComponentProps<"button"> & {
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    /**
     * disabled ต้องรวมกับ pending เอง ห้ามปล่อยให้ {...props} ทับ
     *
     * เคยเขียน disabled={pending} แล้ววาง {...props} ไว้ข้างหลัง — ฟอร์มไหน
     * ส่ง disabled ของตัวเองมา (เช่นปุ่มบันทึกที่รอให้กรอกครบ) จะทับล็อกนี้
     * พอดี ผลคือระหว่างกำลังบันทึก ช่องยังกรอกครบอยู่ ปุ่มจึงกดซ้ำได้
     * แล้วได้รายการซ้ำสองบรรทัด ซึ่งคือบั๊กที่คอมเมนต์ข้างบนสัญญาว่ากันไว้
     */
    <Button {...props} type="submit" variant={variant} disabled={pending || disabled} className={className}>
      {pending && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? (pendingLabel ?? "กำลังบันทึก") : children}
    </Button>
  );
}

/**
 * สลับทิศทางของเงิน — ใช้ทั้งฟอร์มบันทึกและฟอร์มแก้ไข
 *
 * อยู่ที่เดียวเพื่อให้ลำดับปุ่มกับสีตรงกันเสมอ ถ้าแยกกันเขียนสองที่
 * วันที่แก้ลำดับจะเหลือที่หนึ่งเป็นแบบเก่า แล้วคนกดผิดฝั่งโดยไม่ทันสังเกต
 *
 * รับเข้าอยู่ซ้ายและเป็นค่าตั้งต้น เพราะร้านค้าบันทึกยอดขายบ่อยที่สุด
 */
export function DirectionToggle({
  direction,
  onChange,
}: {
  direction: "in" | "out";
  onChange: (direction: "in" | "out") => void;
}) {
  const isIncome = direction === "in";

  return (
    <div
      role="group"
      aria-label="ทิศทางของเงิน"
      className="grid grid-cols-2 gap-1.5 rounded-xl bg-surface-2 p-1.5"
    >
      <button
        type="button"
        aria-pressed={isIncome}
        onClick={() => onChange("in")}
        className={cn(
          "min-h-touch rounded-lg font-semibold transition",
          isIncome ? "bg-income text-on-accent shadow-sm" : "text-ink-soft",
        )}
      >
        รับเข้า
      </button>
      <button
        type="button"
        aria-pressed={!isIncome}
        onClick={() => onChange("out")}
        className={cn(
          "min-h-touch rounded-lg font-semibold transition",
          !isIncome ? "bg-expense text-on-accent shadow-sm" : "text-ink-soft",
        )}
      >
        จ่ายออก
      </button>
    </div>
  );
}

/** แถบแจ้งผลหลังส่งฟอร์ม */
export function StatusMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;

  const ok = state.status === "ok";
  if (!state.message) return null;

  return (
    <p
      // aria-live ทำให้โปรแกรมอ่านหน้าจอประกาศผลลัพธ์โดยไม่ต้องย้ายโฟกัส
      role={ok ? "status" : "alert"}
      aria-live="polite"
      className={cn(
        "animate-slide-up rounded-xl px-3.5 py-2.5 text-sm font-medium",
        ok ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
      )}
    >
      {state.message}
    </p>
  );
}

/** ดึงข้อความผิดพลาดของช่องหนึ่งออกจากผลลัพธ์ของ action */
export function fieldError(state: ActionState, name: string): string | undefined {
  if (state.status !== "error") return undefined;
  return state.fieldErrors?.[name]?.[0];
}
