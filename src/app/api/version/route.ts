// Edge runtime รันบนโฮสต์ที่ใช้ Phusion Passenger ไม่ได้ จึงบังคับ Node ไว้
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * บอกว่าเซิร์ฟเวอร์ตอนนี้เป็นรุ่นไหน
 *
 *   GET /api/version  →  { "id": "8a4203f9c1d2" }
 *
 * มีไว้ให้หน้าที่เปิดค้างอยู่ถามว่า "มีของใหม่ขึ้นแล้วหรือยัง"
 *
 * ทำไมต้องมี — แอปที่ปักไว้หน้าโฮมของ iOS ไม่ได้โหลดใหม่ตอนกดไอคอน
 * มันปลุกหน้าเดิมที่ค้างในหน่วยความจำขึ้นมา คนจึงเห็นของเก่าไปเรื่อยๆ
 * ทั้งที่ deploy ไปแล้ว ต้องไปเปิดใน Safari ถึงจะเห็นของใหม่
 *
 * ไม่ต้องตรวจ session เพราะไม่ได้บอกอะไรเกี่ยวกับข้อมูลของร้านเลย
 * แค่บอกว่าโค้ดชุดไหนกำลังรันอยู่ ซึ่งดูจากไฟล์ JS ที่เสิร์ฟก็รู้อยู่แล้ว
 *
 * ตอบตัวเดียวสั้นๆ เพราะถูกเรียกทุกครั้งที่คนสลับกลับมาที่แอป
 */
export function GET(): Response {
  return new Response(JSON.stringify({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "" }), {
    headers: {
      "content-type": "application/json",
      // ห้าม cache เด็ดขาด ไม่งั้นจะได้คำตอบเก่ากลับมาแล้วไม่มีวันรู้ว่ามีของใหม่
      "cache-control": "no-store, max-age=0",
    },
  });
}
