import Link from "next/link";
import { barLayout } from "@/lib/chart";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

export type TrendPoint = {
  key: string;
  /** ป้ายใต้แท่ง — เว้นว่างได้ในเดือนที่ช่องแคบจนใส่ทุกวันไม่ไหว */
  label: string;
  /** คำอธิบายเต็มของช่องนี้ ใช้ใน tooltip และ aria-label */
  title: string;
  /** กำไรของช่วงนั้นเป็น string ตามกฎเงินของแอป แปลงเป็นตัวเลขตอนวาดเท่านั้น */
  profit: string;
  href: string;
};

/**
 * กราฟแท่งกำไรตามช่วงเวลา — ตอบ "วันไหนดีวันไหนแย่" ด้วยตาเดียว
 *
 * กำไร/ขาดทุนบอกด้วย "ตำแหน่ง" เป็นหลัก แท่งบวกยืนเหนือเส้นศูนย์ แท่งลบ
 * ห้อยลงใต้เส้น สีเขียวแดงเป็นตัวเสริมเท่านั้น เพราะเป็นคู่สีที่คนตาบอดสี
 * แยกไม่ออก (ตรวจแล้ว) — ห้ามออกแบบอะไรในนี้ให้ต้องพึ่งสีอย่างเดียว
 *
 * เป็น HTML ธรรมดาไม่ใช่ SVG เพื่อให้ยืดตามจอโดยแท่งไม่บิดเบี้ยว และใช้
 * โทเคนสีของแอปผ่าน class ได้ตรงๆ โหมดมืดจึงถูกเองโดยไม่ต้องทำอะไรเพิ่ม
 *
 * ตัวเลขจริงอยู่ในตารางแจกแจงถัดลงไป กราฟเป็นทางลัดสายตา ไม่ใช่แหล่งข้อมูล
 * แต่ละแท่งแตะแล้วไปหน้าของช่วงนั้นได้เลย
 */
export function TrendChart({ heading, points }: { heading: string; points: TrendPoint[] }) {
  const values = points.map((p) => Number.parseFloat(p.profit) || 0);

  // ยังไม่มีเงินเดินเลยทั้งช่วง — ไม่ต้องโชว์กราฟว่างให้สงสัยว่าพัง
  // ข้อความ "ยังไม่มีรายการ" อยู่ในตารางข้างล่างแล้ว
  if (values.every((v) => v === 0)) return null;

  const { baseline, bars } = barLayout(values);

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <h2 className="border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-soft">
        {heading}
      </h2>

      <div className="px-3 pt-3 pb-2">
        <div className="relative h-32">
          {/* เส้นศูนย์ — จุดอ้างอิงหลักของทั้งกราฟ ต้องเห็นเสมอ */}
          <div
            aria-hidden
            className="absolute right-0 left-0 border-t border-line"
            style={{ top: `${baseline}%` }}
          />

          <div className="absolute inset-0 flex items-stretch">
            {points.map((point, i) => {
              const bar = bars[i];
              const loss = bar.negative;

              return (
                <Link
                  key={point.key}
                  href={point.href}
                  title={point.title}
                  aria-label={point.title}
                  className="group relative min-w-0 flex-1"
                >
                  {bar.height > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute right-[15%] left-[15%] transition group-hover:opacity-80",
                        loss ? "rounded-b-sm bg-expense" : "rounded-t-sm bg-income",
                      )}
                      style={{ top: `${bar.top}%`, height: `${bar.height}%` }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ป้ายแกนเวลา — โชว์ห่างๆ พอให้เทียบตำแหน่งได้ ไม่แน่นจนอ่านไม่ออก */}
        <div aria-hidden className="mt-1 flex">
          {points.map((point) => (
            <span
              key={point.key}
              // overflow-visible ไม่ใช่ truncate — ช่องของวันแคบกว่าตัวเลขสองหลัก
              // ถ้าปล่อยให้ตัด ป้ายจะกลายเป็น "1.. 2.." ที่อ่านไม่รู้เรื่อง
              className="min-w-0 flex-1 overflow-visible text-center text-[10px] whitespace-nowrap text-ink-soft"
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** ประโยคใน tooltip ของแต่ละแท่ง เช่น "1 ก.ย. กำไร 1,250" */
export function pointTitle(label: string, profit: string): string {
  const n = Number.parseFloat(profit) || 0;
  if (n === 0) return `${label} ไม่มีรายการ`;
  return `${label} ${n < 0 ? "ขาดทุน" : "กำไร"} ${bahtShort(Math.abs(n))}`;
}
