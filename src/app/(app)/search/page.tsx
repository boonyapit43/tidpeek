import type { Metadata } from "next";
import Link from "next/link";
import { searchTotals, searchTransactions } from "@/db/queries";
import { DIRECTIONS } from "@/db/schema";
import { thaiDate } from "@/lib/date";
import { bahtShort } from "@/lib/money";
import { moreHref, rowsToShow } from "@/lib/paging";
import { getShopContext } from "@/lib/shop";
import { cn } from "@/lib/cn";
import { LoadMore } from "@/components/load-more";
import { SearchBox } from "./search-box";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "ค้นหา" };

/**
 * ค้นหารายการย้อนหลัง
 *
 * ตั้งใจไม่ใส่ในเมนูล่าง — ห้าช่องตอนนี้ (บันทึก รายวัน บัญชี สรุป ตั้งค่า)
 * คือขนาดเล็กสุดที่นิ้วโป้งยังกดไม่พลาด เพิ่มอีกช่องเพื่อฟีเจอร์ที่ใช้
 * นานๆ ครั้งไม่คุ้ม เข้าถึงจากปุ่มแว่นขยายที่หน้ารายวันแทน
 *
 * คำค้นอยู่ใน URL จึงกดย้อนกลับได้ และส่งลิงก์ผลค้นหาให้กันได้
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; d?: string; n?: string }>;
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

  const shown = rowsToShow(params.n);

  const [rows, totals] = shouldSearch
    ? await Promise.all([
        searchTransactions(context.shop.id, { q, direction }, shown),
        searchTotals(context.shop.id, { q, direction }),
      ])
    : [[], null];

  return (
    <div className="space-y-3">
      {/**
        * key ผูกกับค่าใน URL — กดปุ่มย้อนกลับแล้วกล่องค้นหาถูกสร้างใหม่
        * ให้ตรงกับผลลัพธ์ที่แสดง ไม่งั้นช่องพิมพ์จะค้างคำที่พิมพ์ทิ้งไว้
        * ขณะที่ผลลัพธ์ข้างล่างเป็นของคำค้นเก่าจาก URL คนละเรื่องกัน
        */}
      <SearchBox key={`${q}|${direction ?? ""}`} defaultQuery={q} direction={direction} />

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
                      // ส่ง t ไปด้วย หน้ารายวันจะเปิดแผ่นแก้ไขของรายการนี้ให้เลย
                      // คนค้นหาเพราะหาไม่เจอ ถ้าพาไปถึงวันแล้วให้ไล่หาใหม่ก็เท่ากับไม่ได้พา
                      href={`/day?d=${txn.txnDate}&t=${txn.id}`}
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

          {/**
            * n ไม่ถูกส่งต่อไปที่ลิงก์ตัวกรอง (ทั้งหมด/รับเข้า/จ่ายออก) โดยตั้งใจ
            * เปลี่ยนตัวกรองคือการเริ่มค้นใหม่ ควรกลับไปเริ่มที่ชุดแรกเสมอ
            */}
          <LoadMore
            shown={rows.length}
            total={totals.count}
            href={moreHref(
              new URLSearchParams(
                Object.entries({ q, d: direction }).filter(([, v]) => Boolean(v)) as [
                  string,
                  string,
                ][],
              ),
              rows.length,
            )}
          />
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
