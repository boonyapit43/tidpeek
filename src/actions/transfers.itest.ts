import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSummary, listAccountMovements, listAccountsWithBalance } from "@/db/queries";
import { createSession, destroySession } from "@/lib/auth";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import { IDLE, type ActionState } from "./shared";
import { createTransfer, deleteTransfer, updateTransfer } from "./transfers";

/**
 * การโอนเงินระหว่างบัญชี
 *
 * ข้อสัญญาที่ต้องเป็นจริงเสมอ ไม่ว่าจะสร้าง แก้ หรือลบ
 *
 *   1) เงินออกจากบัญชีหนึ่งเท่ากับเงินเข้าอีกบัญชีหนึ่งเป๊ะ
 *      ไม่มีทางงอกหรือหายระหว่างทาง
 *   2) กำไรต้องไม่ขยับแม้แต่บาทเดียว การโอนไม่ใช่รายรับและไม่ใช่รายจ่าย
 *   3) ยอดรวมของทุกบัญชีรวมกันต้องเท่าเดิมก่อนและหลังโอน
 *
 * ข้อ 3 คือข้อที่จับบั๊กได้กว้างที่สุด ถ้ามีอะไรผิดไม่ว่าจะฝั่งไหน
 * ผลรวมทั้งระบบจะไม่ตรง แม้ยอดรายบัญชีจะดูถูกก็ตาม
 */

const fd = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) form.set(k, v);
  return form;
};

const ok = (state: ActionState) => {
  if (state.status !== "ok") throw new Error(`คาดว่าสำเร็จ แต่ได้: ${JSON.stringify(state)}`);
  return state;
};

function must<T>(row: T | undefined, what: string): T {
  if (!row) throw new Error(`เทสหา ${what} ไม่เจอ`);
  return row;
}

let shopId: string;
let otherShopId: string;
let scb: string;
let krungthai: string;
let cash: string;
/** บัญชีของอีกร้าน ซึ่งร้านนี้ต้องแตะไม่ได้ */
let foreignAccount: string;

const n = (v: string) => Number(v);

async function balances() {
  const rows = await listAccountsWithBalance(shopId);
  return Object.fromEntries(rows.map((r) => [r.id, n(r.balance)]));
}

/** ยอดรวมของทุกบัญชีในระบบ ต้องไม่เปลี่ยนเพราะการโอน */
async function totalEverywhere(): Promise<number> {
  const [row] = await raw<{ total: string }[]>`
    select coalesce(sum(
      a.opening_balance
      + coalesce((select sum(case when t.direction='in' then t.amount else -t.amount end)
                    from transactions t where t.account_id = a.id and t.is_deleted = false), 0)
      + coalesce((select sum(case when tf.to_account_id = a.id then tf.amount else -tf.amount end)
                    from transfers tf
                   where (tf.to_account_id = a.id or tf.from_account_id = a.id)
                     and tf.is_deleted = false), 0)
    ), 0)::text as total
    from accounts a where a.is_deleted = false`;
  return n(row.total);
}

async function seed() {
  const [shop] = await raw<{ id: string }[]>`
    insert into shops (name) values ('ร้านหลัก') returning id`;
  const [other] = await raw<{ id: string }[]>`
    insert into shops (name) values ('ร้านอื่น') returning id`;
  shopId = shop.id;
  otherShopId = other.id;

  const mk = async (shop: string | null, name: string, opening: string) => {
    const [row] = await raw<{ id: string }[]>`
      insert into accounts (shop_id, name, kind, opening_balance)
      values (${shop}, ${name}, 'bank', ${opening}) returning id`;
    return row.id;
  };

  scb = await mk(shopId, "SCB", "10000");
  krungthai = await mk(shopId, "กรุงไทย", "2000");
  cash = await mk(shopId, "เงินสด", "500");
  foreignAccount = await mk(otherShopId, "บัญชีร้านอื่น", "0");
}

const transferForm = (over: Partial<Record<string, string>> = {}) =>
  fd({
    shopId,
    fromAccountId: scb,
    toAccountId: krungthai,
    txnDate: "2026-08-13",
    amount: "3000",
    ...over,
  } as Record<string, string>);

beforeAll(async () => {
  await createSchema();
});

beforeEach(async () => {
  await resetData();
  await destroySession();
  await createSession();
  await seed();
});

afterAll(async () => {
  await closeTestDb();
});

/* ------------------------------------------------------------------ */

describe("โอนเงิน", () => {
  it("เงินออกจากต้นทางเท่ากับเงินเข้าปลายทางเป๊ะ", async () => {
    const before = await balances();

    ok(await createTransfer(IDLE, transferForm()));

    const after = await balances();
    expect(after[scb]).toBe(before[scb] - 3000);
    expect(after[krungthai]).toBe(before[krungthai] + 3000);
  });

  it("ยอดรวมทุกบัญชีเท่าเดิม เงินไม่งอกไม่หาย", async () => {
    const before = await totalEverywhere();

    ok(await createTransfer(IDLE, transferForm()));

    expect(await totalEverywhere()).toBe(before);
  });

  it("กำไรต้องไม่ขยับแม้แต่บาทเดียว", async () => {
    const before = await getSummary(shopId, { year: "2026" });

    ok(await createTransfer(IDLE, transferForm({ amount: "9999" })));

    const after = await getSummary(shopId, { year: "2026" });
    expect(after.profit).toBe(before.profit);
    expect(after.income).toBe(before.income);
    expect(after.expense).toBe(before.expense);
    // ไม่โผล่แม้แต่ในช่อง "ไม่นับเป็นกำไร" เพราะไม่ได้อยู่ในตาราง transactions
    expect(after.excluded).toBe(before.excluded);
  });

  it("การโอนไม่โผล่ในรายการของร้าน", async () => {
    ok(await createTransfer(IDLE, transferForm()));

    const [{ count }] = await raw`select count(*)::int as count from transactions`;
    expect(count).toBe(0);
  });

  it("บันทึกหมายเหตุไว้ได้ เพราะเป็นที่เดียวที่เก็บเหตุผลของการโอน", async () => {
    ok(await createTransfer(IDLE, transferForm({ note: "สำรองจ่ายค่าของเดือนหน้า" })));

    const [row] = await raw`select note from transfers`;
    expect(row.note).toBe("สำรองจ่ายค่าของเดือนหน้า");
  });

  it("ไม่ใส่หมายเหตุก็โอนได้ — ฟอร์มไม่ส่งคีย์ note มาเลย", async () => {
    // เหมือนช่องหมายเหตุที่ยุบไว้ในฟอร์มบันทึกรายการ ซึ่งเคยทำให้บันทึกไม่ได้ทั้งแอป
    const form = transferForm();
    expect([...form.keys()]).not.toContain("note");

    ok(await createTransfer(IDLE, form));

    const [row] = await raw`select note from transfers`;
    expect(row.note).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("สิ่งที่ต้องโอนไม่ได้", () => {
  it("โอนเข้าบัญชีตัวเอง", async () => {
    const state = await createTransfer(IDLE, transferForm({ toAccountId: scb }));

    expect(state.status).toBe("error");
    const [{ count }] = await raw`select count(*)::int as count from transfers`;
    expect(count).toBe(0);
  });

  it("โอนเข้าบัญชีของร้านอื่น", async () => {
    const state = await createTransfer(IDLE, transferForm({ toAccountId: foreignAccount }));

    expect(state.status).toBe("error");
    const [{ count }] = await raw`select count(*)::int as count from transfers`;
    expect(count).toBe(0);
  });

  it("โอนออกจากบัญชีของร้านอื่น", async () => {
    const state = await createTransfer(IDLE, transferForm({ fromAccountId: foreignAccount }));

    expect(state.status).toBe("error");
  });

  it("จำนวนเงินเป็นศูนย์หรือติดลบ", async () => {
    expect((await createTransfer(IDLE, transferForm({ amount: "0" }))).status).toBe("error");
    expect((await createTransfer(IDLE, transferForm({ amount: "-100" }))).status).toBe("error");
  });

  it("ยังไม่ได้ล็อกอิน", async () => {
    await destroySession();

    const state = await createTransfer(IDLE, transferForm());

    expect(state.status).toBe("error");
    const [{ count }] = await raw`select count(*)::int as count from transfers`;
    expect(count).toBe(0);
  });

  /**
   * ด่านสุดท้ายที่ฐานข้อมูล
   *
   * ต่อให้มีโค้ดเส้นทางใหม่ที่ลืมตรวจ หรือมีคนไปยิง SQL เอง
   * ฐานข้อมูลต้องไม่ยอมให้มีแถวที่โอนเข้าบัญชีตัวเองอยู่ได้
   */
  it("ฐานข้อมูลปฏิเสธแถวที่ต้นทางกับปลายทางเป็นบัญชีเดียวกัน", async () => {
    await expect(
      raw`insert into transfers (shop_id, from_account_id, to_account_id, txn_date, amount)
          values (${shopId}, ${scb}, ${scb}, '2026-08-13', 100)`,
    ).rejects.toThrow(/transfers_accounts_differ_check/);
  });

  it("ฐานข้อมูลปฏิเสธจำนวนเงินที่ไม่เป็นบวก", async () => {
    await expect(
      raw`insert into transfers (shop_id, from_account_id, to_account_id, txn_date, amount)
          values (${shopId}, ${scb}, ${krungthai}, '2026-08-13', 0)`,
    ).rejects.toThrow(/transfers_amount_check/);
  });
});

/* ------------------------------------------------------------------ */

describe("แก้ไขการโอน", () => {
  async function makeTransfer(over: Partial<Record<string, string>> = {}) {
    ok(await createTransfer(IDLE, transferForm(over)));
    const [row] = await raw<{ id: string }[]>`select id from transfers limit 1`;
    return row.id;
  }

  /** คำถามที่เจ้าของร้านถามไว้เอง — แก้แล้วสองฝั่งจะไม่ตรงกันไหม */
  it("แก้จำนวนเงิน สองฝั่งขยับพร้อมกันเสมอ", async () => {
    const before = await balances();
    const id = await makeTransfer();

    ok(await updateTransfer(IDLE, transferForm({ id, amount: "500" })));

    const after = await balances();
    expect(after[scb]).toBe(before[scb] - 500);
    expect(after[krungthai]).toBe(before[krungthai] + 500);
    expect(await totalEverywhere()).toBe(await totalEverywhere());
  });

  it("แก้จำนวนเงินแล้วยอดรวมทั้งระบบยังเท่าเดิม", async () => {
    const before = await totalEverywhere();
    const id = await makeTransfer();

    ok(await updateTransfer(IDLE, transferForm({ id, amount: "77" })));

    expect(await totalEverywhere()).toBe(before);
  });

  it("เปลี่ยนบัญชีปลายทาง เงินย้ายไปบัญชีใหม่ทั้งก้อน", async () => {
    const before = await balances();
    const id = await makeTransfer();

    ok(await updateTransfer(IDLE, transferForm({ id, toAccountId: cash })));

    const after = await balances();
    expect(after[scb]).toBe(before[scb] - 3000);
    expect(after[krungthai]).toBe(before[krungthai]); // กลับไปเท่าเดิม
    expect(after[cash]).toBe(before[cash] + 3000);
  });

  it("แก้ให้กลายเป็นบัญชีเดียวกันไม่ได้", async () => {
    const id = await makeTransfer();

    const state = await updateTransfer(IDLE, transferForm({ id, toAccountId: scb }));

    expect(state.status).toBe("error");
    const [row] = await raw`select to_account_id from transfers`;
    expect(row.to_account_id).toBe(krungthai);
  });

  it("แก้การโอนของร้านอื่นไม่ได้ แม้จะรู้ id", async () => {
    const id = await makeTransfer();

    const state = await updateTransfer(
      IDLE,
      fd({
        shopId: otherShopId,
        id,
        fromAccountId: scb,
        toAccountId: krungthai,
        txnDate: "2026-08-13",
        amount: "999999",
      }),
    );

    expect(state.status).toBe("error");
    const [row] = await raw`select amount from transfers`;
    expect(row.amount).toBe("3000.00");
  });
});

/* ------------------------------------------------------------------ */

describe("ลบการโอน", () => {
  it("ลบแล้วเงินคืนที่เดิมทั้งสองฝั่ง ไม่มีขาค้าง", async () => {
    const before = await balances();

    ok(await createTransfer(IDLE, transferForm()));
    const [row] = await raw<{ id: string }[]>`select id from transfers`;
    ok(await deleteTransfer(IDLE, fd({ shopId, id: row.id })));

    const after = await balances();
    expect(after[scb]).toBe(before[scb]);
    expect(after[krungthai]).toBe(before[krungthai]);
  });

  it("แถวยังอยู่ในฐาน ไม่ได้ลบออกจริง", async () => {
    ok(await createTransfer(IDLE, transferForm()));
    const [row] = await raw<{ id: string }[]>`select id from transfers`;
    ok(await deleteTransfer(IDLE, fd({ shopId, id: row.id })));

    const [{ count }] = await raw`select count(*)::int as count from transfers where is_deleted`;
    expect(count).toBe(1);
  });

  it("ลบซ้ำไม่ได้", async () => {
    ok(await createTransfer(IDLE, transferForm()));
    const [row] = await raw<{ id: string }[]>`select id from transfers`;

    ok(await deleteTransfer(IDLE, fd({ shopId, id: row.id })));
    expect((await deleteTransfer(IDLE, fd({ shopId, id: row.id }))).status).toBe("error");
  });
});

/* ------------------------------------------------------------------ */

describe("หน้าเคลื่อนไหวของบัญชี", () => {
  it("เห็นทั้งรายการปกติและการโอน เรียงวันใหม่สุดขึ้นก่อน", async () => {
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, account_id)
      values (${shopId}, '2026-08-10', 'in', 1500, 'ยอดขาย', ${scb})`;

    ok(await createTransfer(IDLE, transferForm({ txnDate: "2026-08-12" })));

    const rows = await listAccountMovements(scb);

    expect(rows.map((r) => r.kind)).toEqual(["transfer", "txn"]);
    expect(rows[0].txnDate).toBe("2026-08-12");
    expect(rows[1].label).toBe("ยอดขาย");
  });

  it("ฝั่งต้นทางเห็นเป็นเงินออก ฝั่งปลายทางเห็นเป็นเงินเข้า", async () => {
    ok(await createTransfer(IDLE, transferForm()));

    const [out] = await listAccountMovements(scb);
    const [into] = await listAccountMovements(krungthai);

    expect(n(out.signed)).toBe(-3000);
    expect(out.label).toBe("กรุงไทย"); // ชื่อบัญชีอีกฝั่ง

    expect(n(into.signed)).toBe(3000);
    expect(into.label).toBe("SCB");
  });

  it("ผลรวมของบรรทัดที่เห็น บวกยอดตั้งต้น เท่ากับยอดคงเหลือที่โชว์", async () => {
    // ถ้าหน้านี้อธิบายยอดคงเหลือไม่ได้ แปลว่ามีอะไรตกหล่นไปจากที่ใดที่หนึ่ง
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, account_id)
      values (${shopId}, '2026-08-10', 'in', 1500, 'ยอดขาย', ${scb})`;
    await raw`
      insert into transactions (shop_id, txn_date, direction, amount, title, account_id)
      values (${shopId}, '2026-08-11', 'out', 200, 'ค่าน้ำ', ${scb})`;
    ok(await createTransfer(IDLE, transferForm()));

    const rows = await listAccountMovements(scb);
    const moved = rows.reduce((sum, r) => sum + n(r.signed), 0);

    const account = must(
      (await listAccountsWithBalance(shopId)).find((a) => a.id === scb),
      "บัญชี SCB",
    );

    expect(n(account.openingBalance) + moved).toBe(n(account.balance));
  });

  it("การโอนที่ลบแล้วหายไปจากหน้าเคลื่อนไหว", async () => {
    ok(await createTransfer(IDLE, transferForm()));
    const [row] = await raw<{ id: string }[]>`select id from transfers`;
    ok(await deleteTransfer(IDLE, fd({ shopId, id: row.id })));

    expect(await listAccountMovements(scb)).toHaveLength(0);
  });
});
