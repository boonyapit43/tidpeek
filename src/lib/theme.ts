import "server-only";
import { cookies } from "next/headers";

/**
 * ธีมที่คนเลือกไว้เอง เก็บใน cookie
 *
 * เก็บใน cookie ไม่ใช่ localStorage เพราะต้องอ่านได้ตั้งแต่ตอน render บน
 * เซิร์ฟเวอร์ แล้วปั๊ม data-theme ลงไปใน <html> เลย ถ้าอ่านฝั่ง browser
 * หน้าจะวาดด้วยธีมของเครื่องก่อนหนึ่งเฟรมแล้วค่อยกระพริบเปลี่ยน ซึ่งเห็น
 * ชัดมากตอนเปิดแอปในที่มืด
 *
 * ไม่มีค่าใน cookie = ตามเครื่อง ซึ่งเป็นค่าตั้งต้นและเป็นสิ่งที่คนส่วนใหญ่
 * อยากได้ ปุ่มสลับจึงเป็นการ "เลือกเอง" ที่ทับค่าของเครื่องเฉพาะคนที่กด
 */
const THEME_COOKIE = "ledger_theme";

export type Theme = "light" | "dark";

/** ธีมที่เลือกไว้ หรือ null ถ้ายังไม่เคยเลือก (= ตามเครื่อง) */
export async function getTheme(): Promise<Theme | null> {
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  return saved === "light" || saved === "dark" ? saved : null;
}

/** จำธีมที่เลือก — เรียกจาก server action เท่านั้น */
export async function rememberTheme(theme: Theme): Promise<void> {
  (await cookies()).set(THEME_COOKIE, theme, {
    // ไม่ใช่ข้อมูลลับ ฝั่ง browser อ่านได้ไม่เป็นไร แต่ไม่ต้องอ่านก็ได้
    // เพราะเซิร์ฟเวอร์ปั๊ม data-theme มาให้แล้ว
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    // หนึ่งปี — ธีมที่เลือกไว้ไม่ควรหายไปเองระหว่างใช้งานปกติ
    maxAge: 60 * 60 * 24 * 365,
  });
}
