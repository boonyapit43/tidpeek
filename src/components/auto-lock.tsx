"use client";

import { useEffect } from "react";
import { logout } from "@/actions/auth";
import { LOCK_AFTER_MS, shouldLock } from "@/lib/lock";

/** ที่เก็บเวลาที่สลับออกไปครั้งล่าสุด อยู่ใน sessionStorage พอ ไม่ต้องข้ามแท็บ */
const KEY = "ledger_hidden_at";

/**
 * ล็อกแอปเมื่อปิดทิ้งไว้เกิน 15 นาที ต้องกรอก PIN ใหม่
 *
 * ทำไมต้องมีทั้งที่ session มีอายุอยู่แล้ว — อายุ session นับจากตอนกรอก PIN
 * ไม่ได้นับจากตอนวางเครื่อง เครื่องที่วางอยู่หน้าร้านจึงเปิดดูยอดขายได้ทันที
 * ตลอดทั้งวัน ตัวนี้ปิดช่องนั้น
 *
 * จับจังหวะสลับออก-สลับเข้า ไม่ได้จับ "ไม่ได้แตะจอ" เพราะเจ้าของร้านวางเครื่อง
 * เปิดค้างไว้ข้างเตาระหว่างทำอาหารเป็นเรื่องปกติ ล็อกตอนนั้นคือกวนเปล่าๆ
 * ส่วนการหยิบเครื่องไปดูตอนเจ้าของหันหลังคือกรณีที่ต้องกัน ซึ่งเข้าทางนี้พอดี
 *
 * ⚠️ นี่คือกลอนประตู ไม่ใช่ตู้เซฟ
 *    มันทำงานฝั่งหน้าจอ ใครที่รู้วิธีเปิด URL ตรงๆ ใน Safari ยังเข้าได้จนกว่า
 *    session จะหมดอายุจริง กันคนหยิบเครื่องไปกดเล่นได้ ไม่ได้กันคนที่ตั้งใจ
 *    จะเจาะ ถ้าวันหนึ่งต้องการของจริงต้องย้ายไปตัดสินที่ฝั่งเซิร์ฟเวอร์
 *
 * ⚠️ ล็อกแล้วของที่พิมพ์ค้างในฟอร์มหายด้วย ต่างจาก VersionWatch ที่ยอมเลื่อน
 *    การโหลดใหม่ออกไปก่อน เพราะการล็อกคือสิ่งที่ต้องเกิดให้ได้ ถ้ายอมเลื่อน
 *    เพราะมีตัวอักษรค้างอยู่ในช่อง มันก็ไม่ใช่กลอนอีกต่อไป
 */
export function AutoLock() {
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        try {
          sessionStorage.setItem(KEY, String(Date.now()));
        } catch {
          // เขียนไม่ได้ก็ล็อกไม่ได้ ไม่ใช่เรื่องคอขาดบาดตาย
        }
        return;
      }

      let hiddenAt: number | null = null;
      try {
        const saved = sessionStorage.getItem(KEY);
        hiddenAt = saved === null ? null : Number(saved);
        if (Number.isNaN(hiddenAt)) hiddenAt = null;
      } catch {
        return;
      }

      if (!shouldLock({ hiddenAt, now: Date.now(), afterMs: LOCK_AFTER_MS })) return;

      try {
        sessionStorage.removeItem(KEY);
      } catch {
        // ลบไม่ได้ก็ไม่เป็นไร เดี๋ยวหน้าถูกเปลี่ยนไปหน้าล็อกอินอยู่ดี
      }

      // logout ลบ cookie ฝั่งเซิร์ฟเวอร์แล้วพาไปหน้ากรอก PIN
      void logout();
    };

    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return null;
}
