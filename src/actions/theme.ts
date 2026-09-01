"use server";

import { rememberTheme, type Theme } from "@/lib/theme";

/**
 * จำธีมที่คนกดเลือก
 *
 * ไม่ต้องตรวจ session เหมือน action อื่น เพราะไม่แตะข้อมูลของร้านเลย
 * แค่จำว่าคนที่ถือเบราว์เซอร์นี้ชอบพื้นสว่างหรือพื้นเข้ม ยิงมั่วได้อย่างมาก
 * ก็แค่เปลี่ยนสีจอตัวเอง
 *
 * ไม่ revalidate ด้วย เพราะฝั่งหน้าจอสลับ data-theme ให้ทันทีตอนกดอยู่แล้ว
 * ตัวนี้มีหน้าที่เดียวคือทำให้การเปิดครั้งหน้าได้ธีมเดิม
 */
export async function saveTheme(theme: Theme): Promise<void> {
  if (theme !== "light" && theme !== "dark") return;
  await rememberTheme(theme);
}
