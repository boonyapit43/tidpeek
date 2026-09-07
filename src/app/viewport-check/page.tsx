import type { Metadata } from "next";
import { ViewportReadout } from "./readout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ตรวจขนาดจอ",
  robots: { index: false, follow: false },
};

/**
 * หน้าวัดขนาดจอจากเครื่องจริง
 *
 * มีเพราะแถบเมนูล่างลอยเหนือขอบจอบน iPhone ที่ปักไว้หน้าโฮม แต่จำลอง
 * ในเบราว์เซอร์เดสก์ท็อปแล้วไม่เกิด และเดาสาเหตุผิดมาสองรอบแล้ว
 *
 * หน้านี้พิมพ์ตัวเลขทุกตัวที่เกี่ยวข้องออกมาให้เห็นกับตา แล้วเจ้าของร้าน
 * แคปส่งมา จะได้เลิกเดา
 *
 * ไม่ต้องล็อกอินเพราะไม่ได้แตะข้อมูลร้านเลย บอกแค่ขนาดจอกับค่าของเบราว์เซอร์
 * ลบหน้านี้ทิ้งได้เมื่อแก้ปัญหาเสร็จ
 */
export default function ViewportCheckPage() {
  return <ViewportReadout />;
}
