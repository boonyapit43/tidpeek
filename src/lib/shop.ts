import "server-only";
import { cookies } from "next/headers";
import { getShop, listShops } from "@/db/queries";
import type { Shop } from "@/db/schema";

/**
 * ร้านที่กำลังดูอยู่ เก็บไว้ใน cookie ไม่ใช่ใน URL
 *
 * เหตุผล: ถ้าใส่เป็น ?shop=... ทุกลิงก์ในแอปต้องพก id ติดไปด้วยตลอด
 * ลืมที่เดียวแล้วเด้งกลับไปร้านแรกเงียบๆ ซึ่งอันตรายมากในแอปบัญชี
 * เพราะคนอาจบันทึกรายการลงผิดร้านโดยไม่รู้ตัว
 *
 * เก็บใน cookie แทน localStorage เพราะ Server Component ต้องอ่านค่านี้
 * ตั้งแต่ตอน render ครั้งแรก ไม่งั้นหน้าจะกระพริบเปลี่ยนร้านหลังโหลดเสร็จ
 */
const SHOP_COOKIE = "ledger_shop";

export type ShopContext = { shop: Shop; shops: Shop[] };

/**
 * ร้านที่เลือกไว้ คืน null เมื่อยังไม่ได้เลือกหรือร้านที่เลือกใช้ไม่ได้แล้ว
 *
 * ⚠️ ตั้งใจไม่ตกกลับไปเลือกร้านแรกให้อัตโนมัติ
 *    การเดาแทนคนใช้ในแอปบัญชีเป็นเรื่องอันตราย ถ้าร้านที่เคยเลือกถูกลบไป
 *    แล้วระบบสลับไปร้านอื่นให้เงียบๆ คนจะบันทึกรายการลงผิดร้านโดยไม่รู้ตัว
 *    ให้เด้งกลับไปหน้าเลือกร้านแล้วให้คนเลือกเองดีกว่า
 */
export async function getSelectedShop(): Promise<Shop | null> {
  const saved = (await cookies()).get(SHOP_COOKIE)?.value;
  if (!saved) return null;

  return getShop(saved);
}

/**
 * ร้านที่เลือกไว้ พร้อมรายชื่อร้านทั้งหมด สำหรับหน้าที่ต้องใช้ทั้งสองอย่าง
 *
 * ยิงสอง query พร้อมกัน ไม่ใช่รอทีละตัว
 *
 * ทุกหน้าในแอปเรียกฟังก์ชันนี้เป็นอย่างแรกก่อนจะไปยิง query ของหน้าตัวเอง
 * ถ้าปล่อยให้เรียงกันจะกลายเป็นรอไปกลับฐานข้อมูลสามรอบต่อการเปิดหนึ่งหน้า
 * แทนที่จะเป็นสองรอบ ซึ่งเสียเปล่าเพราะรายชื่อร้านไม่ได้ขึ้นกับว่าร้านที่
 * เลือกไว้คือร้านไหน
 *
 * แลกกับการที่ listShops ถูกยิงทิ้งเปล่าตอนยังไม่ได้เลือกร้าน ซึ่งเป็น
 * เส้นทางที่เด้งไปหน้าเลือกร้านอยู่แล้วและแทบไม่เกิด
 */
export async function getShopContext(): Promise<ShopContext | null> {
  const [shop, shops] = await Promise.all([getSelectedShop(), listShops()]);
  if (!shop) return null;

  return { shop, shops };
}

/** ตรวจว่า id ที่ส่งมาเป็นร้านที่ยังเปิดใช้งานอยู่จริง ก่อนจะจำไว้ */
export async function isValidShop(shopId: string): Promise<boolean> {
  return Boolean(await getShop(shopId));
}

export async function rememberShop(shopId: string): Promise<void> {
  const store = await cookies();
  store.set(SHOP_COOKIE, shopId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // ธงเดียวกับ session cookie — ไม่ใส่แล้วคนกลางทางเน็ตยัด cookie ผ่าน
    // http:// ได้ ซึ่งเท่ากับสลับร้านที่กำลังบันทึกอยู่เงียบๆ
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function forgetShop(): Promise<void> {
  (await cookies()).delete(SHOP_COOKIE);
}
