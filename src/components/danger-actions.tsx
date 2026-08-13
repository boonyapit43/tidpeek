"use client";

import { useActionState, useEffect, useState } from "react";
import { type ActionState, IDLE } from "@/actions/shared";
import { Button, StatusMessage, SubmitButton } from "./form-parts";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * แถวปุ่ม "ปิดใช้งาน" กับ "ลบ" ที่ท้ายแผ่นแก้ไข ใช้ร่วมกันทั้งบัญชีและประเภท
 *
 * สองปุ่มนี้ทำคนละอย่างและกู้คืนยากไม่เท่ากัน จึงต้องแยกให้ชัด
 *
 *   ปิดใช้งาน  ไม่โผล่ในฟอร์มบันทึกใหม่ แต่ยังเห็นที่หน้าตั้งค่าและเปิดกลับได้
 *              กดครั้งเดียวจบ เพราะกดผิดก็กดกลับได้ทันที
 *
 *   ลบ         หายไปจากทุกที่ ต้องกดสองครั้งเพื่อยืนยัน
 *              เบื้องหลังเป็นการตั้งธง is_deleted ไม่ได้ลบแถวออกจริง
 *              จึงยังกู้คืนได้จากฐานข้อมูล แต่ทำจากหน้าเว็บไม่ได้
 *
 * ปุ่มลบจะซ่อนตัวเองไว้จนกว่าจะกดครั้งแรก ไม่ได้แสดงเป็นปุ่มแดงเด่นๆ
 * ตั้งแต่แรก เพราะมันอยู่ท้ายแผ่นที่คนเลื่อนผ่านบ่อยและกดโดนได้ง่าย
 */
export function DangerActions({
  shopId,
  id,
  isActive,
  activeLabel,
  deleteLabel,
  toggleAction,
  deleteAction,
  onDone,
}: {
  shopId: string;
  id: string;
  isActive: boolean;
  activeLabel: string;
  deleteLabel: string;
  toggleAction: Action;
  deleteAction: Action;
  /** เรียกเมื่อทำสำเร็จ ให้ฝั่งที่เรียกปิดแผ่นได้ */
  onDone: () => void;
}) {
  const [toggleState, toggle] = useActionState(toggleAction, IDLE);
  const [deleteState, remove] = useActionState(deleteAction, IDLE);
  const [confirming, setConfirming] = useState(false);

  /**
   * ลบไม่สำเร็จแล้วถอยกลับไปหน้าปุ่มปกติ ไม่ค้างอยู่ที่ "ยืนยันลบ"
   * ซึ่งกดซ้ำแล้วจะพยายามลบวนอยู่อย่างนั้นโดยไม่ทันได้อ่านว่าพลาดเพราะอะไร
   *
   * ปรับ state ตอน render โดยเทียบกับค่าที่เห็นล่าสุด เป็นวิธีที่ React แนะนำ
   * สำหรับ "แก้ state เมื่อค่าที่รับเข้ามาเปลี่ยน" React จะทิ้งผลของ render
   * รอบนี้แล้วเริ่มใหม่ทันทีโดยยังไม่วาดลงจอ ต่างจากการทำใน effect
   * ที่วาดสถานะเก่าลงจอไปแล้วรอบหนึ่งก่อน
   *
   * ไม่ต้องเช็คว่า id เปลี่ยนไหม เพราะแผ่นที่เรียกใช้ผูก key ไว้กับ id อยู่แล้ว
   * เปลี่ยนของที่กำลังแก้เมื่อไหร่ คอมโพเนนต์นี้ถูกสร้างใหม่ทั้งตัว
   */
  const [seenDelete, setSeenDelete] = useState(deleteState);

  if (seenDelete !== deleteState) {
    setSeenDelete(deleteState);
    if (deleteState.status === "error") setConfirming(false);
  }

  // ปิดแผ่นเมื่อทำสำเร็จ ไม่งั้นจะค้างอยู่หน้าที่แสดงของที่เพิ่งลบไป
  // เรียก callback ของฝั่งแม่ ไม่ได้ setState ในนี้ จึงอยู่ใน effect ได้
  useEffect(() => {
    if (toggleState.status === "ok" || deleteState.status === "ok") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleState, deleteState]);

  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <StatusMessage state={toggleState} />
      <StatusMessage state={deleteState} />

      {confirming ? (
        <form action={remove} className="flex gap-2">
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="id" value={id} />

          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => setConfirming(false)}
          >
            ยกเลิก
          </Button>
          <SubmitButton variant="danger" className="flex-1" pendingLabel="กำลังลบ">
            ยืนยันลบ
          </SubmitButton>
        </form>
      ) : (
        <div className="flex gap-2">
          <form action={toggle} className="flex-1">
            <input type="hidden" name="shopId" value={shopId} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />

            <SubmitButton variant="ghost" className="w-full" pendingLabel="กำลังบันทึก">
              {isActive ? activeLabel : "เปิดใช้อีกครั้ง"}
            </SubmitButton>
          </form>

          <Button
            type="button"
            variant="danger"
            className="flex-1"
            onClick={() => setConfirming(true)}
          >
            {deleteLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
