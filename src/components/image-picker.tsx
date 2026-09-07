"use client";

import { useRef, useState } from "react";
import { shrinkToDataUrl } from "@/lib/image";

/**
 * เลือกรูปร้าน ย่อในเครื่องแล้วส่งไปกับฟอร์มเป็นข้อความ
 *
 * ไม่ได้อัปโหลดไฟล์จริง — รูปถูกย่อเหลือ 128px แล้วแปลงเป็น data URL
 * ส่งไปในช่องข้อความธรรมดาช่องหนึ่งของฟอร์ม จึงไม่ต้องมี endpoint อัปโหลด
 * ไม่ต้องมีที่เก็บไฟล์ และไม่มีไฟล์ค้างเวลาลบร้าน
 *
 * ⚠️ ช่อง input type=file ไม่ได้ตั้ง name ไว้โดยตั้งใจ
 *    ไม่งั้นไฟล์ต้นฉบับขนาดหลายเมกะไบต์จะถูกส่งไปด้วย ทั้งที่เราส่งแค่
 *    รูปที่ย่อแล้วในช่อง hidden ก็พอ
 */
export function ImagePicker({
  name,
  initial,
  label = "รูปร้าน",
}: {
  name: string;
  /** รูปเดิมของร้านนี้ ถ้ามี */
  initial?: string | null;
  label?: string;
}) {
  const [image, setImage] = useState<string | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    setProblem(null);

    const shrunk = await shrinkToDataUrl(file);

    setBusy(false);
    if (!shrunk) {
      setProblem("เปิดไฟล์นี้ไม่ได้ ลองเลือกรูปอื่น");
      return;
    }
    setImage(shrunk);
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>

      {/* ค่าที่ส่งไปกับฟอร์มจริง — ว่างแปลว่าไม่มีรูป */}
      <input type="hidden" name={name} value={image ?? ""} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface-2 transition active:scale-95 disabled:opacity-50"
          aria-label={image ? "เปลี่ยนรูปร้าน" : "เลือกรูปร้าน"}
        >
          {image ? (
            // ไม่ใช้ next/image เพราะเป็น data URL ที่ตัวปรับขนาดภาพทำอะไรไม่ได้อยู่แล้ว
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6 text-ink-soft"
              aria-hidden
            >
              <path d="M3 7h4l2-2h6l2 2h4v12H3z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="min-h-touch rounded-xl border border-line px-3 text-sm font-medium text-ink transition active:scale-95 disabled:opacity-50"
            >
              {busy ? "กำลังย่อรูป" : image ? "เปลี่ยนรูป" : "เลือกรูป"}
            </button>

            {image && (
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setProblem(null);
                  // ล้างช่องไฟล์ด้วย ไม่งั้นเลือกไฟล์เดิมซ้ำแล้ว change ไม่ยิง
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="min-h-touch rounded-xl px-3 text-sm font-medium text-expense transition active:scale-95"
              >
                เอารูปออก
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-ink-soft">
            {problem ?? "ย่อให้อัตโนมัติ ไม่กินเน็ต"}
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
