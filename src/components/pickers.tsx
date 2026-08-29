import type { AccountWithBalance } from "@/db/queries";
import type { Category } from "@/db/schema";
import { bahtShort } from "@/lib/money";

/**
 * ตัวเลือกในดรอปดาวน์บัญชีและประเภท
 *
 * แยกออกมาเพราะมีสองที่ที่ใช้ชุดเดียวกันเป๊ะ — ฟอร์มบันทึกรายการใหม่
 * กับแผ่นแก้ไขรายการเดิม ถ้าปล่อยให้ต่างคนต่างเขียน วันที่แก้ที่หนึ่ง
 * อีกที่จะเหลือของเก่า แล้วคนใช้จะเห็นรายการบัญชีไม่เหมือนกันสองแบบ
 * ในแอปเดียวกัน โดยไม่มีอะไรบอกว่าทำไม
 *
 * ไม่ต้องเป็น client component เพราะไม่มี state และไม่มี event handler
 * เป็นแค่ markup ที่ถูกเรียกจาก client component อีกที
 */

/**
 * ยอดคงเหลือติดอยู่ในชื่อบัญชีเลย เช่น "เงินสด · 4,500"
 *
 * เพราะยอดคงเหลือคือสิ่งที่ต้องรู้ตอนกำลังตัดสินใจว่าจะลงบัญชีไหน
 * และเป็นตัวที่บอกว่าเงินเดินจริงตามที่บันทึกไปหรือเปล่า ถ้าแยกไปไว้
 * หน้าตั้งค่าอย่างเดียว จะไม่มีใครเห็นตอนที่มันสำคัญ
 */
/** ข้อความตอนลิสต์ว่าง — ใช้ร่วมกันทุกฟอร์ม จะได้ไม่มีสองสำนวนในแอปเดียว */
export const NO_ACCOUNTS_LABEL = "ยังไม่มีบัญชี — เพิ่มได้ที่แท็บตั้งค่า";
export const NO_CATEGORIES_LABEL = "ยังไม่มีประเภทของฝั่งนี้ — เพิ่มได้ที่แท็บตั้งค่า";

/** เฉพาะตัวรายการบัญชี ไม่มีหัวอย่าง "ไม่ระบุ" — ให้ฟอร์มแต่ละแบบเลือกหัวเอง
    ฟอร์มบันทึกใหม่ขึ้น "เลือกบัญชีก่อน" ส่วนแผ่นแก้ไขมี "ไม่ระบุ" รับรายการเก่า */
export function AccountOptionItems({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {bahtShort(a.balance)}
          {a.shopId === null ? "  (ใช้ร่วม)" : ""}
        </option>
      ))}
    </>
  );
}

export function CategoryOptionItems({ categories }: { categories: Category[] }) {
  return (
    <>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.counts ? "" : "  (ไม่นับเป็นกำไร)"}
        </option>
      ))}
    </>
  );
}

/** หัว "ไม่ระบุ" + รายการบัญชี — ใช้ในแผ่นแก้ไข ซึ่งต้องรองรับรายการเก่าที่ไม่ผูกบัญชี */
export function AccountOptions({ accounts }: { accounts: AccountWithBalance[] }) {
  /**
   * ลิสต์ว่างต้องบอกว่าทำไมและไปเพิ่มที่ไหน ไม่ใช่โชว์ "ไม่ระบุ" เฉยๆ
   * ให้คนงงว่าบัญชีหายไปไหน — มาตรฐานเดียวกับแผ่นโอนเงินที่บอกว่า
   * ต้องมีสองบัญชีก่อนถึงจะโอนได้
   */
  if (accounts.length === 0) {
    return <option value="">{NO_ACCOUNTS_LABEL}</option>;
  }

  return (
    <>
      <option value="">— ไม่ระบุ —</option>
      <AccountOptionItems accounts={accounts} />
    </>
  );
}

/** ประเภทที่ไม่นับเป็นกำไรมีวงเล็บกำกับ ไม่ได้ใช้สีบอกอย่างเดียว */
export function CategoryOptions({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    // ฝั่งรับกับฝั่งจ่ายมีคนละชุด สลับฝั่งแล้วว่างได้ทั้งที่อีกฝั่งมีของ
    return <option value="">{NO_CATEGORIES_LABEL}</option>;
  }

  return (
    <>
      <option value="">— ไม่ระบุ —</option>
      <CategoryOptionItems categories={categories} />
    </>
  );
}
