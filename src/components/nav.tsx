"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * แถบเมนูหลัก
 *
 * บนมือถือยึดติดขอบล่างจอ เพราะนิ้วโป้งเอื้อมถึงง่ายกว่าขอบบนมาก
 * เวลาถือเครื่องมือเดียว ซึ่งเป็นท่าที่คนใช้แอปนี้ตอนยืนหน้าร้าน
 *
 * ตั้งแต่จอ md ขึ้นไปย้ายขึ้นไปอยู่บนสุดแบบไหลตามเนื้อหา เพราะบนจอใหญ่
 * เมนูลอยอยู่ล่างจอดูแปลกและกินพื้นที่โดยเปล่าประโยชน์
 *
 * ห้าช่องบนจอ 375px ได้ช่องละ 75px ซึ่งกว้างกว่าขั้นต่ำ 44px อยู่มาก
 * และเป็นจำนวนช่องมาตรฐานของแถบเมนูบน iOS อยู่แล้ว
 * ถ้าจะเพิ่มช่องที่หก ให้คิดเรื่องลำดับความสำคัญก่อน ไม่ใช่เรื่องขนาดปุ่ม
 *
 * ค้นหาไม่ได้เป็นช่องหนึ่งในนี้ เพราะใช้นานๆ ครั้ง อยู่ที่หน้ารายวันแทน
 */

type Item = { href: string; label: string; icon: React.ReactNode };

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-6 md:size-5",
  "aria-hidden": true,
};

/**
 * สรุปอยู่ช่องแรกสุด ตามที่เจ้าของร้านขอ — เปิดแอปมาก็ลงหน้าสรุปอยู่แล้ว
 * เมนูช่องแรกกับหน้าที่เปิดมาเจอจึงเป็นอันเดียวกัน ไม่ใช่เปิดมาที่หน้าหนึ่ง
 * แต่เมนูไฮไลต์อยู่ช่องที่สี่ให้งงว่าตัวเองอยู่ตรงไหน
 * ส่วนบันทึกอยู่ถัดมาเป็นช่องที่สอง ยังกดเดียวถึงเหมือนเดิม
 */
const ITEMS: Item[] = [
  {
    href: "/summary",
    label: "สรุป",
    icon: (
      <svg {...iconProps}>
        <path d="M4 19V10M10 19V5M16 19v-6M22 19H2" />
      </svg>
    ),
  },
  {
    href: "/",
    label: "บันทึก",
    icon: (
      <svg {...iconProps}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/day",
    label: "รายวัน",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/accounts",
    label: "บัญชี",
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <path d="M2 11h20M6 15h4" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "ตั้งค่า",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        // มือถือ: ตรึงขอบล่าง ทับเนื้อหา
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md",
        // เว้นที่ให้แถบ home ของ iPhone ไม่ให้ทับปุ่ม
        "pb-[env(safe-area-inset-bottom)]",
        // จอใหญ่: กลับมาไหลตามเนื้อหาที่ด้านบน
        "md:static md:z-auto md:rounded-2xl md:border md:pb-0 md:shadow-sm",
      )}
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                // aria-current บอกโปรแกรมอ่านหน้าจอว่าอยู่หน้าไหน
                // ไม่ได้พึ่งแค่สีซึ่งคนตาบอดสีแยกไม่ออก
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mx-1 my-1 flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-xl py-1.5",
                  "text-xs font-medium transition-colors",
                  "md:mx-1.5 md:my-1.5 md:flex-row md:gap-2 md:py-2.5 md:text-sm",
                  // แท็บที่เปิดอยู่ได้พื้นสีอ่อน ไม่ใช่แค่เปลี่ยนสีตัวอักษร
                  // เห็นจากหางตาได้ทันทีว่าอยู่หน้าไหน
                  active ? "bg-brand-soft text-brand" : "text-ink-soft hover:text-ink",
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
