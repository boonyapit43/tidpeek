/**
 * โครงหน้าจอที่ขึ้นแทนระหว่างรอข้อมูลจากเซิร์ฟเวอร์
 *
 * จำเป็นเพราะทุกหน้าเป็น server-rendered และฐานข้อมูลอยู่ที่มุมไบ
 * การกดสลับแท็บจึงต้องรอไปกลับราว 150–250 ms ถ้าไม่มีไฟล์นี้ Next.js
 * จะค้างหน้าเดิมไว้เงียบๆ จนกว่าข้อมูลจะมา คนกดแล้วไม่เห็นอะไรขยับ
 * จะนึกว่าไม่ติดแล้วกดซ้ำ
 *
 * ไฟล์เดียวครอบทุกหน้าในกลุ่ม (บันทึก รายวัน สรุป ตั้งค่า) เพราะทุกหน้า
 * หน้าตาเป็นการ์ดซ้อนกันเหมือนกันหมด ไม่ต้องทำแยกทีละหน้า
 *
 * แถบบนกับเมนูอยู่ใน layout จึงไม่กระพริบ เห็นค้างอยู่ตลอดการเปลี่ยนหน้า
 */
export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลด</span>

      <Block className="h-[4.5rem]" />
      <Block className="h-56" />
      <Block className="h-40" />
    </div>
  );
}

function Block({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-2xl bg-surface shadow-sm ${className}`}
    />
  );
}
