"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/form-parts";
import type { Direction } from "@/db/schema";
import { cn } from "@/lib/cn";

/**
 * ช่องค้นหา + ตัวกรองฝั่งเงิน
 *
 * ส่งเป็น <form method="get"> จริง ไม่ใช่ค้นหาสดขณะพิมพ์
 *
 * เหตุผล: ฐานข้อมูลอยู่คนละประเทศ การยิงทุกตัวอักษรที่พิมพ์จะได้คำขอ
 * สิบกว่าครั้งต่อคำค้นหนึ่งคำ เปลืองทั้งเน็ตมือถือและโควตาของโฮสต์
 * โดยที่ผลลัพธ์ระหว่างทางแทบไม่มีใครอ่าน กดค้นหาทีเดียวจบตรงกว่า
 *
 * แป้นมือถือจะขึ้นปุ่ม "ค้นหา" ให้เอง เพราะ enterKeyHint กับ type=search
 */
export function SearchBox({
  defaultQuery,
  direction,
}: {
  defaultQuery: string;
  direction?: Direction;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  /** เปลี่ยนตัวกรองแล้วค้นใหม่ทันที โดยคงคำค้นเดิมไว้ */
  function filterBy(next?: Direction) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (next) params.set("d", next);
    router.push(`/search?${params}`);
  }

  const filters = [
    { key: undefined, label: "ทั้งหมด" },
    { key: "in" as const, label: "รับเข้า" },
    { key: "out" as const, label: "จ่ายออก" },
  ];

  return (
    <div className="space-y-2.5 rounded-2xl bg-surface p-3 shadow-sm">
      <form action="/search" className="flex gap-2">
        {/* ตัวกรองเดินทางไปกับฟอร์มด้วย ไม่งั้นกดค้นหาแล้วตัวกรองจะหลุด */}
        {direction && <input type="hidden" name="d" value={direction} />}

        <label htmlFor="q" className="sr-only">
          ค้นหารายการ
        </label>
        <Input
          id="q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ชื่อรายการ หมายเหตุ หรือประเภท"
          enterKeyHint="search"
          autoFocus={defaultQuery === ""}
          className="flex-1"
        />

        <button
          type="submit"
          aria-label="ค้นหา"
          className="bg-brand-gradient flex min-h-touch w-12 shrink-0 items-center justify-center rounded-xl text-on-accent shadow-md shadow-brand/25 transition active:scale-95"
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
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
      </form>

      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-2 p-1.5">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={direction === f.key}
            onClick={() => filterBy(f.key)}
            className={cn(
              "min-h-touch rounded-lg text-sm font-semibold transition",
              direction === f.key ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
