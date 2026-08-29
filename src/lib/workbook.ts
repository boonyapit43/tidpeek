import "server-only";
import ExcelJS from "exceljs";
import type {
  AccountPeriodRow,
  CategoryTotal,
  Summary,
  exportTransactionsFlat,
  exportTransfersFlat,
} from "@/db/queries";
import { TIME_ZONE } from "./date";
import { toNumber } from "./money";

/**
 * ประกอบไฟล์ Excel ที่ส่งให้คนทำบัญชีได้เลย
 *
 * ทำไมต้องเป็น .xlsx จริง ไม่ใช่ CSV
 *
 *   • วันที่เป็นชนิดวันที่จริง เรียงและกรองในโปรแกรมได้ ไม่ใช่ข้อความ
 *   • จำนวนเงินเป็นตัวเลขจริง ลาก SUM ได้ทันที ไม่ต้องแปลงก่อน
 *   • มีหลายชีต — สรุป รายการ การโอน ยอดบัญชี ซึ่ง CSV แผ่นเดียวทำไม่ได้
 *   • มีตัวกรองบนหัวตาราง กดกรองเฉพาะ "ค่าแรง" ได้โดยไม่ต้องทำอะไรเพิ่ม
 *
 * ⚠️ เงินถูกแปลงเป็น number ตรงนี้ ซึ่งเป็นข้อยกเว้นเดียวของกฎ "เงินเป็น
 *    string ตลอดทาง" — จำเป็น เพราะถ้าเขียนเป็นข้อความลงเซลล์ Excel จะบวก
 *    ไม่ได้ ซึ่งทำให้ไฟล์ที่ส่งออกไปไร้ประโยชน์
 *
 *    ปลอดภัยเพราะเป็นปลายทางสุดท้าย ไม่มีการบวกต่อในโค้ดนี้อีกเลย
 *    ยอดรวมทุกตัวคิดมาจาก SQL แล้ว ส่วนแถวรวมในไฟล์เป็นสูตรของ Excel เอง
 */

type TxnRows = Awaited<ReturnType<typeof exportTransactionsFlat>>;
type TransferRows = Awaited<ReturnType<typeof exportTransfersFlat>>;

const MONEY = "#,##0.00";
const DATE = "dd/mm/yyyy";

/** สีเดียวกับในแอป เพื่อให้ไฟล์ที่ได้ดูเป็นของชุดเดียวกัน */
const BRAND = "FF4F46E5";
const INK_SOFT = "FF6B7280";
const EXPENSE = "FFDC2626";

export type WorkbookInput = {
  shopName: string;
  periodLabel: string;
  generatedAt: string;
  summary: Summary;
  categories: CategoryTotal[];
  transactions: TxnRows;
  transfers: TransferRows;
  accounts: AccountPeriodRow[];
};

export async function buildWorkbook(input: WorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "tidpeek";
  wb.created = new Date();

  buildSummarySheet(wb, input);
  buildTransactionsSheet(wb, input);
  buildTransfersSheet(wb, input);
  buildAccountsSheet(wb, input);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ------------------------------------------------------------------ */
/*  ชีต 1 — สรุป                                                       */
/* ------------------------------------------------------------------ */

/**
 * ชีตแรกที่เปิดมาเจอ ตอบคำถามได้โดยไม่ต้องทำอะไรต่อ
 *
 * เรียงจากตัวเลขที่ถูกถามบ่อยสุดลงไปหาที่ละเอียดกว่า — กำไรก่อน
 * แล้วค่อยแจกแจงว่าเงินมาจากไหนและไปไหน
 */
function buildSummarySheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet("สรุป", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 30 }, { width: 16 }, { width: 10 }];

  ws.addRow([input.shopName]).font = { size: 16, bold: true };
  ws.addRow([input.periodLabel]).font = { size: 11, color: { argb: INK_SOFT } };
  ws.addRow([`ออกไฟล์เมื่อ ${input.generatedAt}`]).font = {
    size: 9,
    color: { argb: INK_SOFT },
  };
  ws.addRow([]);

  const money = (label: string, value: string) => {
    const row = ws.addRow([label, toNumber(value)]);
    row.getCell(2).numFmt = MONEY;
    return row;
  };

  money("รายรับ", input.summary.income);
  money("รายจ่าย", input.summary.expense).getCell(2).font = { color: { argb: EXPENSE } };

  const profit = money("กำไร", input.summary.profit);
  profit.font = { bold: true };

  const percent = percentOf(input.summary.profit, input.summary.income);
  if (percent !== null) {
    profit.getCell(3).value = percent / 100;
    profit.getCell(3).numFmt = "0.0%";
  }
  // ขาดทุนใช้สีแดง คู่กับเครื่องหมายลบที่ตัวเลขเอง ไม่ได้พึ่งสีอย่างเดียว
  if (toNumber(input.summary.profit) < 0) {
    profit.getCell(2).font = { bold: true, color: { argb: EXPENSE } };
  }

  if (toNumber(input.summary.excluded) > 0) {
    ws.addRow([]);
    money("เงินที่ไม่นับเป็นกำไร", input.summary.excluded).font = {
      color: { argb: INK_SOFT },
    };
    ws.addRow([
      "(เช่น เติมทุน ถอนใช้ส่วนตัว — เงินเดินจริงแต่ไม่ใช่ผลประกอบการ)",
    ]).font = { size: 9, color: { argb: INK_SOFT } };
  }

  breakdown(ws, "รับมาจากไหน", input.categories.filter((c) => c.direction === "in"));
  breakdown(ws, "จ่ายไปกับอะไร", input.categories.filter((c) => c.direction === "out"));
}

function breakdown(ws: ExcelJS.Worksheet, heading: string, rows: CategoryTotal[]) {
  if (rows.length === 0) return;

  ws.addRow([]);
  ws.addRow([heading]).font = { bold: true, color: { argb: BRAND } };

  const total = rows.reduce((sum, r) => sum + toNumber(r.total), 0);

  for (const row of rows) {
    const line = ws.addRow([
      row.counts ? row.name : `${row.name} (ไม่นับเป็นกำไร)`,
      toNumber(row.total),
    ]);
    line.getCell(2).numFmt = MONEY;

    if (total > 0) {
      line.getCell(3).value = toNumber(row.total) / total;
      line.getCell(3).numFmt = "0.0%";
    }
  }
}

/* ------------------------------------------------------------------ */
/*  ชีต 2 — รายการ                                                     */
/* ------------------------------------------------------------------ */

function buildTransactionsSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet("รายการ");

  ws.columns = [
    { header: "วันที่", key: "date", width: 12 },
    { header: "ทิศทาง", key: "direction", width: 10 },
    { header: "ประเภท", key: "category", width: 22 },
    { header: "รายการ", key: "title", width: 30 },
    { header: "จำนวนเงิน", key: "amount", width: 14 },
    { header: "บัญชี", key: "account", width: 16 },
    { header: "หมายเหตุ", key: "note", width: 30 },
    { header: "นับเป็นกำไร", key: "counts", width: 12 },
    { header: "เวลาที่บันทึก", key: "createdAt", width: 18 },
  ];

  headerStyle(ws);

  for (const t of input.transactions) {
    const row = ws.addRow({
      // ส่งเป็น Date จริง ไม่ใช่ข้อความ Excel จะได้เรียงและกรองตามวันได้
      date: asDate(t.txnDate),
      direction: t.direction === "in" ? "รับเข้า" : "จ่ายออก",
      category: t.categoryName ?? "ไม่ระบุประเภท",
      title: t.title,
      amount: toNumber(t.amount),
      account: t.accountName ?? "ไม่ระบุบัญชี",
      note: t.note ?? "",
      counts: t.counts ? "ใช่" : "ไม่",
      createdAt: asDateTime(t.createdAt),
    });

    row.getCell("date").numFmt = DATE;
    row.getCell("amount").numFmt = MONEY;
    row.getCell("createdAt").numFmt = "dd/mm/yyyy hh:mm";

    if (t.direction === "out") row.getCell("amount").font = { color: { argb: EXPENSE } };
  }

  totalRow(ws, input.transactions.length, 5, "รวม");
  autoFilter(ws, 9);
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/* ------------------------------------------------------------------ */
/*  ชีต 3 — การโอน                                                     */
/* ------------------------------------------------------------------ */

/**
 * แยกชีตจากรายการ เพราะคอลัมน์คนละชุดกันคนละเรื่อง
 *
 * รายการมีทิศทางกับประเภท ส่วนการโอนมีบัญชีต้นทางกับปลายทาง
 * ถ้ายัดรวมชีตเดียวจะได้ตารางที่ครึ่งหนึ่งเป็นช่องว่างในทุกแถว
 */
function buildTransfersSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet("โอนระหว่างบัญชี");

  ws.columns = [
    { header: "วันที่", key: "date", width: 12 },
    { header: "จากบัญชี", key: "from", width: 18 },
    { header: "ไปบัญชี", key: "to", width: 18 },
    { header: "จำนวนเงิน", key: "amount", width: 14 },
    { header: "หมายเหตุ", key: "note", width: 34 },
  ];

  headerStyle(ws);

  for (const t of input.transfers) {
    const row = ws.addRow({
      date: asDate(t.txnDate),
      from: t.fromName,
      to: t.toName,
      amount: toNumber(t.amount),
      note: t.note ?? "",
    });
    row.getCell("date").numFmt = DATE;
    row.getCell("amount").numFmt = MONEY;
  }

  if (input.transfers.length === 0) {
    ws.addRow(["ช่วงนี้ไม่มีการโอนระหว่างบัญชี"]).font = {
      italic: true,
      color: { argb: INK_SOFT },
    };
  } else {
    totalRow(ws, input.transfers.length, 4, "รวม");
  }

  autoFilter(ws, 5);
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/* ------------------------------------------------------------------ */
/*  ชีต 4 — ยอดบัญชี                                                   */
/* ------------------------------------------------------------------ */

function buildAccountsSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = wb.addWorksheet("ยอดบัญชี");

  ws.columns = [
    { header: "บัญชี", key: "name", width: 20 },
    { header: "ยอดตั้งต้น", key: "opening", width: 14 },
    { header: "รับเข้าในช่วง", key: "income", width: 15 },
    { header: "จ่ายออกในช่วง", key: "expense", width: 15 },
    { header: "โอนสุทธิในช่วง", key: "transfer", width: 16 },
    { header: "คงเหลือสิ้นช่วง", key: "closing", width: 16 },
  ];

  headerStyle(ws);

  for (const a of input.accounts) {
    const row = ws.addRow({
      // บัญชีที่ปิดใช้งานไม่โผล่ในแอปแล้ว แต่ยังอยู่ในไฟล์เพราะประวัติเงิน
      // ของมันจริง ติดป้ายไว้ให้คนอ่านรู้ว่าทำไมหาในแอปไม่เจอ
      name: a.active ? a.name : `${a.name} (ปิดใช้งาน)`,
      opening: toNumber(a.opening),
      income: toNumber(a.income),
      expense: toNumber(a.expense),
      transfer: toNumber(a.transferNet),
      closing: toNumber(a.closing),
    });

    for (const key of ["opening", "income", "expense", "transfer", "closing"]) {
      row.getCell(key).numFmt = MONEY;
    }
    row.getCell("expense").font = { color: { argb: EXPENSE } };
    row.getCell("closing").font = { bold: true };
  }

  ws.addRow([]);
  ws.addRow(["คงเหลือสิ้นช่วง คือยอด ณ วันสุดท้ายของช่วง ไม่ใช่ยอดวันนี้"]).font = {
    size: 9,
    color: { argb: INK_SOFT },
  };
  ws.addRow([
    "ยอดตั้งต้นบวกความเคลื่อนไหวในช่วง อาจไม่เท่าคงเหลือ ถ้ามีรายการก่อนหน้าช่วงนี้",
  ]).font = { size: 9, color: { argb: INK_SOFT } };

  // ชีตรายการมีเฉพาะของร้านที่ส่งออก แต่บัญชีร่วมนับเงินของทุกร้าน
  // ไม่บอกไว้ คนกระทบยอดสองชีตจะเจอเงินส่วนต่างที่อธิบายไม่ได้
  if (input.accounts.some((a) => a.shared)) {
    ws.addRow([
      "บัญชีที่ใช้ร่วมกันทุกร้าน นับเงินเข้าออกของทุกร้าน ตัวเลขจึงอาจต่างจากชีตรายการซึ่งมีเฉพาะร้านนี้",
    ]).font = { size: 9, color: { argb: INK_SOFT } };
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/* ------------------------------------------------------------------ */
/*  ชิ้นส่วนที่ใช้ซ้ำ                                                   */
/* ------------------------------------------------------------------ */

function headerStyle(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
}

/**
 * แถวรวมท้ายตาราง ใช้สูตรของ Excel ไม่ได้เขียนตัวเลขตายลงไป
 *
 * เพราะถ้าคนรับไฟล์ไปกรองหรือซ่อนแถว ตัวเลขรวมต้องขยับตามสิ่งที่เห็น
 * SUBTOTAL(109,…) นับเฉพาะแถวที่ยังโชว์อยู่ ต่างจาก SUM ที่นับหมดเสมอ
 * ถ้าเขียนค่าตายไว้ มันจะค้างเป็นยอดเดิมแล้วอ่านผิดโดยไม่รู้ตัว
 */
function totalRow(ws: ExcelJS.Worksheet, dataRows: number, column: number, label: string) {
  if (dataRows === 0) return;

  const letter = ws.getColumn(column).letter;
  const row = ws.addRow([]);

  row.getCell(column - 1).value = label;
  row.getCell(column).value = {
    formula: `SUBTOTAL(109,${letter}2:${letter}${dataRows + 1})`,
  };
  row.getCell(column).numFmt = MONEY;
  row.font = { bold: true };
  row.getCell(column).border = { top: { style: "thin" } };
}

function autoFilter(ws: ExcelJS.Worksheet, lastColumn: number) {
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: lastColumn } };
}

/**
 * "2026-08-28" → Date ที่ตรงวันเสมอ ไม่ว่าเซิร์ฟเวอร์จะตั้งเขตเวลาไว้เป็นอะไร
 *
 * exceljs แปลงเป็นเลขวันของ Excel ด้วย getTime() ตรงๆ ไม่บวกลบเขตเวลาให้
 * (ดู utils.dateToExcel) จึงต้องส่ง Date ที่เที่ยงคืน UTC พอดี
 * ถ้าใช้ new Date("2026-08-28") ก็ได้ผลเดียวกัน แต่แยกส่วนเองแล้วชัดกว่า
 * ว่าตั้งใจให้เป็น UTC ไม่ได้บังเอิญถูก
 */
function asDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const bangkokParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  // h23 ไม่ใช่ hour12: false เพราะบางเครื่องคืนเที่ยงคืนมาเป็น "24"
  // ซึ่งพอส่งเข้า Date.UTC จะกลายเป็นวันถัดไปเงียบๆ
  hourCycle: "h23",
});

/**
 * เวลาที่บันทึกจริง → Date ที่ "หน้าปัด" เป็นเวลาไทย
 *
 * ในฐานข้อมูลเก็บเป็นเวลา UTC และ Vercel ก็รันเป็น UTC ถ้าส่งเข้า Excel
 * ดิบๆ ช่องเวลาจะโชว์ 13:30 ทั้งที่คนกดบันทึกตอนสามทุ่มครึ่ง ซึ่งอ่านแล้ว
 * งงกว่าไม่มีคอลัมน์นี้เลย
 *
 * เขียนเป็นชนิดวันที่จริง ไม่ใช่ข้อความ จะได้ยังเรียงตามเวลาได้ใน Excel
 */
function asDateTime(value: Date | string | null | undefined): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const part: Record<string, string> = {};
  for (const p of bangkokParts.formatToParts(date)) part[p.type] = p.value;

  return new Date(
    Date.UTC(
      Number(part.year),
      Number(part.month) - 1,
      Number(part.day),
      Number(part.hour),
      Number(part.minute),
      Number(part.second),
    ),
  );
}

function percentOf(profit: string, income: string): number | null {
  const base = toNumber(income);
  if (base <= 0) return null;
  return (toNumber(profit) / base) * 100;
}
