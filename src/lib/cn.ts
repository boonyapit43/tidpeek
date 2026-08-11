import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * รวม class ของ Tailwind โดยให้ตัวที่ส่งทีหลังชนะ
 *
 * ถ้าใช้ template string ธรรมดา แล้วมี "p-2" กับ "p-4" อยู่ด้วยกัน
 * ผลลัพธ์จะขึ้นกับลำดับใน CSS ที่ build ออกมา ไม่ใช่ลำดับที่เขียน
 * twMerge ตัดตัวที่ชนกันทิ้งให้ ผลจึงคาดเดาได้
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
