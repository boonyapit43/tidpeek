import { donutSlices } from "@/lib/chart";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { BreakdownRow } from "./breakdown-rows";

/**
 * การ์ดย่อยบนภาพสรุป — สามใบเรียงกัน ภาพรวม · รับมาจากไหน · ใช้ไปกับอะไร
 *
 * ผังนี้เจ้าของร้านออกแบบมาเอง แยกเป็นสามใบมีช่องไฟคั่นแทนลิสต์ต่อกันยาวๆ
 * และปิดท้ายแต่ละใบด้วยแถบยอดรวมพื้นสีอ่อน ซึ่งทำให้ยอดรวมอ่านเป็นข้อสรุป
 * ไม่ใช่แค่บรรทัดสุดท้ายของลิสต์
 */

/* ------------------------------------------------------------------ */

/** วงกลมไอคอนหัวการ์ด บอกทิศทางของเงินโดยไม่ต้องอ่านหัวข้อ */
function HeadIcon({ tone, children }: { tone: "in" | "out" | "neutral"; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        tone === "in" && "bg-income-soft text-income",
        tone === "out" && "bg-expense-soft text-expense",
        tone === "neutral" && "bg-brand-soft text-brand",
      )}
    >
      {children}
    </span>
  );
}

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
    <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-1">
      <HeadIcon tone={tone}>{icon}</HeadIcon>
      <h2 className="text-sm font-bold text-ink">{children}</h2>
    </div>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/* ------------------------------------------------------------------ */

/**
 * การ์ดภาพรวม — วงแหวนกับสามบรรทัดที่บวกลบกันได้ลงตัว
 *
 * วงคือก้อนที่ใหญ่กว่าเสมอ แล้วซอยเป็นสองส่วน
 *
 *   กำไร   วง = รายรับ  แดง = รายจ่าย  เขียว = กำไรสุทธิ
 *   ขาดทุน วง = รายจ่าย  เขียว = รายรับ  แดง = ขาดทุนสุทธิ
 *
 * ถ้าตรึงวงไว้ที่รายรับเสมอ เดือนที่จ่ายมากกว่าขาย ส่วนโค้งแดงจะยาวเกิน
 * หนึ่งวงแล้ววนไปทับตัวเอง ซึ่งวาดออกมาแล้วดูเหมือนจ่ายไปนิดเดียว
 *
 * ⚠️ เปอร์เซ็นต์ขึ้นเฉพาะบรรทัดที่เป็นส่วนโค้งจริง
 *    บรรทัดที่เป็น "ทั้งวง" ไม่มีเปอร์เซ็นต์ เพราะมันคือร้อยเปอร์เซ็นต์
 *    เคยพลาดมาแล้วสองรอบ — เอา 26% ของก้อนที่ขาดไปแปะไว้ที่บรรทัดรายจ่าย
 *    ซึ่งเป็นทั้งวง คนอ่านเห็นแล้วงงว่าทำไมรายจ่ายมีแค่ 26%
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

  const [first, second] = loss
    ? [inAmount, outAmount - inAmount]
    : [outAmount, inAmount - outAmount];

  const slices = donutSlices([first, second]);
  const hasRing = slices.length > 0;

  /**
   * ปัดให้สองส่วนรวมกันได้ 100 พอดี
   *
   * ปัดแยกกันแล้ว 46.5% กับ 53.5% จะกลายเป็น 47% กับ 54% ซึ่งรวมได้ 101%
   * บนวงที่มีแค่สองส่วนแบ่งกันทั้งวง คนอ่านบวกตามแล้วเจอว่าเกิน
   */
  const firstPercent = hasRing ? Math.round(slices[0].fraction * 100) : 0;
  const percents = [firstPercent, hasRing ? 100 - firstPercent : 0];

  /**
   * สามบรรทัดเรียงเหมือนกันเสมอ — เขียวรายรับก่อน แดงรายจ่าย ปิดท้ายด้วยสุทธิ
   * ลำดับคงที่ทำให้คนที่ดูภาพนี้ทุกวันกวาดตาหาตัวเลขได้จากตำแหน่งเดิม
   *
   * ตัวไหนเป็นทั้งวงจะไม่มีเปอร์เซ็นต์ ซึ่งสลับกันตามว่ากำไรหรือขาดทุน
   */
  const lines = [
    {
      label: "รายรับ",
      value: income,
      tone: "in" as const,
      percent: loss ? percents[0] : null,
    },
    {
      label: "รายจ่าย",
      value: expense,
      tone: "out" as const,
      percent: loss ? null : percents[0],
    },
    {
      label: loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ",
      value: profit,
      tone: loss ? ("out" as const) : ("in" as const),
      percent: percents[1],
      net: true,
    },
  ];

  const netText = bahtShort(profit);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <PanelHead tone="neutral" icon={<PieIcon />}>
        ภาพรวม
      </PanelHead>

      <div className="flex flex-1 flex-col items-center justify-center px-3.5 py-3">
        <div className="relative">
          <svg
            viewBox="0 0 42 42"
            className="size-[8.5rem]"
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

              // ส่วนแรกคือก้อนที่เล็กกว่า สีตามว่ากำไรหรือขาดทุน
              const green = loss ? i === 0 : i === 1;

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
                 * ช่องว่างกลางวงกว้างราว 87px คงที่ แต่ยอดยาวไม่เท่ากัน
                 * ปล่อยขนาดเดียวแล้วยอดหลักหมื่นมีสตางค์จะทะลุขอบวงออกไป
                 * ซึ่งเจอจริงตอนทดสอบที่ยอด 84,316.25
                 */
                netText.length > 11 ? "text-sm" : netText.length > 7 ? "text-base" : "text-xl",
                loss ? "text-expense" : "text-income",
              )}
            >
              {netText}
            </span>
            <span className="mt-1 text-[10px] leading-none text-ink-soft">
              {loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"}
            </span>
            {hasRing && (
              <span className="num mt-0.5 text-[10px] leading-none text-ink-soft">
                {percents[1]}%
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="space-y-1 px-3 pb-3">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn(
              "flex items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-xs",
              line.net ? "border-t border-line pt-2" : "bg-surface-2",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 self-center rounded-[2px]",
                line.tone === "in" ? "bg-income" : "bg-expense",
              )}
            />
            <dt className="min-w-0 flex-1 truncate text-ink-soft">{line.label}</dt>
            <dd
              className={cn(
                "num shrink-0 font-bold",
                line.net && "text-sm",
                line.tone === "in" ? "text-income" : "text-expense",
              )}
            >
              {bahtShort(line.value)}
            </dd>
            {/* ช่องเปอร์เซ็นต์กว้างคงที่ทุกบรรทัด ยอดของทุกบรรทัดจึงอยู่ตรงกัน
                แม้บรรทัดที่เป็นทั้งวงจะไม่มีเปอร์เซ็นต์ */}
            <dd className="num w-7 shrink-0 text-right text-ink-soft">
              {line.percent === null ? "" : `${line.percent}%`}
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
        <p className="flex-1 px-3.5 py-8 text-center text-xs text-ink-soft">{empty}</p>
      ) : (
        <ul className="flex-1 px-3.5 py-1.5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline gap-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate text-ink">{row.name}</span>
              <span className={cn("num shrink-0 font-bold", income ? "text-income" : "text-expense")}>
                {bahtShort(row.total)}
              </span>
              <span className="num w-7 shrink-0 text-right text-ink-soft">{row.percent}%</span>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "mt-auto flex items-baseline justify-between gap-3 px-3.5 py-2.5",
          income ? "bg-income-wash" : "bg-expense-wash",
        )}
      >
        <span className="text-xs font-semibold text-ink">
          {income ? "รวมรายรับ" : "รวมรายจ่าย"}
        </span>
        <span
          className={cn(
            "num text-base font-bold tracking-tight",
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
    <svg viewBox="0 0 24 24" className="size-4" {...stroke}>
      <path d="M21 12a9 9 0 1 1-9-9v9h9Z" />
    </svg>
  );
}

/** ลูกศรชี้ลง = เงินเข้ากระเป๋า */
function ArrowInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" {...stroke}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

/** ลูกศรชี้ออกเฉียงขึ้น = เงินออกจากร้าน */
function ArrowOutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" {...stroke}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
