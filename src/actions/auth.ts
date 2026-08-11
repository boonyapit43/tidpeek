"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearRateLimit,
  createSession,
  destroySession,
  rateLimit,
  verifyPin,
} from "@/lib/auth";
import { forgetShop } from "@/lib/shop";
import { pinSchema } from "@/lib/validation";
import { type ActionState, failed, formObject, invalid } from "./shared";

/**
 * หา IP ของคนที่ยิงเข้ามา ใช้เป็นกุญแจนับจำนวนครั้งที่กรอกรหัสผิด
 *
 * ค่าจาก header ปลอมได้ ถ้าไม่มี proxy ที่เชื่อถือได้อยู่หน้าแอป ตัวนับ
 * จึงเป็นแค่การชะลอ ไม่ใช่การกันแบบเด็ดขาด แต่ก็ยังดีกว่าปล่อยให้ยิงเดารัวๆ
 * ได้ไม่จำกัด บน Vercel และหลัง nginx ที่ตั้ง proxy_set_header ไว้ ค่านี้เชื่อถือได้
 */
async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = pinSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const key = await clientKey();
  const limit = rateLimit(key);

  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return failed(`กรอกรหัสผิดหลายครั้งเกินไป ลองใหม่ในอีก ${minutes} นาที`);
  }

  if (!verifyPin(parsed.data.pin)) {
    // ข้อความเดียวกันทุกกรณี ไม่บอกว่ารหัสสั้นไปหรือผิดตรงไหน
    return failed("รหัสไม่ถูกต้อง");
  }

  clearRateLimit(key);
  await createSession();

  // ไปหน้าเลือกร้านก่อนเสมอ ไม่พาเข้าร้านล่าสุดให้เอง
  // เพราะ "กำลังบันทึกลงร้านไหน" เป็นสิ่งที่ผิดไม่ได้ในแอปบัญชี
  //
  // redirect โยน error ออกมาเพื่อสั่งให้ Next.js เปลี่ยนหน้า
  // จึงต้องอยู่นอก try/catch ทุกกรณี ไม่งั้นจะถูกกลืนแล้วหน้าไม่เปลี่ยน
  redirect("/shops");
}

export async function logout(): Promise<void> {
  await destroySession();
  // ลืมร้านที่เลือกไว้ด้วย คนถัดไปที่ล็อกอินจะได้เริ่มที่หน้าเลือกร้านเสมอ
  await forgetShop();
  redirect("/login");
}
