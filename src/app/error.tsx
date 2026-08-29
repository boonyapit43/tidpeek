"use client";

import { useEffect } from "react";

/**
 * หน้าที่ขึ้นแทนเมื่อการ render ฝั่งเซิร์ฟเวอร์ล้มเหลว
 *
 * ก่อนมีไฟล์นี้ ถ้าต่อฐานข้อมูลไม่ติดสักครั้ง คนใช้จะเจอหน้าขาวเปล่าๆ
 * หรือข้อความภาษาอังกฤษที่ไม่บอกอะไร แล้วไม่รู้ว่าต้องทำอะไรต่อ
 *
 * ฐานข้อมูลอยู่คนละประเทศและร้านใช้ผ่านเน็ตมือถือ การต่อไม่ติดเป็นครั้งคราว
 * จึงเป็นเรื่องปกติที่ต้องรับมือ ไม่ใช่กรณียกเว้นที่ปล่อยผ่านได้
 *
 * error.tsx ต้องเป็น client component เสมอ เพราะต้องมีปุ่มให้กดลองใหม่
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // digest คือรหัสที่ Next.js ผูกไว้กับ error จริงในล็อกฝั่งเซิร์ฟเวอร์
    // เนื้อหา error ตัวจริงไม่ถูกส่งมาถึง browser เพื่อไม่ให้ข้อมูลภายในรั่ว
    console.error("[render]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-expense-soft">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7 text-expense"
          aria-hidden
        >
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>

      <div>
        <h1 className="text-lg font-bold text-ink">เปิดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          ส่วนใหญ่เกิดจากสัญญาณเน็ตสะดุด
          <br />
          ข้อมูลที่บันทึกไว้แล้วยังอยู่ครบ
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={reset}
          className="bg-brand-gradient min-h-touch w-full rounded-xl font-semibold text-on-accent shadow-md shadow-brand/25 transition active:scale-[0.98]"
        >
          ลองใหม่
        </button>

        {/* ลิงก์จริงไม่ใช่ปุ่ม JavaScript เพราะถ้าฝั่ง client พังจนกดปุ่มไม่ได้
            ลิงก์ยังพาออกจากหน้านี้ได้อยู่ */}
        <a
          href="/shops"
          className="flex min-h-touch w-full items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium text-ink-soft transition active:scale-[0.98]"
        >
          กลับไปหน้าเลือกร้าน
        </a>
      </div>

      {error.digest && (
        <p className="num text-[11px] text-ink-soft">รหัสอ้างอิง {error.digest}</p>
      )}
    </main>
  );
}
