import type { Metadata } from "next";
import Link from "next/link";
import { searchTotals, searchTransactions } from "@/db/queries";
import { DIRECTIONS } from "@/db/schema";
import { thaiDate } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { getShopContext } from "@/lib/shop";
import { cn } from "@/lib/cn";
import { SearchBox } from "./search-box";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ค้นหา" };

/**
 * ค้นหารายการย้อนหลัง
 *
 * ตั้งใจไม่ใส่เป็นแท็บที่ห้าในเมนูล่าง เพราะเมนูสี่ช่องคือขนาดที่นิ้วโป้ง
 * กดไม่พลาดบนมือถือ ช่องที่ห้าจะทำให้ทุกช่องแคบลงเพื่อฟีเจอร์ที่ใช้นานๆ ครั้ง
 * เข้าถึงจากปุ่มแว่นขยายที่หน้ารายวันแทน
 *
 * คำค้นอยู่ใน URL จึงกดย้อนกลับได้ และส่งลิงก์ผลค้นหาให้กันได้
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; d?: string }>;
}) {
  const context = await getShopContext();
  if (!context) return null;

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  // ค่าจาก URL แก้เองได้ ตรวจก่อนใช้เสมอ
  const direction = DIRECTIONS.find((d) => d === params.d);

  // คำสั้นเกินไปจะได้ผลลัพธ์เกือบทั้งร้าน ซึ่งไม่ช่วยอะไรและเปลืองแรงฐานข้อมูล
  const tooShort = q.length > 0 && q.length < 2;
  const shouldSearch = q.length >= 2;

  const [rows, totals] = shouldSearch
    ? await Promise.all([
        searchTransactions(context.shop.id, { q, direction }),
        searchTotals(context.shop.id, { q, direction }),
      ])
    : [[], null];

  return (
    <div className="space-y-3">
      <SearchBox defaultQuery={q} direction={direction} />

      {tooShort && (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-ink-soft shadow-sm">
          พิมพ์อย่างน้อย 2 ตัวอักษร
        </p>
      )}

      {shouldSearch && totals && (
        <>
          <div className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface px-1 py-3 shadow-sm">
            <Cell label="เจอ" value={`${totals.count}`} unit="รายการ" />
            <Cell label="รับเข้า" value={bahtShort(totals.income)} tone="text-income" />
            <Cell label="จ่ายออก" value={bahtShort(totals.expense)} tone="text-expense" />
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-ink-soft shadow-sm">
              ไม่พบรายการที่ตรงกับ &ldquo;{q}&rdquo;
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm">
              {rows.map((txn) => {
                const income = txn.direction === "in";

                return (
                  <li key={txn.id}>
                    {/* แตะแล้วไปที่วันของรายการนั้น ซึ่งแก้ไขหรือลบต่อได้ */}
                    <Link
                      href={`/day?d=${txn.txnDate}`}
                      className="flex items-center gap-3 px-3 py-3 transition active:bg-surface-2"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-9 w-1 shrink-0 rounded-full",
                          income ? "bg-income" : "bg-expense",
                        )}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{txn.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">
                          {[thaiDate(txn.txnDate), txn.categoryName, txn.accountName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "num shrink-0 font-bold",
                          income ? "text-income" : "text-expense",
                        )}
                      >
                        {income ? "+" : "−"}
                        {bahtShort(txn.amount)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length === 200 && (
            <p className="text-center text-xs text-ink-soft">
              แสดง 200 รายการแรก ลองพิมพ์ให้เจาะจงขึ้น
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  unit,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
}) {
  return (
    <div className="px-2 text-center">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className={cn("num mt-0.5 text-base font-bold", tone)}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-ink-soft">{unit}</span>}
      </div>
    </div>
  );
}
