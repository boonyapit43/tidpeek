"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * รายการที่ลากสลับลำดับได้ด้วยนิ้ว
 *
 * ⚠️ ห้ามใช้ HTML5 drag and drop (draggable, ondragstart)
 *    Safari บน iOS ไม่ยิงเหตุการณ์ชุดนั้นจากการแตะเลย มันทำงานเฉพาะกับเมาส์
 *    บนเดสก์ท็อป ถ้าเขียนด้วยของชุดนั้น มันจะดูเหมือนใช้ได้ตอนทดสอบบน
 *    คอมพิวเตอร์ แล้วไม่ขยับเลยบนเครื่องที่เจ้าของร้านใช้จริง
 *
 *    Pointer Events ครอบทั้งนิ้ว เมาส์ และปากกา ด้วยโค้ดชุดเดียว
 *
 * ⚠️ ปุ่มลากต้องมี touch-action: none
 *    ไม่งั้น Safari ตีความการลากขึ้นลงว่าเป็นการเลื่อนหน้าจอ แล้วยึดนิ้วไป
 *    ทั้งท่า — แถวจะไม่ขยับตามและหน้าจอเลื่อนแทน ซึ่งเป็นอาการที่ดูเหมือน
 *    ฟีเจอร์พังมากกว่าดูเหมือนตั้งค่าผิด
 *
 * ⚠️ ลากได้เฉพาะที่ปุ่มขีดสามขีด ไม่ใช่ทั้งแถว
 *    แถวในแอปนี้แตะแล้วเข้าหน้ารายละเอียด ถ้าลากได้ทั้งแถวจะต้องเดาทุกครั้ง
 *    ว่านี่คือแตะหรือเริ่มลาก และนิ้วที่เปื้อนน้ำมันหน้าร้านจะสลับลำดับ
 *    โดยไม่ตั้งใจตอนเลื่อนหน้าจอ
 *
 * ลูกศรขึ้นลงก็ย้ายได้ สำหรับคนที่ใช้คีย์บอร์ดหรือโปรแกรมอ่านหน้าจอ
 * ซึ่งลากไม่ได้เลย ถ้ามีแต่การลาก ฟีเจอร์นี้จะใช้ไม่ได้กับคนกลุ่มนั้นทั้งหมด
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
  labelOf,
}: {
  items: T[];
  /** เรียกเมื่อลำดับนิ่งแล้ว — ได้ id เรียงตามลำดับใหม่ทั้งชุด */
  onReorder: (ids: string[]) => void;
  renderRow: (item: T, dragging: boolean) => React.ReactNode;
  /** ชื่อของแถว ใช้บอกโปรแกรมอ่านหน้าจอว่ากำลังย้ายอะไรไปตำแหน่งไหน */
  labelOf: (item: T) => string;
}) {
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  /**
   * ปรับ state ตอน render เมื่อรายการจากเซิร์ฟเวอร์เปลี่ยน
   *
   * วิธีที่ React แนะนำสำหรับ "แก้ state เมื่อ props เปลี่ยน" — React ทิ้งผล
   * ของ render รอบนี้แล้วเริ่มใหม่ทันทีโดยยังไม่วาดลงจอ จึงไม่มีภาพกระพริบ
   * ต่างจากการทำใน effect ที่วาดของเก่าลงจอไปแล้วรอบหนึ่งก่อน
   */
  const incoming = items.map((i) => i.id).join(",");
  const [seen, setSeen] = useState(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    // ระหว่างลากอยู่ห้ามรับของใหม่มาทับ ไม่งั้นแถวจะกระตุกกลับใต้นิ้ว
    if (dragId === null) setOrder(items.map((i) => i.id));
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = order.map((id) => byId.get(id)).filter((i): i is T => i !== undefined);

  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  /** ลำดับตอนเริ่มลาก ใช้ดูว่าจบแล้วเปลี่ยนจริงไหม จะได้ไม่ยิงคำสั่งเปล่า */
  const orderAtDragStart = useRef<string[]>([]);

  const moveTo = (from: number, to: number) => {
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // กันไม่ให้เบราว์เซอร์เริ่มท่าเลื่อนหน้าจอหรือเลือกข้อความแทน
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    orderAtDragStart.current = order;
    setDragId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragId === null) return;

    const from = order.indexOf(dragId);
    if (from < 0) return;

    /**
     * หาตำแหน่งใหม่จากการเทียบนิ้วกับ "กึ่งกลางแถว" ไม่ใช่ขอบแถว
     *
     * ใช้ขอบแล้วแถวจะสลับตั้งแต่นิ้วเพิ่งแตะขอบบนสุด แล้วสลับกลับทันที
     * ที่ขยับนิดเดียว กลายเป็นสั่นไปมา กึ่งกลางทำให้ต้องลากผ่านครึ่งแถว
     * จริงๆ ถึงจะสลับ ซึ่งเป็นพฤติกรรมเดียวกับรายการของ iOS
     */
    const y = e.clientY;
    let to = from;

    for (let i = 0; i < order.length; i++) {
      const el = rowRefs.current.get(order[i]);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      const middle = box.top + box.height / 2;

      if (i < from && y < middle) {
        to = i;
        break;
      }
      if (i > from && y > middle) to = i;
    }

    if (to !== from) setOrder(moveTo(from, to));
  };

  const handlePointerUp = () => {
    if (dragId === null) return;
    setDragId(null);

    const changed = order.join(",") !== orderAtDragStart.current.join(",");
    if (changed) onReorder(order);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;

    const from = order.indexOf(id);
    const to = from + step;
    if (to < 0 || to >= order.length) return;

    e.preventDefault();
    const next = moveTo(from, to);
    setOrder(next);
    onReorder(next);

    const item = byId.get(id);
    if (item) setAnnounce(`${labelOf(item)} ย้ายไปลำดับที่ ${to + 1} จาก ${order.length}`);
  };

  return (
    <>
      {/* บอกโปรแกรมอ่านหน้าจอว่าเกิดอะไรขึ้น การขยับของแถวไม่ได้ถูกอ่านเอง */}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      <ul className="divide-y divide-line">
        {rows.map((item) => {
          const dragging = dragId === item.id;

          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
              className={cn(
                "flex items-center gap-1 bg-surface transition-shadow",
                // ตัวที่กำลังลากยกขึ้นมาด้วยเงา ไม่ใช่เปลี่ยนสี
                // เพื่อไม่ให้ชนกับสีรับเข้า/จ่ายออกที่มีความหมายอยู่แล้ว
                dragging && "relative z-10 shadow-lg",
              )}
            >
              <div className="min-w-0 flex-1">{renderRow(item, dragging)}</div>

              <button
                type="button"
                aria-label={`ย้ายลำดับของ ${labelOf(item)} — ใช้ลูกศรขึ้นลงได้`}
                onPointerDown={(e) => handlePointerDown(e, item.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                /**
                 * touch-action เขียนเป็น inline ไม่ใช่คลาสยูทิลิตี้
                 *
                 * ⚠️ อย่าย้ายไปเป็นคลาส touch-none
                 *    ลองมาแล้วแล้วไม่ทำงาน — Tailwind ไม่ได้สร้างกฎของคลาสนั้น
                 *    ออกมาเลย (ตรวจด้วยการไล่ทุก stylesheet ในหน้าจริง ไม่เจอกฎ
                 *    ที่มีคำว่า touch- สักอัน) ค่าที่ปุ่มได้จึงตกไปเป็น
                 *    manipulation จากกฎรวมใน globals.css
                 *
                 *    ผลของการพลาดตรงนี้คือลากแล้วหน้าจอเลื่อนแทนที่แถวจะขยับ
                 *    ซึ่งเห็นเฉพาะบนเครื่องที่ใช้นิ้ว ไม่เห็นบนเดสก์ท็อป
                 *    inline style ชนะทุกกฎเสมอและไม่มีขั้นตอน build ไหนลบได้
                 */
                style={{ touchAction: "none" }}
                className="flex size-11 shrink-0 cursor-grab items-center justify-center text-ink-soft active:cursor-grabbing"
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
                  <path d="M4 9h16M4 15h16" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
