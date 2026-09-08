"use client";

import { useState } from "react";

/**
 * บันทึกการ์ดสรุปเป็นไฟล์ภาพ
 *
 * ที่ต้องมีเพราะการ์ดสูงกว่าจอ — วัดบนจอ 430x932 ที่มีข้อมูลจริงได้ 1108px
 * เจ้าของร้านจึงแคปทีเดียวไม่พอ ต้องแคปสองครั้งแล้วส่งสองรูป ซึ่งคนรับ
 * ต้องต่อภาพเอาเอง ปุ่มนี้ได้ทั้งการ์ดในไฟล์เดียวไม่ว่าจอจะสูงแค่ไหน
 *
 * ⚠️ ต้องฝังฟอนต์ลงไปในภาพ
 *    แอปนี้ใช้ noto-sans-thai ซึ่งเป็น webfont ภาพที่แปลงออกมาเป็น SVG
 *    ถูกวาดในกรอบที่แยกจากหน้าเว็บ มันจึงมองไม่เห็นฟอนต์ของหน้า
 *    ถ้าไม่ฝัง ตัวหนังสือไทยทั้งภาพจะกลายเป็นฟอนต์สำรองหรือกล่องสี่เหลี่ยม
 *    (html-to-image ฝังให้เองเพราะไฟล์ฟอนต์อยู่โดเมนเดียวกัน)
 *
 * ⚠️ โหลดไลบรารีตอนกดเท่านั้น ไม่ใช่ตอนเปิดหน้า
 *    มันใหญ่กว่าทั้งหน้านี้รวมกัน และคนส่วนใหญ่เปิดหน้านี้มาเพื่อแคปหน้าจอ
 *    เฉยๆ ไม่ได้กดปุ่มนี้ ถ้าโหลดมาตั้งแต่แรกก็เสียเน็ตมือถือฟรีทุกครั้ง
 */
export function SaveImageButton({
  targetId,
  fileName,
}: {
  /** id ของกล่องที่จะแปลงเป็นภาพ */
  targetId: string;
  /** ชื่อไฟล์ ไม่ต้องมีนามสกุล */
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const node = document.getElementById(targetId);
    if (!node) {
      setError("หาการ์ดไม่เจอ");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { toBlob } = await import("html-to-image");

      const blob = await toBlob(node, {
        /**
         * วาดที่ความละเอียดสองเท่า ภาพจึงคมตอนเปิดดูบนจอมือถือความละเอียดสูง
         * ถ้าใช้ค่าปกติ ตัวเลขจะเบลอจนอ่านยากซึ่งเสียจุดประสงค์ของภาพนี้
         */
        pixelRatio: 2,
        // การ์ดมีมุมโค้ง ถ้าไม่ทาพื้นให้ มุมทั้งสี่จะเป็นช่องโปร่งใสสีดำในแชท
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });

      if (!blob) throw new Error("สร้างภาพไม่สำเร็จ");

      const file = new File([blob], `${fileName}.png`, { type: "image/png" });

      /**
       * บนมือถือส่งเข้าแผงแชร์ของเครื่องเลย ไม่ใช่บันทึกลงเครื่องก่อน
       *
       * เพราะสิ่งที่เจ้าของร้านทำต่อคือส่งเข้าไลน์ ถ้าดาวน์โหลดอย่างเดียว
       * ต้องเปิดคลังภาพแล้วหาไฟล์เอง แผงแชร์ตัดขั้นตอนนั้นทิ้งทั้งหมด
       * และยังมีปุ่ม "บันทึกภาพ" อยู่ในแผงนั้นสำหรับคนที่อยากเก็บลงเครื่อง
       */
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      // เดสก์ท็อปหรือเบราว์เซอร์ที่ไม่มีแผงแชร์ — โหลดลงเครื่องตรงๆ
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // กดยกเลิกที่แผงแชร์ไม่ใช่ความผิดพลาด ไม่ต้องขึ้นข้อความอะไร
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("บันทึกภาพไม่สำเร็จ ลองแคปหน้าจอแทนได้");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="-mr-1 flex min-h-touch shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-white transition hover:bg-white/10 active:bg-white/15 disabled:opacity-60"
      >
        {busy ? (
          <span
            className="size-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 shrink-0"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        )}
        {busy ? "กำลังสร้างภาพ" : "บันทึกภาพ"}
      </button>

      {/**
       * ข้อความผิดพลาดวางลอยใต้แถบหัว ไม่ได้อยู่ในแถบ
       *
       * ถ้าใส่ไว้ในแถบ มันจะดันให้แถบสูงขึ้นแล้วเนื้อหาทั้งหน้าขยับตาม
       * ซึ่งอ่านเหมือนหน้าเว็บพัง แบบนี้แถบยังสูงเท่าเดิม ข้อความมาทับข้างล่าง
       *
       * ต้องเห็นด้วยตาจริงๆ ไม่ใช่แค่ sr-only — ถ้าบันทึกภาพไม่สำเร็จแล้ว
       * ไม่มีอะไรขึ้นเลย เจ้าของร้านจะกดซ้ำไปเรื่อยๆ โดยไม่รู้ว่าเกิดอะไรขึ้น
       */}
      {error && (
        <p
          role="alert"
          className="absolute inset-x-0 top-full bg-expense px-4 py-2 text-center text-xs font-medium text-white shadow-sm"
        >
          {error}
        </p>
      )}
    </>
  );
}
