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
export function AccountOptions({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <>
      <option value="">— ไม่ระบุ —</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {bahtShort(a.balance)}
          {a.shopId === null ? "  (ใช้ร่วม)" : ""}
        </option>
      ))}
    </>
  );
}

/** ประเภทที่ไม่นับเป็นกำไรมีวงเล็บกำกับ ไม่ได้ใช้สีบอกอย่างเดียว */
export function CategoryOptions({ categories }: { categories: Category[] }) {
  return (
    <>
      <option value="">— ไม่ระบุ —</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.counts ? "" : "  (ไม่นับเป็นกำไร)"}
        </option>
      ))}
    </>
  );
}
