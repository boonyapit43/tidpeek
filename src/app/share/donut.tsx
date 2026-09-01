import { donutSlices } from "@/lib/chart";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * วงแหวนรายรับ–รายจ่าย พร้อมยอดสุทธิตรงกลาง
 *
 * มีสองสีเท่านั้น เขียว = เงินเข้า แดง = เงินออก ตามภาษาสีของทั้งแอป
 * ไม่ใช่จานสีแยกตามประเภท เพราะคำถามที่ภาพนี้ตอบคือ "ได้เท่าไหร่ เหลือเท่าไหร่"
 * ไม่ใช่ "แต่ละประเภทกินไปกี่เปอร์เซ็นต์" — อันหลังอยู่ในลิสต์ข้างๆ แล้ว
 *
 * ⚠️ สีเขียว/แดงเป็นคู่ที่คนตาบอดสีแยกไม่ออก ทุกชิ้นจึงต้องมีชื่อกับยอด
 *    กำกับข้างล่างเสมอ ห้ามเหลือแต่วงเปล่าๆ — กติกาเดียวกับทั้งแอป
 *
 * วาดด้วย stroke-dasharray บนวงกลมวงเดียว ตั้ง pathLength="100" ไว้
 * ตัวเลขที่คำนวณมาจึงเป็นเปอร์เซ็นต์ตรงๆ ไม่ต้องยุ่งกับรัศมีจริงเลย
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
   * วงคือก้อนที่ใหญ่กว่าเสมอ แล้วอีกก้อนเป็นชิ้นข้างใน
   *
   * กำไร: วง = รายรับ ชิ้นแดง = รายจ่าย ที่เหลือคือส่วนที่เก็บไว้ได้
   *        อ่านได้ว่า "ที่ขายมาทั้งหมด จ่ายออกไปเท่านี้ เหลือเท่านี้"
   *
   * ขาดทุน: วง = รายจ่าย ชิ้นเขียว = รายรับ ที่เหลือคือส่วนที่ขายไม่พอจ่าย
   *        อ่านได้ว่า "ที่จ่ายไปทั้งหมด ขายมาคุ้มแค่เท่านี้"
   *
   * ทำแบบนี้เพราะถ้าตรึงวงไว้ที่รายรับเสมอ เดือนที่จ่ายมากกว่าขาย ชิ้นแดงจะ
   * ยาวเกินหนึ่งวงแล้ววนไปทับตัวเอง ซึ่งวาดออกมาแล้วอ่านไม่ได้ความ
   */
  const [first, second] = loss
    ? [inAmount, outAmount - inAmount]
    : [outAmount, inAmount - outAmount];

  const slices = donutSlices([first, second]);

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
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg
          viewBox="0 0 42 42"
          className="size-[7rem] sm:size-[9.5rem]"
          role="img"
          aria-label={`รายรับ ${bahtShort(income)} รายจ่าย ${bahtShort(expense)} ${loss ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"} ${bahtShort(profit)}`}
        >
          {/* วงพื้นหลังจางๆ ทำให้เห็นขอบเขตของวงแม้ชิ้นใดชิ้นหนึ่งจะเล็กมาก */}
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

            // ชิ้นแรกคือก้อนที่เล็กกว่า สีตามว่ากำไรหรือขาดทุน
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

      {/**
        * ชื่อกับยอดของทั้งสองก้อน — ไม่ใช่ของประดับ
        *
        * เป็นทางเดียวที่คนตาบอดสีจะรู้ว่าชิ้นไหนคือเงินเข้าเงินออก และเป็นที่ที่
        * ตัวเลขจริงอยู่ ส่วนวงบอกแค่สัดส่วน
        */}
      <ul className="flex items-baseline gap-4 text-[11px]">
        <Legend label="รายรับ" value={income} tone="income" />
        <Legend label="รายจ่าย" value={expense} tone="expense" />
      </ul>
    </div>
  );
}

function Legend({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
}) {
  return (
    <li className="flex items-baseline gap-1.5">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-[2px]",
          tone === "income" ? "bg-income" : "bg-expense",
        )}
      />
      <span className="text-ink-soft">{label}</span>
      <span
        className={cn("num font-bold", tone === "income" ? "text-income" : "text-expense")}
      >
        {bahtShort(value)}
      </span>
    </li>
  );
}
