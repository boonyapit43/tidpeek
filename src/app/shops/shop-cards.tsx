"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteShop, switchShop, updateShop } from "@/actions/settings";
import { IDLE } from "@/actions/shared";
import { Button, Field, Input, StatusMessage, SubmitButton } from "@/components/form-parts";
import { Sheet } from "@/components/sheet";
import { cn } from "@/lib/cn";

export type ShopCardData = {
  id: string;
  name: string;
  todayProfit: string;
  isLoss: boolean;
  todayCount: number;
  totalCount: number;
};

/**
 * รายการกล่องร้าน แตะกล่องเพื่อเข้าร้านนั้น
 *
 * ทั้งกล่องเป็นปุ่มส่งฟอร์ม ไม่ใช่ลิงก์ เพราะการเลือกร้านคือการเขียน cookie
 * ฝั่งเซิร์ฟเวอร์ ซึ่งต้องเป็น POST ไม่ใช่ GET
 *
 * ปุ่มแก้ไขอยู่นอกฟอร์มของกล่อง ไม่ได้อยู่ข้างใน เพราะ HTML ไม่อนุญาต
 * ให้มีปุ่มซ้อนในปุ่ม กดปุ่มแก้ไขแล้วจะไปโดนปุ่มเข้าร้านด้วย
 *
 * บน iPad ขึ้นไปเรียงเป็นสองคอลัมน์ เพราะกล่องเดียวยาวเต็มจอ 1024px
 * อ่านยากและเสียที่เปล่าๆ
 */
export function ShopCards({
  shops,
  trailing,
}: {
  shops: ShopCardData[];
  /** ปุ่มเพิ่มร้าน วางเป็นช่องสุดท้ายของตาราง จะได้เข้าแถวกับการ์ดพอดี */
  trailing?: React.ReactNode;
}) {
  const [editing, setEditing] = useState<ShopCardData | null>(null);

  return (
    <>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {shops.map((shop) => (
          /**
           * ปุ่มแก้ไขวางทับอยู่ในกล่องเดียวกับร้าน ไม่ได้ต่อท้ายเป็นกล่องแยก
           *
           * ทำเป็น absolute ที่ซ้อนบนปุ่มเข้าร้าน แทนที่จะวางไว้ข้างในปุ่มนั้น
           * เพราะ HTML ไม่อนุญาตให้มีปุ่มซ้อนในปุ่ม ถ้าฝืนใส่ เบราว์เซอร์จะ
           * ตัดตัวในทิ้งเงียบๆ แล้วกดแก้ไขทีไรจะไปโดนปุ่มเข้าร้านแทน
           */
          <li key={shop.id} className="relative">
            <form action={switchShop}>
              <input type="hidden" name="shopId" value={shop.id} />
              <EnterShopButton shop={shop} />
            </form>

            <button
              type="button"
              onClick={() => setEditing(shop)}
              aria-label={`แก้ไขร้าน ${shop.name}`}
              className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-ink-soft transition hover:bg-surface-2 active:scale-90"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-[18px]"
                aria-hidden
              >
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </li>
        ))}

        {trailing && <li>{trailing}</li>}
      </ul>

      <EditShopSheet shop={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function EnterShopButton({ shop }: { shop: ShopCardData }) {
  // useFormStatus ต้องอยู่ในคอมโพเนนต์ลูกของ form ไม่ใช่ตัวเดียวกับที่มี form
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "block w-full rounded-2xl border border-line bg-surface p-4 text-left",
        "shadow-sm transition hover:border-brand/40 active:scale-[0.99]",
        "disabled:opacity-60",
      )}
    >
      <span className="flex items-center gap-3">
        {/* วงกลมอักษรแรกของชื่อร้าน ให้แต่ละกล่องมีหน้าตาของตัวเอง
            ไล่สีเดียวกับโลโก้แอปเพื่อความเป็นชุดเดียวกัน */}
        <span
          aria-hidden
          className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm shadow-brand/25"
        >
          {shop.name.trim().charAt(0)}
        </span>

        {/* ถ้าไม่มีตัวเลขกำไรมาคั่น ชื่อร้านต้องเว้นทางให้ปุ่มดินสอเอง */}
        <span className={cn("min-w-0 flex-1", shop.todayCount === 0 && "pr-8")}>
          <span className="block truncate text-base font-semibold text-ink">{shop.name}</span>
          <span className="mt-0.5 block text-xs text-ink-soft">
            {shop.todayCount === 0 ? "วันนี้ยังไม่มีรายการ" : `วันนี้ ${shop.todayCount} รายการ`}
          </span>
        </span>

        {/* mr-8 เว้นทางให้ปุ่มดินสอที่ลอยอยู่ริมขวา ไม่ให้ทับตัวเลข */}
        {shop.todayCount > 0 && (
          <span
            className={cn(
              "num mr-8 shrink-0 text-lg leading-none font-bold",
              shop.isLoss ? "text-expense" : "text-income",
            )}
          >
            {shop.todayProfit}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * เปลี่ยนชื่อหรือลบร้าน
 *
 * การลบร้านพารายการทั้งหมดของร้านนั้นหายไปด้วย จึงบอกจำนวนรายการที่จะหาย
 * ให้เห็นก่อนกดยืนยัน ตัวเลขนี้คือสิ่งที่ทำให้คนหยุดคิด ไม่ใช่คำเตือนลอยๆ
 * ที่อ่านผ่านไป
 */
function EditShopSheet({ shop, onClose }: { shop: ShopCardData | null; onClose: () => void }) {
  const [renameState, rename] = useActionState(updateShop, IDLE);
  const [deleteState, remove] = useActionState(deleteShop, IDLE);
  const [confirming, setConfirming] = useState(false);

  // เปลี่ยนร้านที่กำลังแก้แล้วต้องยกเลิกการยืนยันลบที่ค้างอยู่
  // ไม่งั้นเปิดร้านถัดมาแล้วเจอปุ่ม "ยืนยันลบ" รออยู่ ซึ่งกดพลาดได้ทันที
  const [seen, setSeen] = useState({ id: shop?.id ?? null, deleteState });

  if (seen.id !== (shop?.id ?? null) || seen.deleteState !== deleteState) {
    setSeen({ id: shop?.id ?? null, deleteState });

    if (seen.id !== (shop?.id ?? null) || deleteState.status === "error") setConfirming(false);
  }

  useEffect(() => {
    if (renameState.status === "ok" || deleteState.status === "ok") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameState, deleteState]);

  return (
    <Sheet open={shop !== null} onClose={onClose} title="แก้ไขร้าน">
      {shop && (
        <>
          <form key={shop.id} action={rename} className="space-y-4">
            <input type="hidden" name="id" value={shop.id} />

            <Field label="ชื่อร้าน" htmlFor="shop-name">
              <Input
                id="shop-name"
                name="name"
                defaultValue={shop.name}
                required
                maxLength={120}
                enterKeyHint="done"
              />
            </Field>

            <StatusMessage state={renameState} />
            <SubmitButton className="w-full">บันทึกชื่อใหม่</SubmitButton>
          </form>

          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <StatusMessage state={deleteState} />

            {confirming ? (
              <>
                {/* เหลือแต่จำนวนรายการที่จะหายไป ซึ่งเป็นตัวเลขที่ทำให้คนหยุดคิด
                    คำอธิบายอื่นตัดออก เพราะยาวแล้วคนอ่านผ่านอยู่ดี */}
                <p className="rounded-xl bg-expense-soft px-3 py-2 text-xs text-expense">
                  {shop.totalCount === 0
                    ? "ลบร้านนี้"
                    : `ลบร้านนี้ พร้อมรายการทั้งหมด ${shop.totalCount} รายการ`}
                </p>

                <form action={remove} className="flex gap-2">
                  <input type="hidden" name="id" value={shop.id} />

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
              </>
            ) : (
              <Button
                type="button"
                variant="danger"
                className="w-full"
                onClick={() => setConfirming(true)}
              >
                ลบร้าน
              </Button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
