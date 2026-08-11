import type { MetadataRoute } from "next";

/**
 * ไฟล์นี้ทำให้ปักแอปไว้ที่หน้าโฮมของมือถือได้ แล้วเปิดขึ้นมาเต็มจอ
 * เหมือนแอปจริง ไม่มีแถบที่อยู่เว็บของเบราว์เซอร์มากินพื้นที่
 *
 * display standalone คือส่วนที่ทำให้แถบที่อยู่หายไป
 *
 * ไอคอนสร้างจาก src/app/icon.svg ด้วย scripts/gen-icons.mjs
 * แก้ลายที่ไฟล์ SVG แล้วรันสคริปต์ใหม่ อย่าแก้ PNG โดยตรง
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tidpeek — บัญชีร้าน",
    // ชื่อใต้ไอคอนบนหน้าโฮม ยาวเกินจะโดนตัดด้วย … จึงใช้ชื่อแอปล้วน
    short_name: "tidpeek",
    description: "บันทึกรายรับรายจ่ายรายวัน สรุปกำไรรายวัน รายเดือน รายปี แยกตามร้าน",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    lang: "th",
    // แนวตั้งอย่างเดียว เพราะทุกหน้าออกแบบมาสำหรับจอสูง
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /**
       * แยกไฟล์ maskable ต่างหาก ไม่ใช้ไฟล์เดียวกับ any
       *
       * Android ตัดไอคอนเป็นทรงตามธีมของเครื่อง (วงกลม สี่เหลี่ยม หยดน้ำ)
       * ถ้าส่งไฟล์ที่มีมุมโค้งมาให้ จะโดนตัดซ้อนอีกชั้นจนมุมกุด
       * ไฟล์ maskable จึงเป็นพื้นเต็มขอบและย่อลายไว้ในวงปลอดภัยตรงกลาง
       */
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
