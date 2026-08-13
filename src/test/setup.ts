import { vi } from "vitest";

/**
 * ทำให้ server action ถูกเรียกจากเทสได้ตรงๆ
 *
 * ที่ต้องมีไฟล์นี้เพราะบั๊กที่เจ็บที่สุดของโปรเจกต์นี้ ไม่ได้อยู่ในฟังก์ชัน
 * เล็กๆ ที่เทสง่าย แต่อยู่ที่ "รอยต่อ" ระหว่างฟอร์มกับ server action —
 * ฟอร์มส่งอะไรมาจริง แล้วอีกฝั่งคาดหวังอะไร เทสที่เขียน object ขึ้นมาเอง
 * มองรอยต่อนี้ไม่เห็นเลย เพราะมันทดสอบสิ่งที่คนเขียนเทส "คิดว่า" ฟอร์มส่ง
 *
 * ตัวอย่างจริง: ช่องหมายเหตุที่ยุบไว้ไม่ได้ส่งค่าว่าง แต่ไม่มีคีย์เลย
 * ทำให้บันทึกรายการไม่ได้ทั้งแอป โดยที่เทส 63 ข้อผ่านหมด
 *
 * ของสามอย่างที่ต้องปลอมเพราะมันมีเฉพาะตอนรันใน Next.js จริง
 */

/**
 * server-only ตั้งใจโยน error เมื่อถูก import นอก React Server Component
 * ซึ่งถูกแล้วสำหรับโค้ดแอป แต่เทสต้อง import โมดูลพวกนี้เข้ามาตรงๆ
 */
vi.mock("server-only", () => ({}));

/* ------------------------------------------------------------------ */
/*  cookie ปลอม                                                        */
/* ------------------------------------------------------------------ */

const store = new Map<string, string>();

/**
 * ปลอมทั้ง cookies และ headers ไว้ที่เดียวกัน
 *
 * ⚠️ ห้ามไป vi.mock("next/headers") ซ้ำในไฟล์เทสรายตัว
 *    การ mock โมดูลเดียวกันซ้ำจะทับของเดิมทั้งก้อน ไม่ได้รวมกัน
 *    ถ้าไฟล์ไหนปลอมแค่ headers ตัว cookies จะกลายเป็นของจริงแล้วโยน
 *    "cookies was called outside a request scope" ทันที
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),

  // ใช้เป็นกุญแจนับจำนวนครั้งที่กรอก PIN ผิด
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));

/* ------------------------------------------------------------------ */
/*  cache กับ navigation                                               */
/* ------------------------------------------------------------------ */

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/**
 * redirect() ของจริงทำงานด้วยการโยน error ที่มี digest ขึ้นต้นด้วย
 * NEXT_REDIRECT ซึ่ง runAction ต้องปล่อยผ่านไม่กลืนไว้ ของปลอมจึงต้อง
 * โยนแบบเดียวกันเป๊ะ ไม่งั้นเทสจะไม่เจอบั๊กที่ redirect ถูกกลืน
 */
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  },
}));
