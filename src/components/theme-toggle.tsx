"use client";

import { useState, useSyncExternalStore } from "react";
import { saveTheme } from "@/actions/theme";
import type { Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * ธีมที่เครื่องตั้งไว้ อ่านสดและตามการเปลี่ยนแปลงระหว่างใช้งาน
 *
 * ใช้ useSyncExternalStore ไม่ใช่ effect+setState เพราะค่านี้คือสถานะของ
 * ระบบข้างนอก React ไม่ใช่สถานะของคอมโพเนนต์ — คนที่ตั้งมือถือให้สลับธีม
 * อัตโนมัติตอนพระอาทิตย์ตกจะเห็นไอคอนเปลี่ยนตามเองโดยไม่ต้องรีเฟรช
 *
 * ฝั่งเซิร์ฟเวอร์ตอบ false ไว้ก่อน (= สว่าง) ซึ่งถูกสำหรับคนส่วนใหญ่
 * เดาผิดก็แค่ไอคอนสลับหลังโหลดเสร็จ ไม่ใช่ทั้งหน้ากระพริบ
 */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DARK_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

/**
 * ปุ่มสลับพื้นสว่าง–พื้นเข้ม อยู่บนแถบหัวแอป
 *
 * สลับ data-theme บน <html> ทันทีที่กด ไม่รอเซิร์ฟเวอร์ เพราะการเปลี่ยนสี
 * ต้องรู้สึกว่าเกิดขึ้นเดี๋ยวนั้น ส่วน server action ที่ยิงตามไปมีหน้าที่เดียว
 * คือจำไว้ให้การเปิดครั้งหน้าได้ธีมเดิม
 */
export function ThemeToggle({ saved }: { saved: Theme | null }) {
  const [chosen, setChosen] = useState<Theme | null>(saved);
  const systemDark = useSystemDark();

  // ยังไม่เคยกด = ตามเครื่อง พอกดแล้วค่าที่เลือกทับค่าของเครื่องตลอดไป
  const current: Theme = chosen ?? (systemDark ? "dark" : "light");
  const next: Theme = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        setChosen(next);
        // ไม่ await — จอเปลี่ยนไปแล้ว ที่เหลือเป็นการจำไว้เฉยๆ
        void saveTheme(next);
      }}
      aria-label={next === "dark" ? "เปลี่ยนเป็นพื้นเข้ม" : "เปลี่ยนเป็นพื้นสว่าง"}
      className="flex size-11 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 active:bg-white/15"
    >
      {next === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden {...stroke}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
