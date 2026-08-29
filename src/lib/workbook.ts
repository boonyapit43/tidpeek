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

/* ------------------------------------------------------------------ */
/*  ชุดรูปแบบของทั้งเล่ม                                                */
/* ------------------------------------------------------------------ */

/**
 * ประกาศไว้ที่เดียวแล้วใช้ซ้ำทุกชีต ไฟล์ที่ได้จึงดูเป็นเล่มเดียวกัน
 * ไม่ใช่สี่แผ่นที่คนละคนทำ
 *
 * สีตรงกับที่ใช้บนหน้าจอ เพื่อให้คนที่ดูแอปแล้วเปิดไฟล์ต่อรู้สึกว่าเป็น
 * ของชุดเดียวกัน ต้องเขียนซ้ำเพราะ Excel รับแต่ ARGB แปลงจาก oklch ไม่ได้
 */
const INK = "FF32364B";
const INK_SOFT = "FF6B7180";
const BRAND = "FF485ACE";
const BRAND_SOFT = "FFEEF0FC";
const INCOME = "FF00814A";
const EXPENSE = "FFD42F34";
const LINE = "FFDCDFEE";
/** พื้นสลับแถว อ่อนมากพอที่ปรินต์ขาวดำแล้วไม่กลายเป็นเทาทึบ */
const ZEBRA = "FFF8F9FD";

const MONEY = "#,##0.00";
const DATE = "dd/mm/yyyy";
const STAMP = "dd/mm/yyyy hh:mm";
const PERCENT = "0.0%";

const FONT = "Tahoma";

/** เส้นบางรอบเซลล์ ใช้กับทุกตาราง */
const boxed: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: LINE } },
  left: { style: "thin", color: { argb: LINE } },
  bottom: { style: "thin", color: { argb: LINE } },
  right: { style: "thin", color: { argb: LINE } },
};

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
  const ws = wb.addWorksheet("สรุป", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", margins: PRINT_MARGINS },
  });

  ws.columns = [{ width: 34 }, { width: 18 }, { width: 12 }];

  const title = ws.addRow([input.shopName]);
  title.font = { name: FONT, size: 18, bold: true, color: { argb: INK } };
  title.height = 26;

  ws.addRow([input.periodLabel]).font = { name: FONT, size: 11, color: { argb: INK_SOFT } };
  ws.addRow([`ออกไฟล์เมื่อ ${input.generatedAt}`]).font = {
    name: FONT,
    size: 9,
    color: { argb: INK_SOFT },
  };

  /* ---- ภาพรวม ---- */
  sectionTitle(ws, "ภาพรวม");

  const income = amountRow(ws, "รายรับ", input.summary.income, INCOME);
  amountRow(ws, "รายจ่าย", input.summary.expense, EXPENSE);

  const loss = toNumber(input.summary.profit) < 0;
  const profit = amountRow(
    ws,
    loss ? "ขาดทุน" : "กำไร",
    input.summary.profit,
    loss ? EXPENSE : INCOME,
  );

  // กำไรเป็นบรรทัดที่คนมองหาก่อน จึงหนากว่าและมีพื้นอ่อนคั่นให้เห็นชัด
  for (const cell of [profit.getCell(1), profit.getCell(2), profit.getCell(3)]) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
    cell.font = { ...(cell.font ?? {}), bold: true };
  }

  const percent = percentOf(input.summary.profit, input.summary.income);
  if (percent !== null) {
    const cell = profit.getCell(3);
    cell.value = percent;
    cell.numFmt = PERCENT;
    cell.alignment = { horizontal: "right" };
  }

  boxRange(ws, income.number, profit.number, 3);

  if (toNumber(input.summary.excluded) > 0) {
    ws.addRow([]);
    const note = ws.addRow([
      "เงินที่ไม่นับเป็นกำไร",
      toNumber(input.summary.excluded),
    ]);
    note.font = { name: FONT, size: 10, color: { argb: INK_SOFT } };
    note.getCell(2).numFmt = MONEY;
    ws.addRow([
      "เช่น เติมทุน หรือถอนใช้ส่วนตัว — เงินเดินจริงแต่ไม่ใช่ผลประกอบการ",
    ]).font = { name: FONT, size: 9, italic: true, color: { argb: INK_SOFT } };
  }

  breakdown(ws, "รับมาจากไหน", input.categories.filter((c) => c.direction === "in"), INCOME);
  breakdown(ws, "จ่ายไปกับอะไร", input.categories.filter((c) => c.direction === "out"), EXPENSE);
}

/** หัวข้อคั่นในชีตสรุป — แถบสีแบรนด์เต็มความกว้างสามคอลัมน์ */
function sectionTitle(ws: ExcelJS.Worksheet, text: string) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  row.height = 20;

  for (let c = 1; c <= 3; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  }
}

function amountRow(ws: ExcelJS.Worksheet, label: string, value: string, color: string) {
  const row = ws.addRow([label, toNumber(value)]);
  row.height = 19;
  row.getCell(1).font = { name: FONT, size: 11, color: { argb: INK } };

  const amount = row.getCell(2);
  amount.numFmt = MONEY;
  amount.font = { name: FONT, size: 11, bold: true, color: { argb: color } };
  amount.alignment = { horizontal: "right" };

  return row;
}

function breakdown(
  ws: ExcelJS.Worksheet,
  heading: string,
  rows: CategoryTotal[],
  color: string,
) {
  if (rows.length === 0) return;

  sectionTitle(ws, heading);

  const total = rows.reduce((sum, r) => sum + toNumber(r.total), 0);
  const first = ws.rowCount + 1;

  rows.forEach((row, i) => {
    const line = ws.addRow([
      // ประเภทที่ไม่นับเป็นกำไรกำกับไว้ในชื่อเลย ไม่ต้องมีคอลัมน์แยก
      row.counts ? row.name : `${row.name} (ไม่นับเป็นกำไร)`,
      toNumber(row.total),
    ]);
    line.height = 18;
    line.getCell(1).font = { name: FONT, size: 10, color: { argb: INK } };

    const amount = line.getCell(2);
    amount.numFmt = MONEY;
    amount.font = { name: FONT, size: 10, color: { argb: color } };
    amount.alignment = { horizontal: "right" };

    if (total > 0) {
      const share = line.getCell(3);
      share.value = toNumber(row.total) / total;
      share.numFmt = PERCENT;
      share.font = { name: FONT, size: 10, color: { argb: INK_SOFT } };
      share.alignment = { horizontal: "right" };
    }

    if (i % 2 === 1) zebra(line, 3);
  });

  boxRange(ws, first, ws.rowCount, 3);
}

/* ------------------------------------------------------------------ */
/*  ชีต 2 — รายการ                                                     */
/* ------------------------------------------------------------------ */

function buildTransactionsSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = sheetWithTable(wb, "รายการ", [
    { header: "วันที่", key: "date", width: 12 },
    { header: "ทิศทาง", key: "direction", width: 10 },
    { header: "ประเภท", key: "category", width: 26 },
    { header: "รายการ", key: "title", width: 30 },
    { header: "จำนวนเงิน", key: "amount", width: 15 },
    { header: "บัญชี", key: "account", width: 18 },
    { header: "หมายเหตุ", key: "note", width: 34 },
    { header: "เวลาที่บันทึก", key: "createdAt", width: 18 },
  ]);

  input.transactions.forEach((t, i) => {
    const row = ws.addRow({
      // ส่งเป็น Date จริง ไม่ใช่ข้อความ Excel จะได้เรียงและกรองตามวันได้
      date: asDate(t.txnDate),
      direction: t.direction === "in" ? "รับเข้า" : "จ่ายออก",
      /**
       * ประเภทที่ไม่นับเป็นกำไรกำกับไว้ในชื่อ แทนที่จะมีคอลัมน์ "นับเป็นกำไร"
       * แยกเป็นช่อง ใช่/ไม่ ต่างหาก
       *
       * ที่ต้องมีอะไรสักอย่างบอกไว้ เพราะกำไรในชีตสรุปไม่ได้เท่ากับผลบวก
       * ของทุกแถวในชีตนี้ — เงินอย่างเติมทุนหรือถอนใช้ส่วนตัวเดินจริงแต่
       * ไม่ใช่ผลประกอบการ ถ้าไม่บอกไว้ คนกระทบยอดจะเจอส่วนต่างที่หาไม่เจอ
       * ว่ามาจากไหน แต่ยัดไว้ในชื่อประเภทอ่านง่ายกว่าและประหยัดไปหนึ่งคอลัมน์
       */
      category: t.categoryName
        ? t.counts
          ? t.categoryName
          : `${t.categoryName} (ไม่นับเป็นกำไร)`
        : "ไม่ระบุประเภท",
      title: t.title,
      amount: toNumber(t.amount),
      account: t.accountName ?? "ไม่ระบุบัญชี",
      note: t.note ?? "",
      createdAt: asDateTime(t.createdAt),
    });

    styleDataRow(row, 8, i);

    row.getCell("date").numFmt = DATE;
    row.getCell("createdAt").numFmt = STAMP;

    const amount = row.getCell("amount");
    amount.numFmt = MONEY;
    amount.font = {
      name: FONT,
      size: 10,
      color: { argb: t.direction === "in" ? INCOME : EXPENSE },
    };
  });

  finishTable(ws, input.transactions.length, 8, { totalColumn: 5, emptyText: "ช่วงนี้ไม่มีรายการ" });
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
  const ws = sheetWithTable(wb, "โอนระหว่างบัญชี", [
    { header: "วันที่", key: "date", width: 12 },
    { header: "จากบัญชี", key: "from", width: 20 },
    { header: "ไปบัญชี", key: "to", width: 20 },
    { header: "จำนวนเงิน", key: "amount", width: 15 },
    { header: "หมายเหตุ", key: "note", width: 38 },
  ]);

  input.transfers.forEach((t, i) => {
    const row = ws.addRow({
      date: asDate(t.txnDate),
      from: t.fromName,
      to: t.toName,
      amount: toNumber(t.amount),
      note: t.note ?? "",
    });

    styleDataRow(row, 5, i);
    row.getCell("date").numFmt = DATE;
    row.getCell("amount").numFmt = MONEY;
  });

  finishTable(ws, input.transfers.length, 5, {
    totalColumn: 4,
    emptyText: "ช่วงนี้ไม่มีการโอนระหว่างบัญชี",
  });
}

/* ------------------------------------------------------------------ */
/*  ชีต 4 — ยอดบัญชี                                                   */
/* ------------------------------------------------------------------ */

function buildAccountsSheet(wb: ExcelJS.Workbook, input: WorkbookInput) {
  const ws = sheetWithTable(wb, "ยอดบัญชี", [
    { header: "บัญชี", key: "name", width: 24 },
    { header: "ยอดตั้งต้น", key: "opening", width: 15 },
    { header: "รับเข้าในช่วง", key: "income", width: 16 },
    { header: "จ่ายออกในช่วง", key: "expense", width: 16 },
    { header: "โอนสุทธิในช่วง", key: "transfer", width: 16 },
    { header: "คงเหลือสิ้นช่วง", key: "closing", width: 17 },
  ]);

  input.accounts.forEach((a, i) => {
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

    styleDataRow(row, 6, i);

    for (const key of ["opening", "income", "expense", "transfer", "closing"]) {
      row.getCell(key).numFmt = MONEY;
    }
    row.getCell("income").font = { name: FONT, size: 10, color: { argb: INCOME } };
    row.getCell("expense").font = { name: FONT, size: 10, color: { argb: EXPENSE } };
    row.getCell("closing").font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
  });

  finishTable(ws, input.accounts.length, 6, { emptyText: "ร้านนี้ยังไม่มีบัญชี" });

  ws.addRow([]);
  footnote(ws, "คงเหลือสิ้นช่วง คือยอด ณ วันสุดท้ายของช่วง ไม่ใช่ยอดวันนี้");
  footnote(
    ws,
    "ยอดตั้งต้นบวกความเคลื่อนไหวในช่วง อาจไม่เท่าคงเหลือ ถ้ามีรายการก่อนหน้าช่วงนี้",
  );

  // ชีตรายการมีเฉพาะของร้านที่ส่งออก แต่บัญชีร่วมนับเงินของทุกร้าน
  // ไม่บอกไว้ คนกระทบยอดสองชีตจะเจอเงินส่วนต่างที่อธิบายไม่ได้
  if (input.accounts.some((a) => a.shared)) {
    footnote(
      ws,
      "บัญชีที่ใช้ร่วมกันทุกร้าน นับเงินเข้าออกของทุกร้าน ตัวเลขจึงอาจต่างจากชีตรายการซึ่งมีเฉพาะร้านนี้",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  ชิ้นส่วนที่ใช้ซ้ำ                                                   */
/* ------------------------------------------------------------------ */

const PRINT_MARGINS = {
  left: 0.4,
  right: 0.4,
  top: 0.5,
  bottom: 0.5,
  header: 0.2,
  footer: 0.2,
};

/**
 * ชีตที่เป็นตาราง — หัวสีแบรนด์ ตรึงหัวไว้ ตั้งค่าหน้ากระดาษให้พร้อมปรินต์
 *
 * ตั้งค่าปรินต์ไว้ด้วยเพราะไฟล์นี้ถูกส่งต่อให้คนทำบัญชี ซึ่งมักปรินต์ออกมา
 * แนบเอกสาร ถ้าไม่ตั้ง หัวตารางจะโผล่แค่หน้าแรกแล้วหน้าที่สองเป็นตัวเลข
 * ลอยๆ ที่ไม่รู้ว่าคอลัมน์ไหนคืออะไร
 */
function sheetWithTable(
  wb: ExcelJS.Workbook,
  name: string,
  columns: Partial<ExcelJS.Column>[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:1",
      margins: PRINT_MARGINS,
    },
  });

  ws.columns = columns;

  const header = ws.getRow(1);
  header.height = 24;
  header.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  header.alignment = { vertical: "middle" };

  for (let c = 1; c <= columns.length; c++) header.getCell(c).border = boxed;

  return ws;
}

/** เส้นรอบเซลล์ ตัวอักษร และพื้นสลับแถว — ใช้กับทุกแถวข้อมูลของทุกตาราง */
function styleDataRow(row: ExcelJS.Row, columns: number, index: number) {
  row.height = 18;

  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.border = boxed;
    cell.font = cell.font ?? { name: FONT, size: 10, color: { argb: INK } };
    cell.alignment = { vertical: "middle" };
  }

  if (index % 2 === 1) zebra(row, columns);
}

/**
 * ปิดท้ายตาราง — แถวรวม ตัวกรอง และข้อความตอนไม่มีข้อมูล
 *
 * ตารางว่างเปล่าทำให้คนสงสัยว่าไฟล์พังหรือข้อมูลหาย จึงต้องมีบรรทัดบอก
 * เสมอว่าช่วงนี้ไม่มีอะไรจริงๆ
 */
function finishTable(
  ws: ExcelJS.Worksheet,
  dataRows: number,
  columns: number,
  options: { totalColumn?: number; emptyText: string },
) {
  if (dataRows === 0) {
    const row = ws.addRow([options.emptyText]);
    row.font = { name: FONT, size: 10, italic: true, color: { argb: INK_SOFT } };
  } else if (options.totalColumn) {
    totalRow(ws, dataRows, columns, options.totalColumn);
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns } };
}

/**
 * แถวรวมท้ายตาราง ใช้สูตรของ Excel ไม่ได้เขียนตัวเลขตายลงไป
 *
 * เพราะถ้าคนรับไฟล์ไปกรองหรือซ่อนแถว ตัวเลขรวมต้องขยับตามสิ่งที่เห็น
 * SUBTOTAL(109,…) นับเฉพาะแถวที่ยังโชว์อยู่ ต่างจาก SUM ที่นับหมดเสมอ
 * ถ้าเขียนค่าตายไว้ มันจะค้างเป็นยอดเดิมแล้วอ่านผิดโดยไม่รู้ตัว
 */
function totalRow(
  ws: ExcelJS.Worksheet,
  dataRows: number,
  columns: number,
  column: number,
) {
  const letter = ws.getColumn(column).letter;
  const row = ws.addRow([]);
  row.height = 20;

  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
    cell.border = {
      ...boxed,
      top: { style: "double", color: { argb: BRAND } },
    };
    cell.alignment = { vertical: "middle" };
  }

  row.getCell(column - 1).value = "รวม";
  row.getCell(column).value = {
    formula: `SUBTOTAL(109,${letter}2:${letter}${dataRows + 1})`,
  };
  row.getCell(column).numFmt = MONEY;
}

function zebra(row: ExcelJS.Row, columns: number) {
  for (let c = 1; c <= columns; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
  }
}

/** กรอบรอบกลุ่มเซลล์ในชีตสรุป ซึ่งไม่ได้เป็นตารางที่มีหัว */
function boxRange(ws: ExcelJS.Worksheet, from: number, to: number, columns: number) {
  for (let r = from; r <= to; r++) {
    for (let c = 1; c <= columns; c++) ws.getRow(r).getCell(c).border = boxed;
  }
}

function footnote(ws: ExcelJS.Worksheet, text: string) {
  ws.addRow([text]).font = { name: FONT, size: 9, italic: true, color: { argb: INK_SOFT } };
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
  return toNumber(profit) / base;
}
