import type { Metadata, Viewport } from "next";
import { getTheme } from "@/lib/theme";
import "./globals.css";

/**
 * ไอคอนไม่ต้องประกาศตรงนี้ Next.js หยิบให้เองจากไฟล์ที่วางตามชื่อ
 *   src/app/icon.svg        favicon (สเกลได้ทุกขนาด)
 *   src/app/apple-icon.png  ไอคอนตอนปักหน้าจอโฮมของ iOS
 * ส่วนไอคอนของ manifest อยู่ใน public/ ดู src/app/manifest.ts
 */
export const metadata: Metadata = {
  title: {
    // ชื่อบนแท็บเบราว์เซอร์ ใช้ชื่อแอปล้วนๆ ให้อ่านออกแม้แท็บถูกบีบจนแคบ
    default: "tidpeek",
    // หน้าอื่นเติมชื่อหน้าไว้ข้างหน้า เช่น "รายวัน · tidpeek"
    // ชื่อหน้ามาก่อนเพราะเวลาเปิดหลายแท็บ ส่วนที่ยังเห็นคือตัวหน้าสุด
    template: "%s · tidpeek",
  },
  applicationName: "tidpeek",
  description: "บันทึกรายรับรายจ่ายรายวัน สรุปกำไรรายวัน รายเดือน รายปี แยกตามร้าน",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "tidpeek",
    // แถบสถานะโปร่งใสเมื่อเปิดจากไอคอนหน้าโฮม ทำให้แอปดูเต็มจอ
    statusBarStyle: "black-translucent",
  },
  // หน้าบัญชีของร้านไม่ควรถูก Google เก็บไปทำดัชนี
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit cover ทำให้พื้นที่ใต้รอยบากและแถบ home ของ iPhone ใช้งานได้
  // ต้องมีคู่กับ env(safe-area-inset-*) ใน CSS ไม่งั้นเนื้อหาจะโดนบัง
  viewportFit: "cover",
  // ห้ามใส่ maximumScale หรือ userScalable=false — คนสายตาไม่ดีต้องซูมได้
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * ธีมที่เลือกไว้ถูกปั๊มลงบน <html> ตั้งแต่บนเซิร์ฟเวอร์
   *
   * ถ้าไปอ่าน cookie ฝั่ง browser แล้วค่อยเซ็ต หน้าจะวาดด้วยธีมของเครื่อง
   * ก่อนหนึ่งเฟรมแล้วกระพริบเปลี่ยน ซึ่งเห็นชัดมากตอนเปิดแอปในที่มืด
   *
   * ไม่มีค่า = ไม่ปั๊มอะไรเลย ปล่อยให้ prefers-color-scheme ทำงานตามปกติ
   */
  const theme = await getTheme();

  return (
    <html lang="th" data-theme={theme ?? undefined}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
