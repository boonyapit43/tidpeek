import {
  accountTotalsForPeriod,
  exportAll,
  exportTransactionsFlat,
  exportTransfersFlat,
  getSummary,
  listCategoryTotals,
} from "@/db/queries";
import { hasSession } from "@/lib/auth";
import { getSelectedShop } from "@/lib/shop";
import { thaiTimestamp, today } from "@/lib/date";
import { resolvePeriod } from "@/lib/export-period";
import { buildWorkbook } from "@/lib/workbook";

// Edge runtime รันบนโฮสต์ที่ใช้ Phusion Passenger ไม่ได้ จึงบังคับ Node ไว้
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ทางออกของข้อมูล
 *
 *   GET /api/export?p=month&m=2026-08     ไฟล์ Excel ของเดือนนั้น
 *   GET /api/export?p=week&w=2026-08-31   ของสัปดาห์นั้น
 *   GET /api/export?p=day&d=2026-08-28    ของวันนั้น
 *   GET /api/export?p=year&y=2026         ของทั้งปี
 *   GET /api/export?from=...&to=...       ช่วงที่กำหนดเอง
 *   GET /api/export?f=json                ทั้งฐานข้อมูล ไว้สำรอง
 *
 * ⚠️ ทุกแบบยกเว้น json ผูกกับ "ร้านที่เลือกอยู่" เสมอ
 *    ของเดิมส่งออกทุกร้านรวมกัน ทำให้ไฟล์ที่ส่งให้คนทำบัญชีของร้านหนึ่ง
 *    มีรายการของอีกร้านปนอยู่ ซึ่งคนรับไฟล์ไม่มีทางรู้เลยว่าปน
 *
 * ส่วน json ยังเป็นทั้งฐานโดยตั้งใจ เพราะหน้าที่ของมันคือสำรองข้อมูล
 * ไม่ใช่ส่งให้ใครอ่าน
 */
export async function GET(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    /**
     * route handler ไม่ผ่าน error.tsx ของแอป ถ้าปล่อยโยนทะลุ คนจะเจอหน้า
     * Internal Server Error ภาษาอังกฤษของ Vercel — เคสที่เจอจริงที่สุดคือ
     * ฐานข้อมูลถูกพักแล้วกดส่งออก ซึ่งควรได้คำอธิบายที่อ่านแล้วรู้ว่าทำอะไรต่อ
     */
    console.error("[export]", error);

    return new Response(
      "สร้างไฟล์ไม่สำเร็จ — ต่อฐานข้อมูลไม่ได้ ลองใหม่อีกครั้ง " +
        "ถ้ายังไม่หายให้เช็คว่าฐานข้อมูลไม่ได้ถูกพักอยู่",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
}

async function handle(request: Request) {
  if (!(await hasSession())) {
    return new Response("ต้องล็อกอินก่อน", { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  if (params.get("f") === "json") {
    const data = await exportAll();

    return download(
      JSON.stringify(data, null, 2),
      `tidpeek-ทั้งหมด-${today()}.json`,
      "application/json; charset=utf-8",
    );
  }

  const shop = await getSelectedShop();
  if (!shop) {
    return new Response("ยังไม่ได้เลือกร้าน", { status: 400 });
  }

  const chosen = resolvePeriod(params);

  const [summary, categories, transactions, transfers, accounts] = await Promise.all([
    getSummary(shop.id, chosen.period),
    listCategoryTotals(shop.id, chosen.period),
    exportTransactionsFlat(shop.id, chosen.period),
    exportTransfersFlat(shop.id, chosen.period),
    accountTotalsForPeriod(shop.id, chosen.period),
  ]);

  const file = await buildWorkbook({
    shopName: shop.name,
    periodLabel: chosen.label,
    generatedAt: thaiTimestamp(new Date()),
    summary,
    categories,
    transactions,
    transfers,
    accounts,
  });

  return download(
    file,
    `tidpeek-${shop.name}-${chosen.slug}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

/**
 * ส่งไฟล์กลับไปให้เบราว์เซอร์ดาวน์โหลด
 *
 * ชื่อไฟล์เป็นภาษาไทย จึงต้องส่งสองแบบใน Content-Disposition
 *   filename=   ชื่อสำรองแบบ ASCII ล้วน สำหรับเบราว์เซอร์เก่า
 *   filename*=  ชื่อจริงเข้ารหัส UTF-8 ตาม RFC 5987
 * ถ้าส่งแค่ชื่อไทยดิบๆ บางเบราว์เซอร์จะได้ไฟล์ชื่อเพี้ยนหรือดาวน์โหลดไม่ลง
 */
function download(body: string | Buffer, filename: string, contentType: string): Response {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      // บอกขนาดไว้ เบราว์เซอร์จะโชว์เปอร์เซ็นต์ดาวน์โหลดและรู้ทันทีถ้าไฟล์ขาด
      "Content-Length": String(Buffer.byteLength(body as string | Buffer)),
      "Content-Disposition":
        `attachment; filename="${ascii}"; ` +
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
