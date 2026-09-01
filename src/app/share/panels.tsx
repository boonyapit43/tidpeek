import { donutSlices } from "@/lib/chart";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { BreakdownRow } from "./breakdown-rows";

/**
 * การ์ดย่อยบนภาพสรุป — สามใบเรียงกัน ภาพรวม · รายรับ · รายจ่าย
 *
 * ผังนี้เจ้าของร้านออกแบบมาเอง แยกเป็นสามใบมีช่องไฟคั่นแทนลิสต์ต่อกันยาวๆ
 * แต่ละใบมีเส้นคั่นหัวกับเนื้อ และสองใบขวาปิดท้ายด้วยแถบยอดรวมพื้นสีอ่อน
 * ซึ่งทำให้ยอดรวมอ่านเป็นข้อสรุป ไม่ใช่แค่บรรทัดสุดท้ายของลิสต์
 *
 * ตัวหนังสือใหญ่กว่าที่ใช้ในแอปทั่วไปโดยตั้งใจ เพราะภาพนี้ถูกส่งเข้าแชทแล้ว
 * ถูกย่อตามความกว้างของช่อง ขนาดที่พออ่านบนจอจึงเล็กเกินไปในรูป
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** วงกลมไอคอนหัวการ์ด บอกทิศทางของเงินโดยไม่ต้องอ่านหัวข้อ */
function PanelHead({
  tone,
  icon,
  children,
}: {
  tone: "in" | "out" | "neutral";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // เส้นคั่นหัวกับเนื้อ ทำให้แต่ละการ์ดอ่านเป็นสองส่วนชัดเจน
    <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          tone === "in" && "bg-income-soft text-income",
          tone === "out" && "bg-expense-soft text-expense",
          tone === "neutral" && "bg-brand-soft text-brand",
        )}
      >
        {icon}
      </span>
      <h2 className="text-base font-bold text-ink">{children}</h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * การ์ดภาพรวม — วงเทียบรายรับกับรายจ่ายตรงๆ
 *
 * เขียว = รายรับ  แดง = รายจ่าย  สองส่วนแบ่งวงกันตามขนาดของตัวเอง
 * เขียวยาวกว่าแดง = เดือนนี้ขายได้มากกว่าที่จ่ายไป อ่านจบด้วยตาเดียว
 *
 * ⚠️ เคยทำเป็น วง = รายรับ แล้วซอยเป็น รายจ่าย กับ สุทธิ ซึ่งตอบคำถาม
 *    "ที่ขายมาเหลือกี่เปอร์เซ็นต์" ได้ดีกว่าในทางบัญชี แต่เจ้าของร้าน
 *    อ่านผิดสามครั้งติด — เห็นชิปเขียวเขียนว่ารายรับแล้วคาดว่าส่วนเขียว
 *    คือรายรับ พอรายรับ 20,000 มากกว่ารายจ่าย 17,000 แต่เขียวเล็กกว่าแดง
 *    ก็สรุปว่ากราฟมั่ว
 *
 *    กราฟที่ต้องอธิบายถึงจะเข้าใจคือกราฟที่ใช้ไม่ได้ ไม่ว่าจะถูกแค่ไหน
 *    ห้ามเปลี่ยนกลับ
 *
 * ตัวเลขจริงอยู่ครบในสามบรรทัดใต้วง วงเป็นแค่ทางลัดสายตา จึงไม่มี
 * เปอร์เซ็นต์ที่ไหนเลยในการ์ดนี้ — ผลรวมของวง (รับบวกจ่าย) ไม่ได้แปลว่าอะไร
 * เปอร์เซ็นต์ที่คิดจากมันจึงเป็นตัวเลขที่ไม่มีความหมาย
 */
export function OverviewPanel({
  income,
  expense,
  profit,
}: {
  income: string;
  expense: string;
  profit: string;
}) {
  const inAmount = Number.parseFloat(income) || 0;
  const outAmount = Number.parseFloat(expense) || 0;
  const loss = (Number.parseFloat(profit) || 0) < 0;

  // เขียวก่อนเสมอ แดงตามหลัง ลำดับเดียวกับสามบรรทัดใต้วง
  const slices = donutSlices([inAmount, outAmount]);

  /**
   * สามบรรทัดเรียงเหมือนกันเสมอ — เขียวรายรับก่อน แดงรายจ่าย ปิดท้ายด้วยสุทธิ
   * ลำดับคงที่ทำให้คนที่ดูภาพนี้ทุกวันกวาดตาหาตัวเลขได้จากตำแหน่งเดิม
   */
  const lines = [
    { label: "รายรับ", value: income, tone: "in" as const, net: false },
    { label: "รายจ่าย", value: expense, tone: "out" as const, net: false },
    {
      label: loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ",
      value: profit,
      tone: loss ? ("out" as const) : ("in" as const),
      net: true,
    },
  ];

  const netText = bahtShort(profit);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <PanelHead tone="neutral" icon={<PieIcon />}>
        ภาพรวม
      </PanelHead>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-4">
        <div className="relative">
          <svg
            viewBox="0 0 42 42"
            className="size-[9rem]"
            role="img"
            aria-label={`รายรับ ${bahtShort(income)} รายจ่าย ${bahtShort(expense)} ${
              loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"
            } ${netText}`}
          >
            {/* วงพื้นหลังจางๆ ทำให้เห็นขอบเขตของวงแม้ส่วนโค้งใดจะเล็กมาก */}
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth="5"
            />

            {slices.map((slice, i) => {
              if (slice.length <= 0) return null;

              // ส่วนแรกคือรายรับเสมอ
              const green = i === 0;

              return (
                <circle
                  key={i}
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="none"
                  stroke={green ? "var(--color-income)" : "var(--color-expense)"}
                  strokeWidth="5"
                  pathLength="100"
                  strokeDasharray={`${slice.length} ${100 - slice.length}`}
                  strokeDashoffset={-slice.offset}
                  // หมุนให้เริ่มที่สิบสองนาฬิกา ไม่ใช่สามนาฬิกาแบบค่าตั้งต้นของ SVG
                  transform="rotate(-90 21 21)"
                />
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3">
            <span
              className={cn(
                "num leading-none font-bold tracking-tight",
                /**
                 * ช่องว่างกลางวงกว้างราว 92px คงที่ แต่ยอดยาวไม่เท่ากัน
                 * ปล่อยขนาดเดียวแล้วยอดหลักหมื่นมีสตางค์จะทะลุขอบวงออกไป
                 * ซึ่งเจอจริงตอนทดสอบที่ยอด 84,316.25
                 */
                netText.length > 11 ? "text-base" : netText.length > 7 ? "text-lg" : "text-2xl",
                loss ? "text-expense" : "text-income",
              )}
            >
              {netText}
            </span>
            <span className="mt-1.5 text-[11px] leading-none text-ink-soft">
              {loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"}
            </span>
          </div>
        </div>
      </div>

      <dl className="space-y-1 px-3 pb-3">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn(
              "flex items-baseline gap-2.5 rounded-lg px-3 py-2 text-sm",
              line.net ? "mt-1 border-t border-line pt-2.5" : "bg-surface-2",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 shrink-0 self-center rounded-[3px]",
                line.tone === "in" ? "bg-income" : "bg-expense",
              )}
            />
            <dt className="min-w-0 flex-1 truncate text-ink-soft">{line.label}</dt>
            <dd
              className={cn(
                "num shrink-0 font-bold",
                line.net ? "text-lg" : "text-base",
                line.tone === "in" ? "text-income" : "text-expense",
              )}
            >
              {bahtShort(line.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * การ์ดแจกแจงฝั่งหนึ่ง ปิดท้ายด้วยแถบยอดรวมพื้นสีอ่อน
 *
 * แถบรวมถูกดันไปติดขอบล่างเสมอ (mt-auto) การ์ดสองใบจึงมีแถบรวมอยู่ระดับ
 * เดียวกันแม้จำนวนรายการไม่เท่ากัน ซึ่งเป็นสิ่งที่ตาใช้เทียบสองฝั่ง
 */
export function BreakdownPanel({
  title,
  tone,
  rows,
  total,
  empty,
}: {
  title: string;
  tone: "in" | "out";
  rows: BreakdownRow[];
  total: string;
  empty: string;
}) {
  const income = tone === "in";

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <PanelHead tone={tone} icon={income ? <ArrowInIcon /> : <ArrowOutIcon />}>
        {title}
      </PanelHead>

      {rows.length === 0 ? (
        <p className="flex-1 px-4 py-10 text-center text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="flex-1 px-4 py-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline gap-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-ink">{row.name}</span>
              <span
                className={cn(
                  "num shrink-0 text-base font-bold",
                  income ? "text-income" : "text-expense",
                )}
              >
                {bahtShort(row.total)}
              </span>
              <span className="num w-9 shrink-0 text-right text-ink-soft">{row.percent}%</span>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "mt-auto flex items-baseline justify-between gap-3 px-4 py-3",
          income ? "bg-income-wash" : "bg-expense-wash",
        )}
      >
        <span className="text-sm font-semibold text-ink">
          {income ? "รวมรายรับ" : "รวมรายจ่าย"}
        </span>
        <span
          className={cn(
            "num text-xl font-bold tracking-tight",
            income ? "text-income" : "text-expense",
          )}
        >
          {bahtShort(total)}
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...stroke}>
      <path d="M21 12a9 9 0 1 1-9-9v9h9Z" />
    </svg>
  );
}

/** ลูกศรชี้ลง = เงินเข้ากระเป๋า */
function ArrowInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...stroke}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

/** ลูกศรชี้ออกเฉียงขึ้น = เงินออกจากร้าน */
function ArrowOutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...stroke}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
