import type { Metadata, Viewport } from "next";
import { getTheme } from "@/lib/theme";
import "./globals.css";

/**
 * ไอคอนไม่ต้องประกาศตรงนี้ Next.js หยิบให้เองจากไฟล์ที่วางตามชื่อ
 *   src/app/icon.png        ไอคอนบนแท็บเบราว์เซอร์
 *   src/app/apple-icon.png  ไอคอนตอนปักหน้าจอโฮมของ iOS
 * ส่วนไอคอนของ manifest อยู่ใน public/ ดู src/app/manifest.ts
 *
 * ทั้งหมดสร้างจาก assets/app-icon.png ด้วย scripts/gen-icons.mjs
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

  /**
   * สีแถบสถานะ ต้องเท่ากับ --band-from ของแต่ละโหมด ไม่ใช่สีพื้นหน้า
   *
   * สิ่งที่อยู่ติดกับแถบสถานะคือแถบหัวแอป ซึ่งติดหนึบอยู่บนสุดเสมอ
   * ไม่ใช่พื้นหลังของหน้า เคยตั้งเป็นสีพื้นหน้า (ขาว) ซึ่งทำให้เห็นเส้น
   * แบ่งคาจอระหว่างแถบสถานะขาวกับแถบหัวสีเข้มที่อยู่ใต้มันทันที
   * ตรงข้ามกับที่ตั้งใจไว้ใน (app)/layout.tsx ว่าให้ไล่ต่อกันเป็นผืนเดียว
   *
   * หน้า /share ก็ใช้สีเดียวกันนี้เป็นพื้นทั้งหน้า จึงต่อเนื่องด้วย
   * เหลือแค่หน้าล็อกอินกับหน้าเลือกร้านที่พื้นสว่าง ซึ่งเปิดวันละครั้ง
   *
   * ⚠️ แก้ที่นี่แล้วต้องแก้ --band-from ใน globals.css และ theme_color
   *    ใน manifest.ts ให้ตรงกันทั้งสามที่
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#830001" },
    { media: "(prefers-color-scheme: dark)", color: "#620000" },
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
