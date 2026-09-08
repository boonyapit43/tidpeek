"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * รายการที่จิ้มค้างแล้วลากสลับลำดับได้
 *
 * ไม่มีปุ่มขีดสามขีดให้จับ — จิ้มค้างที่แถวจนมันลอยขึ้น แล้วลาก
 * เป็นท่าเดียวกับการเรียงไอคอนหน้าโฮมของ iOS ซึ่งเป็นท่าที่คนรู้อยู่แล้ว
 * และไม่ต้องมีไอคอนมาเบียดพื้นที่ของชื่อบัญชีกับยอดเงิน
 *
 * ⚠️ ห้ามใช้ HTML5 drag and drop (draggable, ondragstart)
 *    Safari บน iOS ไม่ยิงเหตุการณ์ชุดนั้นจากการแตะเลย มันทำงานเฉพาะกับเมาส์
 *    ถ้าเขียนด้วยของชุดนั้น มันจะดูเหมือนใช้ได้ตอนทดสอบบนคอมพิวเตอร์
 *    แล้วไม่ขยับเลยบนเครื่องที่เจ้าของร้านใช้จริง
 *
 * ⚠️ จุดที่พังง่ายที่สุดคือจังหวะ "จิ้มค้างครบแล้วเริ่มเลื่อนนิ้ว"
 *
 *    ตอนนั้นเบราว์เซอร์ยังไม่รู้ว่านิ้วนี้จะเลื่อนหน้าจอหรือจะลากแถว
 *    ถ้าปล่อยไว้มันเลือกเลื่อนหน้าจอ แล้วแถวจะไม่ขยับตามนิ้วเลย
 *
 *    ตั้ง touch-action เป็น none ไว้แต่แรกก็ไม่ได้ เพราะจะเลื่อนหน้าจอด้วย
 *    การลากบนแถวไม่ได้เลยทั้งที่ยังไม่ได้เข้าโหมดลาก จึงต้องดักที่ touchmove
 *    เอง และต้องเป็นตัวฟังแบบ passive false ไม่งั้น preventDefault ถูกเมิน
 *    (React ผูกตัวฟังให้แบบ passive จึงใช้ onTouchMove ตรงๆ ไม่ได้)
 *
 *    ที่ดักทันเพราะการจิ้มค้างแปลว่านิ้วอยู่นิ่ง ยังไม่มีการเลื่อนเกิดขึ้นจริง
 *    เบราว์เซอร์จึงยังเปลี่ยนใจได้ตอน touchmove แรก
 *
 * ⚠️ ขยับนิ้วก่อนครบเวลา = ตั้งใจเลื่อนหน้าจอ ต้องยกเลิกการจิ้มค้าง
 *    ไม่งั้นการเลื่อนดูรายการธรรมดาจะกลายเป็นการสลับลำดับโดยไม่ตั้งใจ
 *    ซึ่งในแอปบัญชีแปลว่าลำดับเปลี่ยนเองโดยเจ้าของร้านไม่ทันเห็น
 *
 * ลูกศรขึ้นลงก็ย้ายได้ สำหรับคนที่ใช้คีย์บอร์ดหรือโปรแกรมอ่านหน้าจอ
 * ซึ่งจิ้มค้างไม่ได้เลย ถ้ามีแต่การลาก ฟีเจอร์นี้จะใช้ไม่ได้กับคนกลุ่มนั้นทั้งหมด
 */

/**
 * จิ้มค้างนานเท่านี้ถึงจะเริ่มลาก
 *
 * 400ms เท่ากับที่ iOS ใช้กับการกดค้าง สั้นกว่านี้แล้วการแตะธรรมดาที่นิ้ว
 * ค้างนิดหน่อยจะกลายเป็นการลาก ยาวกว่านี้แล้วรู้สึกเหมือนแอปไม่ตอบสนอง
 */
const HOLD_MS = 400;

/** ขยับเกินกี่พิกเซลถือว่าตั้งใจเลื่อนหน้าจอ ไม่ใช่จิ้มค้าง */
const MOVE_TOLERANCE = 8;

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
  labelOf,
}: {
  items: T[];
  /** เรียกเมื่อลำดับนิ่งแล้ว — ได้ id เรียงตามลำดับใหม่ทั้งชุด */
  onReorder: (ids: string[]) => void;
  renderRow: (item: T) => React.ReactNode;
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

  const listRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startY = useRef(0);
  /** อ่านจากตัวฟัง touchmove ที่อยู่นอกวงจร render จึงต้องเป็น ref ไม่ใช่ state */
  const draggingRef = useRef(false);
  const orderAtDragStart = useRef<string[]>([]);

  /**
   * ตัวฟัง touchmove แบบ passive false — ตัวเดียวที่ห้ามการเลื่อนหน้าจอได้
   * ระหว่างลาก ดูเหตุผลเต็มที่หัวไฟล์
   */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const block = (e: TouchEvent) => {
      if (draggingRef.current) e.preventDefault();
    };

    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const moveTo = (from: number, to: number) => {
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // เมาส์ปุ่มขวาหรือปุ่มกลางไม่ใช่การลาก
    if (e.button !== 0) return;

    startY.current = e.clientY;
    const target = e.currentTarget;
    const pointerId = e.pointerId;

    cancelHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      orderAtDragStart.current = order;
      draggingRef.current = true;
      setDragId(id);

      // จับนิ้วไว้กับแถวนี้ ถึงนิ้วจะเลื่อนออกนอกแถวก็ยังได้ pointermove ต่อ
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // บางเบราว์เซอร์ปฏิเสธถ้า pointer จบไปแล้ว ไม่ถึงตาย แค่ลากออกนอกแถวไม่ได้
      }
    }, HOLD_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // ยังไม่ครบเวลา — ขยับเกินกำหนดแปลว่าตั้งใจเลื่อนหน้าจอ
    if (!draggingRef.current) {
      if (Math.abs(e.clientY - startY.current) > MOVE_TOLERANCE) cancelHold();
      return;
    }

    if (dragId === null) return;
    const from = order.indexOf(dragId);
    if (from < 0) return;

    /**
     * หาตำแหน่งใหม่จากการเทียบนิ้วกับกึ่งกลางแถว ไม่ใช่ขอบแถว
     *
     * ใช้ขอบแล้วแถวจะสลับตั้งแต่นิ้วเพิ่งแตะขอบ แล้วสลับกลับทันทีที่ขยับ
     * นิดเดียว กลายเป็นสั่นไปมา กึ่งกลางทำให้ต้องลากผ่านครึ่งแถวจริงๆ
     * ถึงจะสลับ ซึ่งเป็นพฤติกรรมเดียวกับรายการของ iOS
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
    cancelHold();
    if (!draggingRef.current) return;

    draggingRef.current = false;
    setDragId(null);

    if (order.join(",") !== orderAtDragStart.current.join(",")) onReorder(order);
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

      <ul ref={listRef} className="divide-y divide-line">
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
                "bg-surface transition-shadow",
                // ตัวที่กำลังลากยกขึ้นมาด้วยเงา ไม่ใช่เปลี่ยนสีพื้น
                // เพื่อไม่ให้ชนกับสีรับเข้า/จ่ายออกที่มีความหมายอยู่แล้ว
                dragging && "relative z-10 rounded-xl shadow-lg",
              )}
            >
              {/**
               * เป็นปุ่มจริง ไม่ใช่ div ที่ผูก event ไว้
               *
               * ได้สามอย่างมาฟรี — โฟกัสด้วยคีย์บอร์ดได้ โปรแกรมอ่านหน้าจอรู้ว่า
               * กดได้ และกฎรวมใน globals.css ที่ปิดการเลือกข้อความกับเมนูกดค้าง
               * ของ iOS ครอบถึง ถ้าเป็น div เมนู "คัดลอก · แชร์" จะเด้งขึ้นมาทับ
               * ตอนจิ้มค้างพอดี ซึ่งคือท่าเดียวกับที่เราจะใช้
               */}
              <button
                type="button"
                aria-label={`ย้ายลำดับของ ${labelOf(item)} — จิ้มค้างแล้วลาก หรือใช้ลูกศรขึ้นลง`}
                onPointerDown={(e) => handlePointerDown(e, item.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                /**
                 * ระหว่างลากตั้ง none กันการเลื่อนหน้าจอเป็นชั้นที่สอง ชั้นแรก
                 * คือตัวฟัง touchmove ข้างบน — ชั้นนี้อย่างเดียวไม่พอเพราะ
                 * เบราว์เซอร์อ่านค่านี้ตอนนิ้วแตะ ไม่ได้อ่านใหม่ระหว่างทาง
                 *
                 * ตอนยังไม่ลากต้องเป็น pan-y ไม่ใช่ none ไม่งั้นเลื่อนหน้าจอ
                 * ด้วยการลากบนแถวไม่ได้เลยทั้งที่ยังไม่ได้เข้าโหมดลาก
                 */
                style={{ touchAction: dragging ? "none" : "pan-y" }}
                className="flex w-full items-center text-left"
              >
                {renderRow(item)}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
