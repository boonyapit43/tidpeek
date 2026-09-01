import { donutSlices } from "@/lib/chart";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * วงแหวนรายรับ–รายจ่าย พร้อมสรุปสามบรรทัด
 *
 * วงคือก้อนที่ใหญ่กว่าเสมอ แล้วซอยเป็นสองส่วน
 *
 *   กำไร   วง = รายรับ  แดง = รายจ่าย  เขียว = สุทธิที่เหลือ
 *          อ่านได้ว่า "ที่ขายมาทั้งหมด จ่ายออกไปเท่านี้ เหลือเท่านี้"
 *
 *   ขาดทุน วง = รายจ่าย  เขียว = รายรับที่คุ้ม  แดง = ส่วนที่ขาด
 *          อ่านได้ว่า "ที่จ่ายไปทั้งหมด ขายมาคุ้มแค่เท่านี้"
 *
 * ถ้าตรึงวงไว้ที่รายรับเสมอ เดือนที่จ่ายมากกว่าขาย ส่วนโค้งแดงจะยาวเกิน
 * หนึ่งวงแล้ววนไปทับตัวเอง ซึ่งวาดออกมาแล้วดูเหมือนจ่ายไปนิดเดียว
 *
 * ⚠️ ป้ายสีต้องตรงกับส่วนโค้งเป๊ะๆ
 *    เคยพลาดมาแล้ว — ป้ายเขียวเขียนว่า "รายรับ 20,914" ทั้งที่ส่วนโค้งเขียว
 *    คือสุทธิ 3,010 คนอ่านเห็นวงเขียวนิดเดียวแล้วงงว่าทำไมรายรับดูน้อยจัง
 *    ทั้งที่ตัวเลขข้างๆ บอกว่าสองหมื่น ตัวที่เป็น "ทั้งวง" จึงไม่มีชิปสี
 *    เพราะมันไม่ใช่ส่วนโค้งไหนเลย
 *
 * ⚠️ เขียวกับแดงเป็นคู่ที่คนตาบอดสีแยกไม่ออก ทุกส่วนโค้งจึงต้องมีชื่อกับยอด
 *    กำกับข้างล่างเสมอ ห้ามเหลือแต่วงเปล่าๆ — กติกาเดียวกับทั้งแอป
 */
export function NetDonut({
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
  const net = Number.parseFloat(profit) || 0;
  const loss = net < 0;

  /**
   * สามบรรทัดใต้วง — บรรทัดแรกคือทั้งวง อีกสองบรรทัดคือส่วนโค้งทั้งสอง
   *
   * บวกลบกันได้ลงตัวเสมอ บรรทัดแรกลบบรรทัดสอง เท่ากับบรรทัดสาม
   * ซึ่งเป็นสิ่งที่คนอ่านจะลองคิดตามด้วยตา
   */
  const whole = loss
    ? { label: "รายจ่าย", value: expense }
    : { label: "รายรับ", value: income };

  const parts = loss
    ? [
        { label: "รายรับ", value: income, tone: "income" as const },
        { label: "ขาดทุนสุทธิ", value: profit, tone: "expense" as const },
      ]
    : [
        { label: "รายจ่าย", value: expense, tone: "expense" as const },
        { label: "กำไรสุทธิ", value: profit, tone: "income" as const },
      ];

  const [first, second] = loss
    ? [inAmount, outAmount - inAmount]
    : [outAmount, inAmount - outAmount];

  const slices = donutSlices([first, second]);
  const hasRing = slices.length > 0;

  /**
   * ปัดเปอร์เซ็นต์ให้สองส่วนรวมกันได้ 100 พอดี
   *
   * ปัดแยกกันแล้ว 46.5% กับ 53.5% จะกลายเป็น 47% กับ 54% ซึ่งรวมได้ 101%
   * บนภาพที่มีแค่สองส่วนแบ่งกันทั้งวง คนอ่านบวกตามแล้วเจอว่าเกิน
   * ให้ส่วนหลังเป็นเศษที่เหลือจากส่วนแรก สองตัวจึงรวมกันได้ร้อยเสมอ
   */
  const firstPercent = hasRing ? Math.round(slices[0].fraction * 100) : 0;
  const percents = [firstPercent, hasRing ? 100 - firstPercent : 0];

  /**
   * ยอดสุทธิย่อลงตามความยาว ไม่ให้ล้นออกนอกวง
   *
   * ช่องว่างกลางวงกว้างคงที่ แต่ยอดยาวไม่เท่ากัน — ร้านที่ทำได้หลักหมื่น
   * กับหลักล้านใช้ขนาดเดียวกันไม่ได้ ปล่อยไว้แล้วตัวเลขจะทะลุขอบวงออกไป
   * ซึ่งเจอจริงตอนทดสอบที่ยอด 84,316.25
   */
  const netText = bahtShort(profit);
  const netSize =
    netText.length > 12
      ? "text-[10px] sm:text-sm"
      : netText.length > 9
        ? "text-xs sm:text-base"
        : "text-sm sm:text-lg";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative">
        <svg
          viewBox="0 0 42 42"
          className="size-[7rem] sm:size-[8.5rem]"
          role="img"
          aria-label={`${whole.label} ${bahtShort(whole.value)} แบ่งเป็น ${parts
            .map((p) => `${p.label} ${bahtShort(p.value)}`)
            .join(" และ ")}`}
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

            return (
              <circle
                key={parts[i].label}
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke={
                  parts[i].tone === "income" ? "var(--color-income)" : "var(--color-expense)"
                }
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

        {/* ยอดสุทธิอยู่กลางวง เพราะเป็นตัวเลขที่คนรับดูก่อนอย่างอื่น */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3">
          <span
            className={cn(
              "num leading-none font-bold tracking-tight",
              netSize,
              loss ? "text-expense" : "text-income",
            )}
          >
            {netText}
          </span>
          <span className="mt-1 text-[10px] leading-none text-ink-soft">
            {loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"}
          </span>
        </div>
      </div>

      <dl className="w-full space-y-0.5 text-[11px]">
        {/* ทั้งวง — ไม่มีชิปสี เพราะไม่ใช่ส่วนโค้งไหนเลย */}
        <Row label={whole.label} value={whole.value} />

        {parts.map((part, i) => (
          <Row
            key={part.label}
            label={part.label}
            value={part.value}
            tone={part.tone}
            percent={percents[i]}
            // เส้นคั่นเหนือบรรทัดสุดท้าย ทำให้อ่านเป็นการลบเลขอย่างที่มันเป็นจริง
            divided={i === parts.length - 1}
          />
        ))}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  percent,
  divided,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
  percent?: number;
  divided?: boolean;
}) {
  const color =
    tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-ink";

  return (
    <div className={cn("flex items-baseline gap-1.5", divided && "mt-1 border-t border-line pt-1")}>
      {tone ? (
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-[2px]",
            tone === "income" ? "bg-income" : "bg-expense",
          )}
        />
      ) : (
        // เว้นที่เท่าชิปสี ให้ชื่อของทุกบรรทัดเริ่มตรงกัน
        <span aria-hidden className="size-2 shrink-0" />
      )}

      <dt className="min-w-0 flex-1 truncate text-ink-soft">{label}</dt>
      <dd className={cn("num shrink-0 font-bold", color)}>{bahtShort(value)}</dd>
      <dd className="num w-7 shrink-0 text-right text-ink-soft">
        {percent === undefined ? "" : `${percent}%`}
      </dd>
    </div>
  );
}
