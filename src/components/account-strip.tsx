import type { AccountWithBalance } from "@/db/queries";
import { bahtShort } from "@/lib/money";
import { cn } from "@/lib/cn";

const KIND_LABEL = {
  cash: "เงินสด",
  bank: "ธนาคาร",
  ewallet: "วอลเล็ต",
} as const;

/* สีประจำชนิดบัญชี ให้กวาดตาแยกบัญชีออกจากกันได้โดยไม่ต้องอ่านชื่อ */
const KIND_CHIP = {
  cash: "bg-cash-soft text-cash",
  bank: "bg-brand-soft text-brand",
  ewallet: "bg-wallet-soft text-wallet",
} as const;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-4",
  "aria-hidden": true,
};

const KIND_ICON = {
  // แบงก์ธนบัตร
  cash: (
    <svg {...iconProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.5 9.5v.01M18.5 14.5v.01" />
    </svg>
  ),
  // อาคารธนาคาร
  bank: (
    <svg {...iconProps}>
      <path d="M3 9.5 12 4l9 5.5M4.5 9.5V19M19.5 9.5V19M8 12v4.5M12 12v4.5M16 12v4.5M3 19h18" />
    </svg>
  ),
  // กระเป๋าเงิน
  ewallet: (
    <svg {...iconProps}>
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
      <path d="M16 13.5h.01" />
    </svg>
  ),
} as const;

/**
 * แถบยอดคงเหลือของแต่ละบัญชี
 *
 * เป็นตัวเลขที่คนเปิดแอปมาดูบ่อยที่สุด จึงอยู่บนสุดและเห็นได้โดยไม่ต้องกดอะไร
 *
 * บนมือถือเลื่อนแนวนอนพร้อม scroll snap ให้การ์ดหยุดตรงขอบพอดีทุกครั้ง
 * ถ้าใช้ grid แล้วตัดบรรทัด การ์ดจะแคบจนตัวเลขขึ้นบรรทัดใหม่และอ่านยาก
 */
export function AccountStrip({ accounts }: { accounts: AccountWithBalance[] }) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-soft">
        ยังไม่มีบัญชี เพิ่มได้ที่หน้าตั้งค่า
      </p>
    );
  }

  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1",
        // ซ่อนแถบเลื่อนบนเดสก์ท็อป การ์ดบอกอยู่แล้วว่าเลื่อนได้
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        // iPad ขึ้นไป: ย้ายไปอยู่แถบข้าง จึงเรียงลงมาเป็นคอลัมน์เดียว
        "md:mx-0 md:grid md:grid-cols-1 md:overflow-visible md:px-0",
      )}
    >
      {accounts.map((account) => {
        const negative = Number.parseFloat(account.balance) < 0;

        return (
          <div
            key={account.id}
            className="flex min-w-[10.5rem] shrink-0 snap-start items-center gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-sm md:min-w-0"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                KIND_CHIP[account.kind],
              )}
            >
              {KIND_ICON[account.kind]}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-ink-soft">{account.name}</span>
                {account.shopId === null && (
                  <span className="shrink-0 rounded bg-surface-2 px-1 py-px text-[10px] text-ink-soft">
                    ร่วม
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "num truncate text-lg leading-tight font-bold tracking-tight",
                  negative ? "text-expense" : "text-ink",
                )}
              >
                {bahtShort(account.balance)}
              </div>

              <div className="truncate text-[11px] text-ink-soft">
                {account.accountNo ?? account.bank ?? KIND_LABEL[account.kind]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
