"use client";

import { useEffect, useState } from "react";

/**
 * อ่านค่าจริงจากเครื่องแล้วพิมพ์ออกมาให้เห็น
 *
 * ทุกบรรทัดในนี้คือตัวเลขที่ตอบคำถามว่า "ทำไมแถบเมนูไม่ชนขอบล่าง"
 * ถ้า env(safe-area-inset-bottom) เป็น 0 แปลว่า viewport-fit ไม่ทำงาน
 * ถ้าไม่เป็น 0 แต่แถบยังไม่ชนขอบ แปลว่ามีอย่างอื่นดันอยู่
 */
type Row = { ชื่อ: string; ค่า: string; หมายเหตุ?: string };

export function ViewportReadout() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [barBottom, setBarBottom] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const probe = document.getElementById("inset-probe");
      const cs = probe ? getComputedStyle(probe) : null;

      const dvh = document.createElement("div");
      dvh.style.cssText = "position:absolute;height:100dvh;visibility:hidden;pointer-events:none";
      document.body.appendChild(dvh);
      const dvhPx = dvh.getBoundingClientRect().height;
      dvh.remove();

      const bar = document.getElementById("bottom-bar");
      setBarBottom(bar ? Math.round(bar.getBoundingClientRect().bottom) : null);

      setRows([
        {
          ชื่อ: "โหมดที่เปิดอยู่",
          ค่า: window.matchMedia("(display-mode: standalone)").matches
            ? "standalone (เปิดจากไอคอนหน้าโฮม)"
            : "browser (เปิดใน Safari)",
          หมายเหตุ: "ถ้าเป็น browser ตัวเลขข้างล่างจะไม่มีความหมาย",
        },
        { ชื่อ: "innerHeight", ค่า: `${window.innerHeight}` },
        { ชื่อ: "screen.height", ค่า: `${window.screen.height}` },
        {
          ชื่อ: "visualViewport",
          ค่า: window.visualViewport
            ? `${Math.round(window.visualViewport.height)} (offsetTop ${Math.round(window.visualViewport.offsetTop)})`
            : "ไม่มี",
        },
        { ชื่อ: "100dvh", ค่า: `${Math.round(dvhPx)}` },
        {
          ชื่อ: "safe-area บน",
          ค่า: cs ? cs.paddingTop : "?",
          หมายเหตุ: "ควรราว 59-62px บนเครื่องที่มีรอยบาก",
        },
        {
          ชื่อ: "safe-area ล่าง",
          ค่า: cs ? cs.paddingBottom : "?",
          หมายเหตุ: "0px = viewport-fit ไม่ทำงาน · ~34px = ทำงาน",
        },
        {
          ชื่อ: "innerHeight เทียบ screen",
          ค่า: `ต่างกัน ${window.screen.height - window.innerHeight}`,
          หมายเหตุ: "0 = เต็มจอ · มากกว่า 0 = มีส่วนที่เว็บเข้าไม่ถึง",
        },
      ]);
    };

    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  return (
    <main className="min-h-dvh bg-surface-2 p-4 pb-40 text-ink">
      {/* กล่องล่องหนที่รับค่า env() มาให้อ่าน */}
      <div
        id="inset-probe"
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          pointerEvents: "none",
          visibility: "hidden",
        }}
      />

      <h1 className="mb-1 text-lg font-bold">ตรวจขนาดจอ</h1>
      <p className="mb-4 text-sm text-ink-soft">แคปหน้านี้ทั้งจอส่งมาให้ผมดู</p>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        {rows === null ? (
          <p className="p-4 text-sm text-ink-soft">กำลังอ่านค่า…</p>
        ) : (
          rows.map((r) => (
            <div key={r.ชื่อ} className="border-b border-line px-4 py-2.5 last:border-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink-soft">{r.ชื่อ}</span>
                <span className="num text-sm font-bold">{r.ค่า}</span>
              </div>
              {r.หมายเหตุ && <p className="mt-0.5 text-[11px] text-ink-soft">{r.หมายเหตุ}</p>}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm">
        <p className="text-sm font-semibold">แถบจำลองข้างล่าง</p>
        <p className="mt-1 text-xs text-ink-soft">
          แถบสีเขียวข้างล่างวางแบบเดียวกับแถบเมนูจริงเป๊ะ ถ้ามันชนขอบจอ
          แปลว่าปัญหาอยู่ที่แถบเมนู ถ้ามันลอยเหมือนกัน แปลว่าปัญหาอยู่ที่ระบบ
        </p>
        <p className="num mt-2 text-sm font-bold">
          ขอบล่างของแถบเขียวอยู่ที่ {barBottom ?? "?"} · จอสูง{" "}
          {typeof window === "undefined" ? "?" : window.innerHeight}
        </p>
      </div>

      {/* แถบจำลอง วางเหมือนแถบเมนูจริงทุกอย่าง */}
      <div
        id="bottom-bar"
        className="fixed inset-x-0 bottom-0 z-40 bg-income pb-[env(safe-area-inset-bottom)] text-center text-xs font-bold text-white"
      >
        <div className="py-3">แถบนี้ควรชนขอบล่างของจอพอดี</div>
      </div>
    </main>
  );
}
