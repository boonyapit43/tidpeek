"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { monthOf, weekOf, yearOf } from "@/lib/date";

export type SummaryView = "day" | "week" | "month" | "year";

/**
 * แตะที่ชื่อช่วงเวลาแล้วกระโดดไปช่วงไหนก็ได้
 *
 * เดิมมีแต่ลูกศรเลื่อนทีละช่วง ซึ่งใช้ได้กับการดูย้อนหลังไม่กี่ช่วง แต่พอ
 * อยากย้อนไปปี 2567 ต้องกดลูกศรเป็นสิบๆ ครั้ง — เจ้าของร้านเจอจริง
 *
 * ใช้ปฏิทินของเครื่องตัวเดียวกับที่ฟอร์มบันทึกใช้ ไม่ลากปฏิทินจำลองมาทั้ง
 * ไลบรารี และเลือกวันไหนก็ได้ในช่วงที่อยากไป — มุมมองสัปดาห์เลือกวันพุธ
 * ก็พาไปสัปดาห์นั้น มุมมองปีเลือกวันไหนของปีนั้นก็ได้ ไม่ต้องหาวันที่ถูก
 *
 * ⚠️ ป้ายที่เห็นเป็นภาษาไทย ส่วน input จริงเป็นชั้นใสคลุมทับ เพราะ
 *    input type=date แสดงวันตามภาษาของเครื่อง ไม่ใช่ของแอป — เครื่องที่
 *    ตั้งเป็นอังกฤษจะโชว์ 08/29/2026 เป็น ค.ศ. กลางหน้าที่เหลือเป็น พ.ศ.
 *    (เทคนิคเดียวกับ DateField ในฟอร์มบันทึก)
 */
export function PeriodJump({
  view,
  anchor,
  label,
  sublabel,
}: {
  view: SummaryView;
  /** วันที่ในช่วงที่ดูอยู่ ใช้เปิดปฏิทินให้ตรงที่ ไม่ใช่เปิดที่วันนี้ */
  anchor: string;
  label: string;
  sublabel?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="relative min-w-0 flex-1 text-center">
      <div className="truncate text-sm font-semibold text-ink">
        {label}
        {/* ลูกศรลงเล็กๆ บอกว่าตรงนี้กดได้ ไม่ใช่ข้อความเฉยๆ */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-1 inline-block size-3 align-baseline text-ink-soft"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {sublabel && <div className="truncate text-xs text-ink-soft">{sublabel}</div>}

      <input
        ref={ref}
        type="date"
        value={anchor}
        onChange={(e) => {
          // เบราว์เซอร์ส่ง "" มาเมื่อคนกดล้างค่าในปฏิทิน — ไม่ใช่การเลือกช่วง
          if (e.target.value) router.push(hrefFor(view, e.target.value));
        }}
        onClick={() => {
          /**
           * สั่งเปิดปฏิทินเองเฉพาะเครื่องที่ใช้เมาส์
           *
           * บนมือถือแตะแล้วปฏิทินเด้งเองอยู่แล้ว สั่งซ้ำคือไปยุ่งกับ UI ของ
           * ระบบระหว่างทำงาน ไม่ได้อะไรเพิ่มแต่มีโอกาสค้าง
           * (เหตุผลเต็มอยู่ที่ DateField)
           */
          if (window.matchMedia("(pointer: coarse)").matches) return;

          try {
            ref.current?.showPicker();
          } catch {
            // เบราว์เซอร์เก่าที่ไม่รู้จักคำสั่งนี้ — ไอคอนปฏิทินของมันยังกดได้
          }
        }}
        aria-label="เลือกช่วงเวลาที่จะดู"
        className="absolute -inset-px cursor-pointer opacity-0"
      />
    </div>
  );
}

/**
 * วันที่ที่เลือก → ที่อยู่ของช่วงที่ครอบวันนั้น
 *
 * แยกออกมาเพื่อให้เทสได้ตรงๆ — ผิดตรงนี้แล้วกดเลือกวันแล้วไปโผล่คนละช่วง
 * ซึ่งเป็นอาการที่คนโทษว่าปฏิทินเพี้ยน ทั้งที่ปฏิทินส่งค่าถูก
 */
export function hrefFor(view: SummaryView, date: string): string {
  if (view === "day") return `/summary?p=day&d=${date}`;
  if (view === "week") return `/summary?p=week&w=${weekOf(date)}`;
  if (view === "month") return `/summary?p=month&m=${monthOf(date)}`;
  return `/summary?p=year&y=${yearOf(date)}`;
}
