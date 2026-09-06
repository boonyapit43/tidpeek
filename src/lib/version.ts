/**
 * กติกาว่าเมื่อไหร่ควรรีโหลดหน้าเพื่อรับของใหม่
 *
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพราะนี่คือส่วนที่ผิดแล้วเจ็บ — รีโหลดผิด
 * จังหวะแปลว่าคนที่กำลังกรอกรายการอยู่เสียของที่พิมพ์ไปทั้งหมด ซึ่งในแอป
 * บัญชีคือเรื่องใหญ่กว่าการเห็นของใหม่ช้าไปอีกสิบนาที
 */

/** ยาวพอที่จะเป็นรหัสรุ่นจริง ไม่ใช่ค่าว่างหรือค่าที่ตั้งไม่สำเร็จ */
const looksLikeId = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.length >= 4;

export function shouldReload({
  running,
  latest,
  hasUnsavedInput,
}: {
  /** รุ่นที่ฝังมากับหน้าที่เปิดค้างอยู่ */
  running: string | null | undefined;
  /** รุ่นที่เซิร์ฟเวอร์ตอบกลับมาตอนนี้ */
  latest: string | null | undefined;
  /** มีอะไรที่คนพิมพ์ค้างไว้แล้วยังไม่ได้บันทึกไหม */
  hasUnsavedInput: boolean;
}): boolean {
  // ตั้งค่าไม่สำเร็จสักฝั่ง — ไม่รู้ก็ไม่ทำอะไร ดีกว่ารีโหลดมั่ว
  if (!looksLikeId(running) || !looksLikeId(latest)) return false;

  if (running === latest) return false;

  /**
   * มีของค้างอยู่ในฟอร์ม รอไว้ก่อน
   *
   * ไม่ได้ทิ้งโอกาสไปเลย — ตัวเช็กจะถามใหม่ทุกครั้งที่คนสลับกลับมาที่แอป
   * พอบันทึกเสร็จแล้วสลับออกสลับเข้าอีกที ก็จะได้ของใหม่เอง
   */
  if (hasUnsavedInput) return false;

  return true;
}

/**
 * มีอะไรที่คนพิมพ์ค้างไว้บนหน้านี้ไหม
 *
 * นับทั้งช่องที่มีตัวอักษรอยู่ และช่องที่กำลังถูกพิมพ์อยู่ตอนนี้แม้ยังว่าง
 * เพราะคนอาจกำลังจะพิมพ์ต่อ
 *
 * ไม่นับช่องค้นหาหรือช่องที่ตั้ง data-transient ไว้ ของพวกนั้นหายไปไม่เสียหาย
 */
export function hasUnsavedInput(root: Document | HTMLElement): boolean {
  /**
   * ⚠️ ต้องใช้ hasAttribute ไม่ใช่ dataset.transient
   *    <input data-transient> ที่ไม่ได้ใส่ค่าให้ ได้ dataset.transient
   *    เป็นสตริงว่าง ซึ่ง falsy — เช็กแบบ truthy แล้วจะไม่มีวันข้ามช่องนั้น
   */
  const transient = (el: Element) => el.hasAttribute("data-transient");

  const active = (root.ownerDocument ?? (root as Document)).activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    if (!transient(active)) return true;
  }

  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );

  for (const field of fields) {
    if (transient(field)) continue;
    if (field.type === "hidden" || field.type === "checkbox" || field.type === "radio") continue;
    if (field.value.trim() !== "") return true;
  }

  return false;
}
