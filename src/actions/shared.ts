import type { z } from "zod";

/**
 * ชนิดผลลัพธ์ที่ server action ทุกตัวคืนกลับ
 *
 * ออกแบบให้เข้ากับ useActionState ของ React โดยตรง ฟอร์มจึงอ่านสถานะ
 * ล่าสุดได้โดยไม่ต้องมี useState เองเลย
 */
export type ActionState =
  | { status: "idle" }
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

export const IDLE: ActionState = { status: "idle" };

/**
 * แปลง error ของ Zod เป็นแมปของ "ชื่อช่อง → ข้อความ"
 *
 * เขียนเองแทนการใช้ .flatten() เพราะ helper ของ Zod เปลี่ยนชื่อระหว่าง
 * เวอร์ชัน 3 กับ 4 ส่วน issues[] เป็นโครงสร้างที่นิ่งมาตลอด
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }

  return out;
}

/** FormData → object ธรรมดา ให้ Zod ตรวจต่อได้ */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }

  return out;
}

export function invalid(error: z.ZodError): ActionState {
  const fieldErrors = toFieldErrors(error);

  return {
    status: "error",
    // เอาข้อความแรกขึ้นมาเป็นสรุป เพราะบนมือถือคนเห็นแถบข้อความก่อนช่องกรอก
    message: Object.values(fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    fieldErrors,
  };
}

export function failed(message: string): ActionState {
  return { status: "error", message };
}

export function succeeded(message?: string): ActionState {
  return { status: "ok", message };
}

export const UNAUTHORIZED = failed("หมดเวลาใช้งานแล้ว กรุณาล็อกอินใหม่");
export const SHOP_NOT_FOUND = failed("ไม่พบร้านที่เลือก");
