"use client";

import { useEffect } from "react";
import { awakeCookie } from "@/lib/lock";

/**
 * ต่ออายุ cookie "แอปยังตื่นอยู่" ระหว่างที่แอปเปิดอยู่บนจอ
 *
 * ตัวนี้ไม่ได้ล็อกอะไรเลย มันทำตรงกันข้าม — มันคือสิ่งที่ "กัน" ไม่ให้ล็อก
 * ตัวที่ล็อกจริงคือ requireUnlocked() ฝั่งเซิร์ฟเวอร์ ซึ่งจะเด้งไปหน้า PIN
 * ทันทีที่ cookie นี้หายไป เหตุผลที่ย้ายไปฝั่งเซิร์ฟเวอร์อยู่ใน lib/lock.ts
 *
 * ต่ออายุสี่จังหวะ
 *   ตอนคอมโพเนนต์ขึ้น      เปิดแอปมาแล้วผ่านด่านเซิร์ฟเวอร์ = ยังตื่นอยู่
 *   ตอนกลับมาเห็นหน้าจอ     สลับกลับมาจากแอปอื่นภายในเวลาที่กำหนด
 *   ตอนกำลังจะถูกซ่อน/ปิด   เขียนครั้งสุดท้าย นาฬิกา 15 นาทีจึงเริ่มนับ
 *                          จากวินาทีที่วางเครื่องพอดี ไม่ใช่จากการต่ออายุครั้งก่อน
 *   ทุกนาทีระหว่างเปิดอยู่   กันไม่ให้ cookie หมดอายุคาที่ระหว่างใช้งานจริง
 *
 * ⚠️ ต้องเช็ค visibilityState ก่อนต่ออายุในรอบของตัวจับเวลา
 *    เบราว์เซอร์บนเดสก์ท็อปหน่วงตัวจับเวลาของแท็บที่ถูกซ่อนไว้ แต่ไม่ได้หยุดมัน
 *    ถ้าต่ออายุโดยไม่เช็ค แท็บที่เปิดค้างไว้ข้ามคืนจะต่ออายุตัวเองไปเรื่อยๆ
 *    แล้วจะไม่มีวันล็อกเลย ซึ่งคือการทำลายทั้งฟีเจอร์โดยไม่มีอะไรฟ้อง
 *
 * ⚠️ ถ้า JavaScript โหลดไม่ขึ้น cookie จะไม่ถูกต่ออายุ แล้วจะถูกเด้งออก
 *    ภายใน 15 นาทีแม้กำลังใช้งานอยู่ ยอมรับได้เพราะทุกฟอร์มในแอปนี้ต้องใช้
 *    JavaScript อยู่แล้ว ถ้ามันโหลดไม่ขึ้นก็บันทึกอะไรไม่ได้ตั้งแต่แรก
 */
const REFRESH_EVERY_MS = 60 * 1000;

export function AwakeBeacon() {
  useEffect(() => {
    const refresh = () => {
      document.cookie = awakeCookie(location.protocol === "https:");
    };

    const onVisibility = () => {
      // ต่ออายุทั้งขาไปและขากลับ ขาไปคือตัวที่ทำให้ 15 นาทีเริ่มนับตรงจังหวะ
      refresh();
    };

    refresh();

    document.addEventListener("visibilitychange", onVisibility);
    // iOS ไม่ได้ยิง visibilitychange เสมอไปตอนตัดสินใจแช่แข็งหรือปิดแอปที่ค้างอยู่
    window.addEventListener("pagehide", refresh);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_EVERY_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", refresh);
      clearInterval(timer);
    };
  }, []);

  return null;
}

