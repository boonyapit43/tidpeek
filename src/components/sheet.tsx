"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

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

  useEffect(() => {
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
        "md:m-auto md:px-4",
      )}
    >
      <div
        className={cn(
          "animate-slide-up rounded-t-2xl bg-surface p-5 shadow-xl md:rounded-2xl",
          // เว้นที่ให้แถบ home ของ iPhone
          "pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5",
          // จำกัดความสูงแล้วให้เลื่อนข้างใน กันแผ่นล้นจอเมื่อคีย์บอร์ดเด้งขึ้น
          "max-h-[85dvh] overflow-y-auto",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="-mr-1.5 flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-2"
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
