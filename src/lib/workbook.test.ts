import { beforeAll, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, type WorkbookInput } from "./workbook";

/**
 * ไฟล์ Excel ที่ส่งออกไป — สิ่งเดียวของแอปนี้ที่ออกไปอยู่นอกมือเรา
 *
 * พอส่งให้คนทำบัญชีแล้ว ไม่มีใครมาบอกเราว่ามันผิด เขาจะอ่านตัวเลขที่เห็น
 * แล้วเชื่อ เทสชุดนี้จึงเปิดไฟล์ที่สร้างเสร็จกลับขึ้นมาอ่านจริง ไม่ได้เช็ก
 * แค่ว่าสร้างไฟล์ผ่านโดยไม่โยน error
 *
 * สามอย่างที่ต้องจริงเสมอ
 *   • วันที่เป็นชนิดวันที่ ไม่ใช่ข้อความ — ไม่งั้นเรียงตามวันไม่ได้
 *   • เงินเป็นตัวเลข ไม่ใช่ข้อความ — ไม่งั้นลาก SUM ไม่ได้ ไฟล์ก็ไร้ประโยชน์
 *   • เวลาที่บันทึกเป็นเวลาไทย ไม่ใช่ UTC ที่เซิร์ฟเวอร์รันอยู่
 */

vi.mock("server-only", () => ({}));

const stamp = new Date("2026-08-28T16:30:00Z"); // = 23:30 ตามเวลาไทย

const INPUT: WorkbookInput = {
  shopName: "คลุกแห้งติดปีก",
  periodLabel: "เดือนสิงหาคม 2569",
  generatedAt: "2026-08-28 23:46",
  summary: {
    income: "1500.00",
    expense: "635.00",
    profit: "865.00",
    inExcluded: "1000.00",
    outExcluded: "150.00",
    excluded: "1150.00",
  },
  categories: [
    {
      categoryId: "c1",
      name: "ขายหน้าร้าน",
      direction: "in",
      counts: true,
      total: "1500.00",
      txnCount: 1,
    },
    {
      categoryId: "c2",
      name: "ซื้อของเข้าร้าน",
      direction: "out",
      counts: true,
      total: "104.00",
      txnCount: 1,
    },
    {
      categoryId: "c3",
      name: "ถอนใช้ส่วนตัว",
      direction: "out",
      counts: false,
      total: "150.00",
      txnCount: 1,
    },
  ],
  transactions: [
    {
      txnDate: "2026-08-28",
      direction: "out",
      categoryName: "ซื้อของเข้าร้าน",
      counts: true,
      title: "ซื้อของ",
      amount: "104.00",
      accountName: "เงินสด",
      note: null,
      createdAt: stamp,
    },
    {
      txnDate: "2026-08-28",
      direction: "in",
      categoryName: null,
      counts: true,
      title: "ขายวันนี้",
      amount: "1500.00",
      accountName: null,
      note: "รวมไลน์แมน",
      createdAt: stamp,
    },
  ],
  transfers: [
    {
      txnDate: "2026-08-28",
      fromName: "เงินสด",
      toName: "ไทยพลัส",
      amount: "500.00",
      note: "ฝากเข้าธนาคาร",
      createdAt: stamp,
    },
  ],
  accounts: [
    {
      name: "เงินสด",
      active: true,
      shared: false,
      opening: "1000.00",
      income: "1500.00",
      expense: "635.00",
      transferNet: "-500.00",
      closing: "1365.00",
    },
  ],
};

async function build(input: WorkbookInput = INPUT) {
  const wb = new ExcelJS.Workbook();
  const bytes = await buildWorkbook(input);

  // exceljs ประกาศ global interface Buffer extends ArrayBuffer ทับของ Node
  // ทำให้ Buffer จริงส่งเข้า load() ไม่ผ่าน tsc ทั้งที่รันได้ปกติ
  await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);

  return wb;
}

let wb: ExcelJS.Workbook;

beforeAll(async () => {
  wb = await build();
});

/* ------------------------------------------------------------------ */

describe("โครงของไฟล์", () => {
  it("มีสี่ชีต เรียงจากภาพรวมไปหารายละเอียด", () => {
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      "สรุป",
      "รายการ",
      "โอนระหว่างบัญชี",
      "ยอดบัญชี",
    ]);
  });

  it("ชื่อร้านกับช่วงเวลาอยู่บนหัวชีตสรุป จะได้ไม่ต้องเดาจากชื่อไฟล์", () => {
    const ws = wb.getWorksheet("สรุป")!;

    expect(ws.getCell("A1").value).toBe("คลุกแห้งติดปีก");
    expect(ws.getCell("A2").value).toBe("เดือนสิงหาคม 2569");
  });
});

/* ------------------------------------------------------------------ */

describe("ชนิดของข้อมูลในเซลล์", () => {
  it("จำนวนเงินเป็นตัวเลขจริง ลาก SUM ได้ทันที", () => {
    const ws = wb.getWorksheet("รายการ")!;
    const amount = ws.getRow(2).getCell(5).value;

    expect(typeof amount).toBe("number");
    expect(amount).toBe(104);
  });

  it("วันที่เป็นชนิดวันที่จริง และเป็นวันที่ถูกต้อง ไม่เลื่อนไปวันข้างเคียง", () => {
    const ws = wb.getWorksheet("รายการ")!;
    const date = ws.getRow(2).getCell(1).value as Date;

    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString().slice(0, 10)).toBe("2026-08-28");
  });

  /**
   * ฐานข้อมูลเก็บเป็น UTC และ Vercel ก็รันเป็น UTC ถ้าเขียนลงไปดิบๆ
   * ช่องนี้จะโชว์ 16:30 ทั้งที่คนกดบันทึกตอนห้าทุ่มครึ่ง
   */
  it("เวลาที่บันทึกเป็นเวลาไทย ไม่ใช่เวลาของเซิร์ฟเวอร์", () => {
    const ws = wb.getWorksheet("รายการ")!;
    const at = ws.getRow(2).getCell(9).value as Date;

    expect(at).toBeInstanceOf(Date);
    expect(at.toISOString()).toBe("2026-08-28T23:30:00.000Z");
  });

  it("เงินติดรูปแบบหลักพันไว้ จะได้อ่านออกโดยไม่ต้องนับศูนย์", () => {
    const ws = wb.getWorksheet("รายการ")!;
    expect(ws.getRow(2).getCell(5).numFmt).toBe("#,##0.00");
  });
});

/* ------------------------------------------------------------------ */

describe("ชีตรายการ", () => {
  it("หัวตารางเป็นภาษาไทยครบทุกคอลัมน์", () => {
    const ws = wb.getWorksheet("รายการ")!;
    const header = (ws.getRow(1).values as unknown[]).slice(1);

    expect(header).toEqual([
      "วันที่",
      "ทิศทาง",
      "ประเภท",
      "รายการ",
      "จำนวนเงิน",
      "บัญชี",
      "หมายเหตุ",
      "นับเป็นกำไร",
      "เวลาที่บันทึก",
    ]);
  });

  it("ทิศทางเป็นคำไทย ไม่ใช่ in/out ที่เก็บในฐาน", () => {
    const ws = wb.getWorksheet("รายการ")!;

    expect(ws.getRow(2).getCell(2).value).toBe("จ่ายออก");
    expect(ws.getRow(3).getCell(2).value).toBe("รับเข้า");
  });

  it("รายการที่ไม่ได้ระบุประเภทหรือบัญชี บอกไว้ ไม่ปล่อยเป็นช่องว่าง", () => {
    // ช่องว่างอ่านได้สองแบบ ไม่ได้ใส่ กับ ข้อมูลหาย ซึ่งคนละเรื่องกัน
    const ws = wb.getWorksheet("รายการ")!;

    expect(ws.getRow(3).getCell(3).value).toBe("ไม่ระบุประเภท");
    expect(ws.getRow(3).getCell(6).value).toBe("ไม่ระบุบัญชี");
  });

  it("ตรึงแถวหัวไว้ และเปิดตัวกรองให้แล้ว", () => {
    const ws = wb.getWorksheet("รายการ")!;

    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
  });

  /**
   * แถวรวมต้องเป็นสูตร ไม่ใช่ตัวเลขตาย
   *
   * ถ้าเขียนค่าตายไว้ พอคนกรองเหลือเฉพาะค่าแรง ยอดรวมจะยังเป็นของทั้งเดือน
   * แล้วเขาจะอ่านผิดโดยไม่มีอะไรเตือน SUBTOTAL(109) นับเฉพาะแถวที่ยังโชว์อยู่
   */
  it("แถวรวมเป็นสูตร SUBTOTAL ที่ขยับตามตัวกรอง", () => {
    const ws = wb.getWorksheet("รายการ")!;
    const total = ws.getRow(4).getCell(5).value as { formula?: string };

    expect(total.formula).toBe("SUBTOTAL(109,E2:E3)");
  });
});

/* ------------------------------------------------------------------ */

describe("ชีตโอนระหว่างบัญชี", () => {
  it("บอกต้นทางปลายทางเป็นชื่อบัญชี ไม่ใช่ id", () => {
    const ws = wb.getWorksheet("โอนระหว่างบัญชี")!;

    expect(ws.getRow(2).getCell(2).value).toBe("เงินสด");
    expect(ws.getRow(2).getCell(3).value).toBe("ไทยพลัส");
    expect(ws.getRow(2).getCell(4).value).toBe(500);
  });

  it("ช่วงที่ไม่มีการโอน บอกไว้ตรงๆ ไม่ปล่อยชีตว่าง", async () => {
    // ชีตว่างเปล่าทำให้คนสงสัยว่าไฟล์พังหรือข้อมูลหาย
    const empty = await build({ ...INPUT, transfers: [] });
    const ws = empty.getWorksheet("โอนระหว่างบัญชี")!;

    expect(ws.getRow(2).getCell(1).value).toBe("ช่วงนี้ไม่มีการโอนระหว่างบัญชี");
  });
});

/* ------------------------------------------------------------------ */

describe("ชีตยอดบัญชี", () => {
  const CASH = INPUT.accounts[0];

  it("บัญชีที่ปิดใช้งานมีวงเล็บกำกับ เพราะหาในแอปไม่เจอแล้ว", async () => {
    const wb2 = await build({ ...INPUT, accounts: [{ ...CASH, active: false }] });
    expect(wb2.getWorksheet("ยอดบัญชี")!.getRow(2).getCell(1).value).toBe(
      "เงินสด (ปิดใช้งาน)",
    );
  });

  it("มีบัญชีร่วมเมื่อไหร่ ต้องมีหมายเหตุอธิบายว่าตัวเลขนับทุกร้าน", async () => {
    const texts = (wb3: ExcelJS.Workbook) => {
      const out: string[] = [];
      wb3.getWorksheet("ยอดบัญชี")!.eachRow((r) => out.push(String(r.getCell(1).value ?? "")));
      return out.join("|");
    };

    const withShared = await build({ ...INPUT, accounts: [{ ...CASH, shared: true }] });
    expect(texts(withShared)).toContain("ใช้ร่วมกันทุกร้าน");

    // ไม่มีบัญชีร่วม ไม่ต้องมีหมายเหตุมากวน
    expect(texts(wb)).not.toContain("ใช้ร่วมกันทุกร้าน");
  });
  it("แจกแจงตั้งต้น เข้า ออก โอน และคงเหลือ เป็นตัวเลขทุกช่อง", () => {
    const ws = wb.getWorksheet("ยอดบัญชี")!;
    const row = ws.getRow(2);

    expect(row.getCell(1).value).toBe("เงินสด");
    expect(row.getCell(2).value).toBe(1000);
    expect(row.getCell(3).value).toBe(1500);
    expect(row.getCell(4).value).toBe(635);
    expect(row.getCell(5).value).toBe(-500);
    expect(row.getCell(6).value).toBe(1365);
  });
});

/* ------------------------------------------------------------------ */

describe("ชีตสรุป", () => {
  const labelsOf = (ws: ExcelJS.Worksheet) => {
    const out: string[] = [];
    ws.eachRow((row) => out.push(String(row.getCell(1).value ?? "")));
    return out;
  };

  it("มีกำไรกับเงินที่ไม่นับเป็นกำไรแยกกัน", () => {
    const labels = labelsOf(wb.getWorksheet("สรุป")!);

    expect(labels).toContain("กำไร");
    expect(labels).toContain("เงินที่ไม่นับเป็นกำไร");
  });

  it("ประเภทที่ไม่นับเป็นกำไรมีวงเล็บกำกับในไฟล์ด้วย", () => {
    // ในแอปใช้สีบอกได้ แต่ไฟล์ถูกพิมพ์ขาวดำและถูกก๊อปไปวางที่อื่น
    expect(labelsOf(wb.getWorksheet("สรุป")!)).toContain("ถอนใช้ส่วนตัว (ไม่นับเป็นกำไร)");
  });

  it("ไม่มีเงินนอกกำไรเลย ก็ไม่ต้องมีบรรทัดนั้นมากวน", async () => {
    const clean = await build({
      ...INPUT,
      summary: { ...INPUT.summary, inExcluded: "0", outExcluded: "0", excluded: "0" },
    });

    expect(labelsOf(clean.getWorksheet("สรุป")!)).not.toContain("เงินที่ไม่นับเป็นกำไร");
  });

  it("ร้านที่ยังไม่มีรายการเลย ก็ยังสร้างไฟล์ได้ ไม่พัง", async () => {
    const empty = await build({
      ...INPUT,
      summary: {
        income: "0",
        expense: "0",
        profit: "0",
        inExcluded: "0",
        outExcluded: "0",
        excluded: "0",
      },
      categories: [],
      transactions: [],
      transfers: [],
      accounts: [],
    });

    expect(empty.worksheets).toHaveLength(4);
    expect(empty.getWorksheet("รายการ")!.rowCount).toBe(1);
  });
});
