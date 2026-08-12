import { exportAll, exportTransactionsFlat } from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { thaiTimestamp, today } from "@/lib/date";

// Edge runtime รันบนโฮสต์ที่ใช้ Phusion Passenger ไม่ได้ จึงบังคับ Node ไว้
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ทางออกของข้อมูล
 *
 *   GET /api/export        ทั้งฐานเป็น JSON
 *   GET /api/export?f=csv  เฉพาะรายการเคลื่อนไหว เปิดใน Excel ได้
 *
 * มีตั้งแต่วันแรกโดยตั้งใจ ไม่ได้รอให้ถึงวันที่จะย้ายโฮสต์ก่อนค่อยทำ
 * เพราะข้อมูลบัญชีของร้านต้องเป็นของร้าน ไม่ใช่ของแอป
 */
export async function GET(request: Request) {
  if (!(await hasSession())) {
    return new Response("ต้องล็อกอินก่อน", { status: 401 });
  }

  const format = new URL(request.url).searchParams.get("f");
  const stamp = today();

  if (format === "csv") {
    const rows = await exportTransactionsFlat();

    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const data = await exportAll();

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

const HEADERS = [
  ["txnDate", "วันที่"],
  ["shopName", "ร้าน"],
  ["direction", "ทิศทาง"],
  ["categoryName", "ประเภท"],
  ["counts", "นับเป็นกำไร"],
  ["title", "รายการ"],
  ["amount", "จำนวนเงิน"],
  ["accountName", "บัญชี"],
  ["note", "หมายเหตุ"],
  ["createdAt", "เวลาที่บันทึก"],
] as const;

type FlatRow = Awaited<ReturnType<typeof exportTransactionsFlat>>[number];

function toCsv(rows: FlatRow[]): string {
  const lines = [HEADERS.map(([, label]) => label).join(",")];

  for (const row of rows) {
    lines.push(
      HEADERS.map(([key]) => {
        const value = row[key as keyof FlatRow];

        if (value === null || value === undefined) return "";
        if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
        if (key === "direction") return value === "in" ? "รับเข้า" : "จ่ายออก";

        /**
         * คอลัมน์เวลาต้องแปลงเอง
         *
         * ไดรเวอร์คืน timestamptz มาเป็น Date object ถ้าปล่อยให้ String()
         * จัดการจะได้ "Tue Aug 11 2026 23:46:15 GMT+0700 (เวลาอินโดจีน)"
         * ซึ่ง Excel อ่านเป็นวันที่ไม่ออก และหน้าตายังเปลี่ยนตามภาษาของ
         * เครื่องที่รันเซิร์ฟเวอร์ด้วย
         */
        if (value instanceof Date) return thaiTimestamp(value);

        return escapeCsv(String(value));
      }).join(","),
    );
  }

  /**
   * ขึ้นต้นไฟล์ด้วย BOM ของ UTF-8
   *
   * ถ้าไม่มี Excel บน Windows จะเดาว่าไฟล์เป็นรหัสภาษาท้องถิ่นแล้วภาษาไทย
   * จะกลายเป็นตัวอักษรมั่วทั้งไฟล์ ตัวอักษรสามไบต์นี้คือสิ่งที่บอก Excel
   * ว่าให้อ่านเป็น UTF-8
   */
  return `﻿${lines.join("\r\n")}`;
}

/**
 * ครอบค่าด้วยเครื่องหมายคำพูดเมื่อมีอักขระที่ทำให้คอลัมน์เพี้ยน
 * และแปลง " เดี่ยวเป็น "" ตามข้อกำหนดของ CSV
 */
function escapeCsv(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
