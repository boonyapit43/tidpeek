import type { z } from "zod";

/**
 * ชนิดผลลัพธ์ที่ server action ทุกตัวคืนกลับ
 *
 * ออกแบบให้เข้ากับ useActionState ของ React โดยตรง ฟอร์มจึงอ่านสถานะ
 * ล่าสุดได้โดยไม่ต้องมี useState เองเลย
 */
export type ActionState =
  | { status: "idle" }
  /** id ของแถวที่เพิ่งสร้าง มีเฉพาะ action ที่ฝั่งฟอร์มต้องเอาไปเลือกต่อทันที */
  | { status: "ok"; message?: string; id?: string }
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

export function succeeded(message?: string, id?: string): ActionState {
  return { status: "ok", message, id };
}

export const UNAUTHORIZED = failed("หมดเวลาใช้งานแล้ว กรุณาล็อกอินใหม่");
export const SHOP_NOT_FOUND = failed("ไม่พบร้านที่เลือก");

/* ------------------------------------------------------------------ */
/*  รับมือกับความผิดพลาดที่ไม่ได้คาดไว้                                 */
/* ------------------------------------------------------------------ */

/**
 * redirect() กับ notFound() ของ Next.js ทำงานด้วยการโยน error ออกมา
 * ไม่ใช่ error จริง แต่เป็นสัญญาณบอกให้เปลี่ยนหน้า
 *
 * ถ้า try/catch ของเราไปกลืนมันไว้ หน้าจะไม่เปลี่ยนและไม่มีอะไรฟ้อง
 * ต้องโยนต่อเสมอ ตรวจจาก digest ซึ่งเป็นสัญญาที่ Next.js ใช้สื่อสาร
 */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  if (typeof digest !== "string") return false;

  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}

/** แปลความผิดพลาดที่เจอบ่อยเป็นภาษาที่คนหน้าร้านอ่านแล้วรู้ว่าต้องทำอะไร */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Connection terminated|fetch failed/i.test(message)) {
    return "ต่อฐานข้อมูลไม่ได้ ตรวจสัญญาณเน็ตแล้วลองใหม่";
  }
  if (/timeout/i.test(message)) {
    return "เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่อีกครั้ง";
  }
  if (/duplicate key|unique constraint/i.test(message)) {
    return "มีข้อมูลนี้อยู่แล้ว";
  }
  if (/violates check constraint|invalid input/i.test(message)) {
    return "ข้อมูลไม่ถูกต้อง ตรวจอีกครั้งแล้วลองใหม่";
  }

  return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

/**
 * ครอบการทำงานของ server action ทุกตัว
 *
 * ถ้าไม่ครอบไว้ ความผิดพลาดที่ไม่ได้คาด เช่นเน็ตหลุดตอนกดบันทึก จะโยนทะลุ
 * ขึ้นไปถึง React แล้วหน้าจอกลายเป็นขาวหรือขึ้น error ภาษาอังกฤษ
 * และที่แย่ที่สุดคือสิ่งที่พิมพ์ไว้ในฟอร์มหายหมด ต้องพิมพ์ใหม่ทั้งอัน
 *
 * พอคืนเป็น ActionState ปกติแทน ฟอร์มจะยังอยู่ครบ คนแค่กดบันทึกซ้ำได้เลย
 * ซึ่งสำคัญมากกับการใช้งานหน้าร้านผ่านเน็ตมือถือที่สะดุดเป็นเรื่องปกติ
 */
export async function runAction(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (error) {
    if (isNextControlFlow(error)) throw error;

    // ล็อกไว้ให้ตามดูได้ใน Vercel Logs ส่วนคนใช้เห็นแค่ข้อความสุภาพ
    console.error("[server action]", error);

    return failed(describe(error));
  }
}
