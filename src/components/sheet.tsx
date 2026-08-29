"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * บนเบราว์เซอร์ใช้ useLayoutEffect บนเซิร์ฟเวอร์ใช้ useEffect
 *
 * ต้องเป็น layout effect เพราะการเปิดปิด <dialog> ต้องเกิด "ก่อน" เบราว์เซอร์
 * วาดเฟรมถัดไป เนื้อหาข้างในแผ่นถูก unmount พร้อมกับที่สั่งปิด ถ้าใช้
 * useEffect ธรรมดาซึ่งทำงานหลังวาดจอ จะเห็นแผ่นเปล่าแวบหนึ่งก่อนหายไป
 *
 * ที่ต้องสลับเป็น useEffect บนเซิร์ฟเวอร์ เพราะ React เตือนว่า useLayoutEffect
 * ไม่มีความหมายตอน render ฝั่งเซิร์ฟเวอร์ ซึ่ง Next.js ทำกับ client component
 * ทุกตัวอยู่แล้ว
 */
const useDialogEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * แผ่นเลื่อนขึ้นจากขอบล่าง ใช้แทน modal กลางจอ
 *
 * สร้างบน <dialog> ของเบราว์เซอร์ ไม่ได้ทำเอง เพราะ showModal() แถม
 * พฤติกรรมที่ถ้าเขียนเองต้องไล่ทำทีละอย่างและมักตกหล่น
 *   • ขังโฟกัสไว้ข้างใน กด Tab แล้ววนอยู่ในแผ่น ไม่หลุดไปหลังฉาก
 *   • ปุ่ม Esc ปิดให้เอง
 *   • ส่วนที่อยู่ข้างหลังถูกซ่อนจากโปรแกรมอ่านหน้าจออัตโนมัติ
 *
 * ที่เลือกเป็นแผ่นล่างแทนกล่องกลางจอเพราะบนมือถือ เนื้อหาจะอยู่ใกล้นิ้วโป้ง
 * และไม่ถูกคีย์บอร์ดที่เด้งขึ้นมาดันจนล้นจอ
 *
 * ⚠️ ต้องวางเป็นพี่น้องกับ <form> หลัก ห้ามวางซ้อนใน <form> เด็ดขาด
 *    HTML ไม่อนุญาตให้ form ซ้อน form และเบราว์เซอร์จะตัดตัวในทิ้งเงียบๆ
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useDialogEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // ปุ่ม Esc ยิง cancel ส่วนการกดฉากหลังยิง close ผ่าน handler ข้างล่าง
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // กดที่ฉากหลังแล้วปิด — เช็คว่าคลิกโดน element ของ dialog เอง
      // ซึ่งกินพื้นที่เต็มจอ ส่วนเนื้อหาจริงอยู่ใน div ข้างในที่กันคลิกไว้
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto w-full max-w-lg bg-transparent p-0 backdrop:bg-black/40",
        /**
         * แอนิเมชันเลื่อนขึ้นอยู่ที่ตัว dialog ไม่ใช่กล่องเนื้อหาข้างใน
         *
         * เดิมใส่ไว้ที่กล่องข้างใน ซึ่งตอนเริ่มจะถูกเลื่อนลง 8px แล้วล้นออก
         * นอกกรอบของ dialog พอบวกกับที่เบราว์เซอร์ตั้ง overflow:auto ให้
         * dialog มาตั้งแต่ต้น มันเลยกลายเป็นพื้นที่เลื่อนได้ 8px
         * ผลคือแผ่นที่เนื้อหาสั้นๆ กลับเลื่อนได้นิดหน่อยแบบไม่มีเหตุผล
         *
         * ย้ายมาไว้ที่ dialog แล้วทั้งกล่องขยับไปพร้อมกัน ไม่มีอะไรล้นออกมา
         *
         * overflow-hidden กำกับไว้อีกชั้น เพราะตัว dialog ไม่ควรเลื่อนเลย
         * ตัวที่ควรเลื่อนคือกล่องเนื้อหาข้างในที่มี max-h ของตัวเอง
         */
        "animate-slide-up overflow-hidden",
        "md:m-auto md:px-4",
      )}
    >
      <div
        className={cn(
          "rounded-t-2xl bg-surface p-5 shadow-xl md:rounded-2xl",
          // เว้นที่ให้แถบ home ของ iPhone
          "pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5",
          // จำกัดความสูงแล้วให้เลื่อนข้างใน กันแผ่นล้นจอเมื่อคีย์บอร์ดเด้งขึ้น
          "max-h-[85dvh] overflow-y-auto",
          // overscroll-contain กันไม่ให้หน้าข้างหลังเลื่อนตามเมื่อเลื่อนสุดขอบแผ่น
          // ซึ่งบน Safari ของ iOS จะทำให้ทั้งหน้าเด้งไปมาจนแผ่นดูเหมือนจะหลุด
          "overscroll-contain",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="-mr-2.5 flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-5"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </dialog>
  );
}
