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
    /**
     * ⚠️ ห้ามกลับไปใช้ black-translucent
     *
     * มันทำให้เนื้อหาวาดทะลุใต้แถบสถานะได้จริง แต่ iOS รายงานความสูงของ
     * viewport มาสั้นกว่าจอเท่ากับความสูงแถบสถานะพอดี วัดจากเครื่องจริง
     * (iPhone จอ 430×932) ได้
     *
     *   screen.height        932
     *   innerHeight          873   ← สั้นไป 59
     *   safe-area บน          59px  ← เท่ากับส่วนที่หายพอดี
     *
     * ผลคือของที่ปักไว้ bottom:0 อย่างแถบเมนูล่างจบที่ 873 แล้วเหลือช่อง
     * 873 ถึง 932 ที่ไม่มีอะไรวาดถึงได้เลย ไม่ว่าจะเขียน CSS ยังไง เพราะ
     * มันอยู่นอก viewport ทั้งหมด — ทาพื้นที่ html ก็ไม่ช่วย ลองมาแล้ว
     * แถบเมนูจึงลอยเหนือขอบจอ 59px ตลอดเวลา
     *
     * black แทน — iOS จัดพื้นที่ให้ viewport อยู่ใต้แถบสถานะ ความสูงที่
     * รายงานจึงตรงกับพื้นที่จริงที่ใช้ได้ bottom:0 กลายเป็นขอบล่างของจริง
     *
     * แลกกับการไม่ได้ลุคเนื้อหาทะลุใต้แถบสถานะ ซึ่งเป็นราคาที่ถูกกว่า
     * แถบเมนูที่ลอยอยู่ตลอดเวลามาก
     *
     * env(safe-area-inset-top) จะกลายเป็น 0 เอง แถบหัวแอปที่เผื่อไว้ด้วย
     * env() จึงยุบลงให้พอดีโดยไม่ต้องแก้อะไร
     */
    statusBarStyle: "black",
  },

  /**
   * ⚠️ ต้องเขียน apple-mobile-web-app-capable เองเพิ่ม
   *
   * capable: true ข้างบนทำให้ Next.js 16 ใส่ให้แค่ <meta mobile-web-app-capable>
   * ซึ่งเป็นชื่อมาตรฐานตัวใหม่ ไม่ใส่ตัวที่ขึ้นต้นด้วย apple- ให้แล้ว
   * (ตรวจจาก HTML ที่ production ส่งจริง — มีแต่ตัวไม่มี apple-)
   *
   * แต่ iOS ยังผูก apple-mobile-web-app-status-bar-style ไว้กับตัวเก่าอยู่
   * ขาดตัวนี้แล้ว black-translucent ไม่ทำงานเต็มที่ ผลที่เจ้าของร้านเจอคือ
   * แถบเมนูล่างลอยอยู่เหนือขอบจอจริงราว 60px แล้วเห็นพื้นหน้าโผล่ใต้เมนู
   * (วัดจากภาพหน้าจอบน iPhone 17 Pro Max — ขอบบนถูกต้อง ขอบล่างไม่ถูก)
   */
  other: { "apple-mobile-web-app-capable": "yes" },
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
   * สีแถบสถานะ ต้องเท่ากับ --chrome-from ของแต่ละโหมด ไม่ใช่สีพื้นหน้า
   *
   * สิ่งที่อยู่ติดกับแถบสถานะคือแถบหัวแอป ซึ่งติดหนึบอยู่บนสุดเสมอ
   * ไม่ใช่พื้นหลังของหน้า เคยตั้งเป็นสีพื้นหน้า (ขาว) ซึ่งทำให้เห็นเส้น
   * แบ่งคาจอระหว่างแถบสถานะขาวกับแถบหัวสีเข้มที่อยู่ใต้มันทันที
   * ตรงข้ามกับที่ตั้งใจไว้ใน (app)/layout.tsx ว่าให้ไล่ต่อกันเป็นผืนเดียว
   *
   * หน้า /share ก็มีแถบหัวสีเดียวกันนี้ จึงต่อเนื่องด้วย
   * เหลือแค่หน้าล็อกอินกับหน้าเลือกร้านที่พื้นสว่าง ซึ่งเปิดวันละครั้ง
   *
   * ⚠️ แก้ที่นี่แล้วต้องแก้ --chrome-from ใน globals.css และ theme_color
   *    ใน manifest.ts ให้ตรงกันทั้งสามที่
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#830001" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2220" },
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
