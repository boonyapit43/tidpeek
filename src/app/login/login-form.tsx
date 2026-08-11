"use client";

import { useActionState, useState } from "react";
import { login } from "@/actions/auth";
import { IDLE } from "@/actions/shared";
import { SubmitButton } from "@/components/form-parts";
import { cn } from "@/lib/cn";

/**
 * หน้าใส่ PIN
 *
 * มีทั้งช่องกรอกจริงและแป้นตัวเลขบนจอ ไม่ใช่อย่างใดอย่างหนึ่ง
 *
 *   • ช่องกรอกจริงที่วางทับจุดไว้แบบโปร่งใส ทำให้ตัวจัดการรหัสผ่านเติมให้ได้
 *     และพิมพ์จากคีย์บอร์ดจริงบนคอมได้ตามปกติ
 *   • แป้นบนจอทำให้กดด้วยนิ้วโป้งข้างเดียวได้เร็ว ปุ่มใหญ่กว่าแป้นของระบบมาก
 *     และหน้าจอไม่ต้องขยับหนีคีย์บอร์ดที่เด้งขึ้นมา
 *
 * ทั้งฟอร์มยืดหดให้พอดีหนึ่งจอเสมอ แป้นตัวเลขกินพื้นที่ที่เหลือทั้งหมด
 * ปุ่มจึงใหญ่ที่สุดเท่าที่จอนั้นให้ได้ โดยไม่ต้องเลื่อนหน้า
 */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

const MAX_LENGTH = 12;

export function LoginForm() {
  const [state, formAction] = useActionState(login, IDLE);
  const [pin, setPin] = useState("");

  const errorText = state.status === "error" ? state.message : null;

  function press(key: (typeof KEYS)[number]) {
    if (key === "back") setPin((p) => p.slice(0, -1));
    else if (key === "clear") setPin("");
    else setPin((p) => (p.length >= MAX_LENGTH ? p : p + key));
  }

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        {/**
         * ช่องกรอกจริง วางทับจุดไว้แบบโปร่งใส
         * ไม่ใช้ display:none เพราะช่องที่ซ่อนแบบนั้นโฟกัสไม่ได้
         * และตัวจัดการรหัสผ่านส่วนใหญ่จะมองข้ามไป
         */}
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          aria-label="รหัสเข้าใช้งาน"
          maxLength={MAX_LENGTH}
          required
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="absolute inset-0 w-full cursor-pointer rounded-2xl bg-transparent text-center text-transparent caret-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />

        <PinDots length={pin.length} error={Boolean(errorText)} />
      </div>

      {/* ความสูงคงที่เสมอ แป้นข้างล่างจะได้ไม่ขยับตอนข้อความผิดพลาดโผล่
          ซึ่งเป็นสาเหตุคลาสสิกที่คนกดพลาดไปโดนปุ่มอื่น */}
      <p
        role="alert"
        aria-live="polite"
        className={cn(
          "min-h-5 shrink-0 text-center text-sm font-medium",
          errorText ? "text-expense" : "text-transparent",
        )}
      >
        {errorText ?? " "}
      </p>

      {/* แป้นกินพื้นที่ที่เหลือทั้งหมด ปุ่มจึงใหญ่ตามจอโดยอัตโนมัติ */}
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-2.5">
        {KEYS.map((key) => (
          <Key key={key} value={key} onPress={() => press(key)} />
        ))}
      </div>

      <SubmitButton
        className="w-full shrink-0 text-base"
        pendingLabel="กำลังเข้า"
        disabled={pin.length === 0}
      >
        เข้าใช้งาน
      </SubmitButton>
    </form>
  );
}

/**
 * จุดแทนตัวเลขที่กดไปแล้ว ยาวตามจำนวนที่กด ไม่ได้ตรึงไว้ที่ 4 ช่อง
 * เพราะการตรึงช่องเท่ากับบอกใบ้ความยาวของรหัสให้คนที่หยิบเครื่องไปดู
 */
function PinDots({ length, error }: { length: number; error: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none flex h-14 items-center justify-center gap-3 rounded-2xl border transition-colors",
        error ? "border-expense/50 bg-expense-soft/40" : "border-line bg-surface",
      )}
    >
      {length === 0 ? (
        <span className="text-sm text-ink-soft">แตะเพื่อใส่รหัส</span>
      ) : (
        Array.from({ length }, (_, i) => (
          <span key={i} className={cn("size-3 rounded-full", error ? "bg-expense" : "bg-brand")} />
        ))
      )}
    </div>
  );
}

function Key({ value, onPress }: { value: (typeof KEYS)[number]; onPress: () => void }) {
  const isAction = value === "back" || value === "clear";

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={value === "back" ? "ลบตัวสุดท้าย" : value === "clear" ? "ล้างทั้งหมด" : value}
      className={cn(
        "flex items-center justify-center rounded-xl text-2xl font-semibold",
        "transition active:scale-95",
        isAction
          ? "text-ink-soft hover:bg-surface-2"
          : "border border-line bg-surface text-ink shadow-sm hover:bg-surface-2",
      )}
    >
      {value === "back" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
          aria-hidden
        >
          <path d="M21 5H8l-5 7 5 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1ZM17 9l-5 6M12 9l5 6" />
        </svg>
      ) : value === "clear" ? (
        <span className="text-base">ล้าง</span>
      ) : (
        <span className="num">{value}</span>
      )}
    </button>
  );
}
