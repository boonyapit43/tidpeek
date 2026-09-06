"use client";

import { useEffect } from "react";
import { hasUnsavedInput, shouldReload } from "@/lib/version";

/**
 * โหลดหน้าใหม่ให้เองเมื่อมีรุ่นใหม่ขึ้นแล้ว
 *
 * ที่ต้องมีเพราะแอปที่ปักไว้หน้าโฮมของ iOS ไม่ได้เปิดใหม่ตอนกดไอคอน
 * มันปลุกหน้าเดิมที่ค้างอยู่ในหน่วยความจำขึ้นมา — หน้าเดิม โค้ดเดิม
 * ไม่มีการยิงขอหน้าใหม่จากเซิร์ฟเวอร์เลย คนจึงเห็นของเก่าไปเรื่อยๆ
 * ทั้งที่ deploy ไปแล้ว จนต้องไปเปิดใน Safari ถึงจะเห็นของใหม่
 *
 * เซิร์ฟเวอร์ส่ง no-store มาอยู่แล้ว ปัญหาไม่ได้อยู่ที่ cache ฝั่งเรา
 * จึงแก้ด้วย service worker ไม่ได้ ต้องให้หน้าถามเองว่ามีของใหม่ไหม
 *
 * ถามตอนที่คนสลับกลับมาที่แอปเท่านั้น ไม่ได้ตั้งเวลาถามเป็นระยะ เพราะ
 * จังหวะที่ของเก่าค้างคือจังหวะที่เพิ่งกลับเข้ามาพอดี และการถามถี่ๆ
 * ระหว่างใช้งานเป็นการเปลืองเน็ตของคนขายของโดยไม่ได้อะไรเพิ่ม
 */
export function VersionWatch() {
  useEffect(() => {
    const running = process.env.NEXT_PUBLIC_BUILD_ID;

    // ไม่ได้ตั้งค่าไว้ (เช่น dev) ก็ไม่ต้องทำอะไร
    if (!running) return;

    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;

      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;

        const { id } = (await res.json()) as { id?: string };
        if (!id) return;

        if (!shouldReload({ running, latest: id, hasUnsavedInput: hasUnsavedInput(document) })) {
          return;
        }

        /**
         * ⚠️ กันรีโหลดวนไม่จบ
         *
         * ถ้าโหลดใหม่แล้วยังได้โค้ดชุดเดิมกลับมา (เช่น CDN ยังจ่ายของเก่า
         * หรือ build id ถูกตั้งเป็นค่าที่ไม่คงที่) หน้าจะเห็นว่ามีรุ่นใหม่
         * อีกรอบแล้วรีโหลดซ้ำไปเรื่อยๆ จนใช้งานไม่ได้เลย
         *
         * จำไว้ว่าเคยรีโหลดเพื่อรุ่นไหนไปแล้ว ถ้าเจอรุ่นเดิมซ้ำก็ยอมแพ้
         * ปล่อยให้ใช้ของเก่าต่อไป ซึ่งแย่น้อยกว่าหน้าที่กระพริบไม่หยุด
         */
        const KEY = "ledger_reloaded_for";
        try {
          if (sessionStorage.getItem(KEY) === id) return;
          sessionStorage.setItem(KEY, id);
        } catch {
          // โหมดส่วนตัวบางเบราว์เซอร์เขียนไม่ได้ — ไม่มีตัวกันก็ไม่เสี่ยงดีกว่า
          return;
        }

        /**
         * reload() ธรรมดาพอ ไม่ต้องเติมพารามิเตอร์กันแคช
         * เพราะหน้าเป็น no-store อยู่แล้ว การเติมอะไรเข้าไปใน URL
         * มีแต่จะทำให้ที่อยู่ที่คนเห็นสกปรกและแชร์ต่อแล้วแปลก
         */
        window.location.reload();
      } catch {
        // เน็ตไม่มาก็ปล่อยไป ครั้งหน้าที่กลับเข้าแอปค่อยถามใหม่
      }
    }

    document.addEventListener("visibilitychange", check);

    /**
     * ถามหนึ่งครั้งตอนติดตั้งด้วย เผื่อกรณีที่หน้าถูกปลุกขึ้นมาโดยไม่มี
     * visibilitychange ยิง ซึ่งเกิดได้บน iOS ตอนกลับเข้าแอปจากหน้าโฮม
     */
    void check();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return null;
}
