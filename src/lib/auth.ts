import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

/**
 * ล็อกอินด้วย PIN เดียวที่ใช้ร่วมกันทั้งร้าน
 *
 * เหมาะกับร้านที่มีคนใช้ไม่กี่คนและไว้ใจกัน ข้อแลกเปลี่ยนที่ต้องรู้คือ
 * ระบบนี้ไม่รู้ว่าใครเป็นคนบันทึกหรือลบรายการ ถ้าวันหนึ่งต้องสืบย้อนได้
 * ต้องเปลี่ยนไปใช้ระบบผู้ใช้จริงและเพิ่มคอลัมน์ created_by
 *
 * ตั้งใจไม่ใช้ middleware.ts เพราะมันรันบน Edge runtime ซึ่งโฮสต์ที่ใช้
 * Phusion Passenger (DirectAdmin) รันไม่ได้ การ์ดทั้งหมดจึงอยู่ใน layout
 * และใน server action ทุกตัว โดยเรียก hasSession() ที่บรรทัดแรก
 *
 * ⚠️ server action เป็น endpoint ที่ยิงตรงจากอินเทอร์เน็ตได้ ไม่ได้ถูกป้องกัน
 *    โดยอัตโนมัติแค่เพราะปุ่มที่เรียกมันอยู่หลังหน้าล็อกอิน เพิ่ม action ใหม่
 *    เมื่อไหร่ต้องเช็ค hasSession() เองทุกครั้ง — มีเทสใน session.itest.ts
 *    ที่ยิง action โดยไม่ล็อกอินแล้วยืนยันว่าไม่มีอะไรถูกเขียนลงฐาน
 */

const COOKIE_NAME = "ledger_session";

/**
 * อายุของ session — 1 วัน
 *
 * สั้นแบบนี้แลกความสะดวกกับความปลอดภัย: ถ้าเครื่องหายหรือถูกหยิบไปใช้
 * คนที่ได้เครื่องไปจะเข้าได้ไม่เกินหนึ่งวัน แลกกับที่คนใช้งานต้องกรอก PIN
 * ใหม่ทุกวัน ซึ่งรับได้เพราะ PIN สั้นและหน้าล็อกอินมีแป้นตัวเลขให้กดเลย
 *
 * ตัวเลขนี้คุมสองที่พร้อมกัน คือวันหมดอายุที่เซ็นอยู่ใน token
 * และ maxAge ของ cookie จึงไม่มีทางที่สองค่านี้จะไม่ตรงกัน
 */
const MAX_AGE_SECONDS = 60 * 60 * 24;

const secret = new TextEncoder().encode(env.AUTH_SECRET);

/**
 * เทียบ PIN แบบ constant-time
 *
 * ถ้าเทียบด้วย === ธรรมดา เวลาที่ใช้จะสั้นยาวตามจำนวนตัวอักษรที่ตรงกัน
 * ซึ่งวัดได้จากภายนอกและใช้เดา PIN ทีละหลักได้ hash ก่อนเทียบเพื่อให้
 * ทั้งสองฝั่งยาวเท่ากันเสมอ timingSafeEqual จึงไม่โยน error เวลาความยาวต่างกัน
 */
export function verifyPin(input: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(env.APP_PIN, "utf8").digest();
  return timingSafeEqual(a, b);
}

type SessionPayload = { v: 1 };

/** ออก session ใหม่แล้วเซ็ต cookie — เรียกหลัง verifyPin ผ่านเท่านั้น */
export async function createSession(): Promise<void> {
  const token = await new SignJWT({ v: 1 } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript ฝั่ง browser อ่านไม่ได้ กัน XSS ขโมย session
    secure: env.NODE_ENV === "production",
    sameSite: "lax", // กัน CSRF ระดับหนึ่ง โดยที่ลิงก์จากภายนอกยังเข้าได้ปกติ
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** true เมื่อ cookie มีอยู่ ลายเซ็นถูกต้อง และยังไม่หมดอายุ */
export async function hasSession(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    // ลายเซ็นผิด หมดอายุ หรือถูกแก้ — ทุกกรณีถือว่าไม่ได้ล็อกอิน
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  จำกัดจำนวนครั้งที่กรอก PIN ผิด                                     */
/* ------------------------------------------------------------------ */

/**
 * เก็บในหน่วยความจำของ process
 *
 * ข้อจำกัดที่ต้องรู้: ถ้ารันหลาย instance (Vercel serverless) แต่ละ instance
 * นับแยกกัน ตัวเลขจึงหลวมกว่าที่ตั้งไว้ แต่ยังช่วยชะลอการยิงเดา PIN รัวๆ ได้
 * ถ้าต้องการของจริงจังกว่านี้ค่อยขยับไปเก็บใน Postgres หรือ Redis
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function rateLimit(key: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/** ล้างตัวนับหลังล็อกอินสำเร็จ เพื่อไม่ให้คนที่ใช้งานปกติโดนล็อกทีหลัง */
export function clearRateLimit(key: string): void {
  attempts.delete(key);
}

/** กันไม่ให้ Map โตไม่มีที่สิ้นสุดบนเซิร์ฟเวอร์ที่รันค้างไว้นานๆ */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
}, WINDOW_MS).unref?.();
