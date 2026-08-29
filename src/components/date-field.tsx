"use client";

import { useRef } from "react";
import { thaiDate } from "@/lib/date";
import { cn } from "@/lib/cn";

/**
 * ช่องวันที่ที่อ่านเป็นภาษาไทย แต่ยังกดแล้วได้ปฏิทินของเครื่องเหมือนเดิม
 *
 * ปัญหาที่แก้: input type=date แสดงวันตามภาษาของ "เครื่อง" ไม่ใช่ของแอป
 * เครื่องที่ตั้งเป็นอังกฤษจึงโชว์ 08/29/2026 อยู่กลางฟอร์มที่เหลือเป็นไทย
 * และเป็น ค.ศ. ทั้งที่ทุกตัวเลขในแอปเป็น พ.ศ. — อ่านแล้วสะดุดและเสี่ยงอ่านผิด
 * ว่าเดือนกับวันสลับกันหรือเปล่า
 *
 * วิธีแก้คือวางป้ายไทยของเราไว้ข้างบน แล้วซ่อนตัว input จริงเป็นชั้นใส
 * คลุมทับทั้งกล่อง ซึ่งยังกดได้ปกติ — ได้ปฏิทินของ iOS/Android ตัวจริง
 * ที่คนคุ้นมืออยู่แล้ว ไม่ต้องลากปฏิทินจำลองมาทั้งไลบรารี
 *
 * ⚠️ ห้ามเปลี่ยน input ตัวนี้เป็น text แล้วเขียนปฏิทินเอง ค่าที่ส่งออกไป
 *    ต้องเป็น "YYYY-MM-DD" ตามที่ฝั่งเซิร์ฟเวอร์ตรวจ และปฏิทินของเครื่อง
 *    จัดการเรื่องปีอธิกสุรทินกับเขตเวลาให้ถูกอยู่แล้ว
 */
export function DateField({
  value,
  onChange,
  name,
  id,
  label,
  className,
  tone = "plain",
}: {
  value: string;
  onChange: (date: string) => void;
  /** ใส่เมื่ออยู่ในฟอร์มที่ส่งค่าแบบธรรมดา (ไม่ได้ยิงผ่าน JavaScript) */
  name?: string;
  id?: string;
  /** คำอธิบายให้โปรแกรมอ่านหน้าจอ เพราะป้ายที่เห็นเป็นตัวเลขล้วน */
  label: string;
  className?: string;
  /** brand = เป็นตัวเลือกที่กำลังใช้อยู่ ให้เด่นกว่าปุ่มข้างๆ */
  tone?: "plain" | "brand";
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <span
      className={cn(
        "relative flex min-h-touch items-center gap-2 rounded-xl border px-3 transition",
        tone === "brand"
          ? "border-brand bg-brand-soft text-brand"
          : "border-line bg-surface text-ink",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-4 shrink-0", tone === "brand" ? "text-brand" : "text-ink-soft")}
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>

      <span className="num truncate text-sm font-medium">{thaiDate(value)}</span>

      <input
        ref={ref}
        id={id}
        name={name}
        type="date"
        value={value}
        onChange={(e) => {
          // เบราว์เซอร์ส่ง "" มาเมื่อคนกดล้างค่าในปฏิทิน
          // ถ้าปล่อยผ่าน ฟอร์มจะส่งวันว่างไปให้เซิร์ฟเวอร์ปฏิเสธ
          if (e.target.value) onChange(e.target.value);
        }}
        onClick={() => {
          /**
           * สั่งเปิดปฏิทินเองเฉพาะเครื่องที่ใช้เมาส์
           *
           * จอใหญ่คลิกช่องวันที่แล้วปฏิทินไม่เปิดเอง ต้องไปคลิกไอคอนเล็กๆ
           * ซึ่งตอนนี้ถูกซ่อนอยู่ใต้ป้ายไทยของเรา บรรทัดนี้จึงจำเป็น
           *
           * แต่บนมือถือห้ามสั่ง เพราะแตะแล้วปฏิทินของเครื่องเด้งเองอยู่แล้ว
           * สั่งซ้ำเข้าไปตอนที่มันกำลังเปิดคือการไปยุ่งกับ UI ของระบบระหว่าง
           * ทำงาน ซึ่งไม่ได้อะไรเพิ่มเลยแต่มีโอกาสค้าง — และมือถือคือเครื่อง
           * ที่แอปนี้ถูกใช้จริงเกือบร้อยเปอร์เซ็นต์
           *
           * pointer: coarse = นิ้ว ส่วน fine = เมาส์หรือปากกา
           */
          if (window.matchMedia("(pointer: coarse)").matches) return;

          try {
            ref.current?.showPicker();
          } catch {
            // เบราว์เซอร์เก่าที่ไม่รู้จักคำสั่งนี้ — ไอคอนปฏิทินของมันยังกดได้
          }
        }}
        aria-label={label}
        // -inset-px ไม่ใช่ inset-0 — inset-0 วัดจากขอบในของเส้นขอบ ทำให้ขอบ 1px
        // รอบกล่องกดแล้วไม่ติด ซึ่งบนมือถือคือแถบที่นิ้วโป้งโดนบ่อยที่สุด
        className="absolute -inset-px cursor-pointer opacity-0"
      />
    </span>
  );
}
