import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSession, destroySession } from "@/lib/auth";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import { IDLE, type ActionState } from "./shared";
import {
  addDefaultCategories,
  createAccount,
  createCategory,
  createShop,
  deleteAccount,
  deleteShop,
  updateAccount,
} from "./settings";
import { createTransaction, deleteTransaction, updateTransaction } from "./transactions";

/**
 * เทสเส้นทางจริงตั้งแต่ FormData ถึงฐานข้อมูล
 *
 * เรียก server action ตัวจริง ด้วย FormData ที่ประกอบแบบเดียวกับที่ฟอร์ม
 * ในเบราว์เซอร์ส่งมา แล้วไปอ่านฐานข้อมูลจริงเพื่อดูว่าเกิดอะไรขึ้น
 *
 * ที่ต้องทำแบบนี้เพราะบั๊กร้ายแรงที่สุดของโปรเจกต์นี้อยู่ที่ "รอยต่อ"
 * ไม่ได้อยู่ในฟังก์ชันไหนเป็นพิเศษ — ช่องหมายเหตุที่ยุบไว้ไม่ส่งคีย์มาเลย
 * แล้วอีกฝั่งไม่ได้เผื่อกรณีนั้น ผลคือบันทึกรายการไม่ได้ทั้งแอป
 * โดยที่เทสหน่วย 63 ข้อผ่านหมด เพราะทุกข้อเขียน object ขึ้นมาเองครบทุกคีย์
 *
 * ⚠️ กติกาของไฟล์นี้: ห้ามเขียน FormData ให้ครบเกินกว่าที่ฟอร์มจริงส่ง
 *    ถ้าฟอร์มไม่ส่งคีย์ไหน เทสก็ต้องไม่ส่ง ไม่งั้นจะกลับไปเป็นเทสที่
 *    ทดสอบจินตนาการของคนเขียนอีกครั้ง
 */

const fd = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) form.set(k, v);
  return form;
};

/** FormData ของฟอร์มบันทึกรายการ — สังเกตว่าไม่มีคีย์ note เหมือนของจริง */
const entryFormData = (values: {
  shopId: string;
  amount: string;
  title: string;
  direction?: string;
  txnDate?: string;
  categoryId?: string;
  accountId?: string;
}) =>
  fd({
    shopId: values.shopId,
    direction: values.direction ?? "in",
    txnDate: values.txnDate ?? "2026-08-13",
    amount: values.amount,
    title: values.title,
    categoryId: values.categoryId ?? "",
    accountId: values.accountId ?? "",
  });

const ok = (state: ActionState) => {
  if (state.status !== "ok") throw new Error(`คาดว่าสำเร็จ แต่ได้: ${JSON.stringify(state)}`);
  return state;
};

/** แถวที่ต้องเจอแน่ๆ ถ้าไม่เจอแปลว่าเทสเขียนผิด ไม่ใช่โค้ดผิด */
function must<T>(row: T | undefined, what: string): T {
  if (!row) throw new Error(`เทสหา ${what} ไม่เจอ`);
  return row;
}

/** สร้างร้านผ่าน action จริง แล้วคืน id ที่ฐานข้อมูลออกให้ */
async function makeShop(name = "ร้านทดสอบ"): Promise<string> {
  ok(await createShop(IDLE, fd({ name })));
  const [row] = await raw<{ id: string }[]>`select id from shops where name = ${name} limit 1`;
  return must(row, `ร้าน ${name}`).id;
}

type AccountRow = { id: string; name: string; kind: string; balance: string };

/**
 * อ่านยอดคงเหลือด้วย SQL ที่เขียนเองในเทส ไม่ได้เรียก query ของแอป
 *
 * ตั้งใจให้เป็นคนละเส้นทางกับโค้ดจริง ถ้าใช้ฟังก์ชันเดียวกับที่กำลังทดสอบ
 * แล้วมันคิดผิด เทสก็จะผิดตามไปด้วยโดยไม่มีอะไรฟ้อง
 */
async function accountsOf(shopId: string): Promise<AccountRow[]> {
  return raw<AccountRow[]>`
    select a.id, a.name, a.kind,
           (a.opening_balance + coalesce((
             select sum(case when t.direction = 'in' then t.amount else -t.amount end)
               from transactions t
              where t.account_id = a.id and t.is_deleted = false), 0))::text as balance
      from accounts a
     where a.is_deleted = false and (a.shop_id is null or a.shop_id = ${shopId})
     order by a.sort_order`;
}

const balanceOf = (rows: AccountRow[], id: string) =>
  must(
    rows.find((r) => r.id === id),
    `บัญชี ${id}`,
  ).balance;

beforeAll(async () => {
  await createSchema();
});

beforeEach(async () => {
  await resetData();
  await destroySession();
  await createSession();
});

afterAll(async () => {
  await closeTestDb();
});

/* ------------------------------------------------------------------ */

describe("บันทึกรายการ — เส้นทางที่คนใช้จริงทุกวัน", () => {
  it("ฟอร์มที่ยังไม่ได้กดเปิดช่องหมายเหตุ ต้องบันทึกได้", async () => {
    // นี่คือบั๊กที่ทำให้บันทึกไม่ได้ทั้งแอป ฟอร์มไม่ส่งคีย์ note มาเลย
    const shopId = await makeShop();

    ok(await createTransaction(IDLE, entryFormData({ shopId, amount: "250", title: "ขายของ" })));

    const [row] = await raw`select title, amount, note from transactions`;
    expect(row.title).toBe("ขายของ");
    expect(row.amount).toBe("250.00");
    expect(row.note).toBeNull();
  });

  it("ไม่เลือกประเภทและบัญชี ได้ null ไม่ใช่ error", async () => {
    const shopId = await makeShop();

    ok(await createTransaction(IDLE, entryFormData({ shopId, amount: "80", title: "ขายน้ำ" })));

    const [row] = await raw`select category_id, account_id from transactions`;
    expect(row.category_id).toBeNull();
    expect(row.account_id).toBeNull();
  });

  it("วันที่ที่บันทึกต้องตรงกับที่เลือก ไม่เลื่อนตามเขตเวลา", async () => {
    // เทสรันด้วย TZ=UTC ถ้าวันเลื่อนจะได้ 2026-01-01 หรือ 2026-01-03
    const shopId = await makeShop();

    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "10", title: "ปีใหม่", txnDate: "2026-01-02" }),
      ),
    );

    const [row] = await raw`select txn_date::text as d from transactions`;
    expect(row.d).toBe("2026-01-02");
  });

  it("จำนวนเงินที่มีจุลภาคติดมาจากคีย์บอร์ดมือถือ ต้องบันทึกได้", async () => {
    const shopId = await makeShop();

    ok(
      await createTransaction(IDLE, entryFormData({ shopId, amount: "1,250.50", title: "ขายส่ง" })),
    );

    const [row] = await raw`select amount from transactions`;
    expect(row.amount).toBe("1250.50");
  });

  it("ยังไม่ได้ล็อกอิน บันทึกไม่ได้", async () => {
    const shopId = await makeShop();
    await destroySession();

    const state = await createTransaction(IDLE, entryFormData({ shopId, amount: "1", title: "x" }));

    expect(state.status).toBe("error");
    const [{ count }] = await raw`select count(*)::int as count from transactions`;
    expect(count).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("ร้านใหม่ต้องใช้งานได้ทันที", () => {
  it("เพิ่มร้านแล้วได้บัญชีเงินสดกับประเภทตั้งต้นมาด้วย", async () => {
    const shopId = await makeShop("ร้านแรก");

    const accounts = await accountsOf(shopId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe("เงินสด");
    expect(accounts[0].kind).toBe("cash");

    const [cats] = await raw`
      select count(*) filter (where direction = 'in')::int  as "in",
             count(*) filter (where direction = 'out')::int as "out"
        from categories where is_deleted = false`;
    expect(cats.in).toBe(13);
    expect(cats.out).toBe(20);
  });

  it("ร้านที่สองใช้ประเภทชุดเดิมร่วมกัน ไม่ได้ของซ้ำอีกชุด", async () => {
    await makeShop("ร้านหนึ่ง");
    await makeShop("ร้านสอง");

    const [{ count }] = await raw`select count(*)::int as count from categories`;
    expect(count).toBe(33);
  });

  it("บัญชีเงินสดของแต่ละร้านแยกกัน ไม่ใช่ลิ้นชักเดียวกัน", async () => {
    const a = await makeShop("ร้านหนึ่ง");
    const b = await makeShop("ร้านสอง");

    const [accA] = await accountsOf(a);
    const [accB] = await accountsOf(b);
    expect(accA.id).not.toBe(accB.id);
  });

  it("เพิ่มร้านโดยไม่ได้ล็อกอิน ต้องไม่เกิดอะไรขึ้นเลย", async () => {
    await destroySession();

    const state = await createShop(IDLE, fd({ name: "ร้านแอบสร้าง" }));

    expect(state.status).toBe("error");
    const [{ count }] = await raw`select count(*)::int as count from shops`;
    expect(count).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("ยอดคงเหลือต้องเดินตามเงินจริง", () => {
  async function shopWithAccount(opening: string) {
    const shopId = await makeShop();
    ok(
      await createAccount(
        IDLE,
        fd({
          shopId,
          name: "ไทยพลัส",
          kind: "bank",
          bank: "",
          accountNo: "",
          openingBalance: opening,
        }),
      ),
    );

    const rows = await accountsOf(shopId);
    const account = must(
      rows.find((r) => r.name === "ไทยพลัส"),
      "บัญชีไทยพลัส",
    );
    return { shopId, accountId: account.id };
  }

  it("ยอดตั้งต้นบวกเงินเข้าลบเงินออก", async () => {
    const { shopId, accountId } = await shopWithAccount("1000");

    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "500.25", title: "ขาย", accountId }),
      ),
    );
    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "200", title: "ซื้อของ", direction: "out", accountId }),
      ),
    );

    expect(balanceOf(await accountsOf(shopId), accountId)).toBe("1300.25");
  });

  it("ประเภทที่ไม่นับเป็นกำไร ยังทำให้ยอดบัญชีขยับ — กฎเหล็กของแอป", async () => {
    const { shopId, accountId } = await shopWithAccount("0");

    const [topUp] = await raw<{ id: string }[]>`
      select id from categories where name = 'เติมทุน' and counts = false limit 1`;

    ok(
      await createTransaction(
        IDLE,
        entryFormData({
          shopId,
          amount: "5000",
          title: "เติมทุน",
          accountId,
          categoryId: topUp.id,
        }),
      ),
    );

    // เงินเข้าบัญชีจริง 5000
    expect(balanceOf(await accountsOf(shopId), accountId)).toBe("5000.00");

    // แต่ไม่ถูกนับเป็นกำไร
    const [profit] = await raw`
      select coalesce(sum(case when coalesce(c.counts, true)
             then (case when t.direction = 'in' then t.amount else -t.amount end)
             else 0 end), 0)::text as p
        from transactions t left join categories c on c.id = t.category_id
       where t.shop_id = ${shopId} and t.is_deleted = false`;
    expect(Number(profit.p)).toBe(0);
  });

  it("ลบรายการแล้วยอดต้องถอยกลับ และแถวยังอยู่ในฐาน", async () => {
    const { shopId, accountId } = await shopWithAccount("100");

    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "70", title: "ขาย", accountId }),
      ),
    );
    const [txn] = await raw<{ id: string }[]>`select id from transactions`;

    ok(await deleteTransaction(IDLE, fd({ shopId, id: txn.id })));

    expect(balanceOf(await accountsOf(shopId), accountId)).toBe("100.00");

    const [{ count }] = await raw`select count(*)::int as count from transactions where is_deleted`;
    expect(count).toBe(1);
  });

  it("แก้จำนวนเงินแล้วยอดขยับตาม", async () => {
    const { shopId, accountId } = await shopWithAccount("0");

    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "10", title: "ขาย", accountId }),
      ),
    );
    const [txn] = await raw<{ id: string }[]>`select id from transactions`;

    ok(
      await updateTransaction(
        IDLE,
        fd({
          shopId,
          id: txn.id,
          direction: "in",
          txnDate: "2026-08-13",
          amount: "99",
          title: "ขาย",
          categoryId: "",
          accountId,
          note: "",
        }),
      ),
    );

    expect(balanceOf(await accountsOf(shopId), accountId)).toBe("99.00");
  });

  it("แก้ยอดตั้งต้นแล้วยอดคงเหลือขยับทันที ไม่ต้องคำนวณใหม่ที่ไหน", async () => {
    const { shopId, accountId } = await shopWithAccount("0");

    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "40", title: "ขาย", accountId }),
      ),
    );

    ok(
      await updateAccount(
        IDLE,
        fd({
          shopId,
          id: accountId,
          name: "ไทยพลัส",
          kind: "bank",
          bank: "",
          accountNo: "",
          openingBalance: "1000",
        }),
      ),
    );

    expect(balanceOf(await accountsOf(shopId), accountId)).toBe("1040.00");
  });

  it("ยอดตั้งต้นติดลบได้ เช่นบัตรเครดิต", async () => {
    const { shopId, accountId } = await shopWithAccount("-500");

    expect(balanceOf(await accountsOf(shopId), accountId)).toBe("-500.00");
  });
});

/* ------------------------------------------------------------------ */

describe("กันข้อมูลข้ามร้าน", () => {
  it("เอาบัญชีของอีกร้านมาผูกไม่ได้", async () => {
    const a = await makeShop("ร้านหนึ่ง");
    const b = await makeShop("ร้านสอง");

    const [accB] = await accountsOf(b);

    const state = await createTransaction(
      IDLE,
      entryFormData({ shopId: a, amount: "10", title: "แอบผูก", accountId: accB.id }),
    );

    expect(state.status).toBe("error");
    const [{ count }] = await raw`select count(*)::int as count from transactions`;
    expect(count).toBe(0);
  });

  it("เลือกประเภทผิดฝั่งไม่ได้ — ประเภทฝั่งจ่ายมาใส่รายการฝั่งรับ", async () => {
    const shopId = await makeShop();
    const [expense] = await raw<{ id: string }[]>`
      select id from categories where direction = 'out' limit 1`;

    const state = await createTransaction(
      IDLE,
      entryFormData({ shopId, amount: "10", title: "ผิดฝั่ง", categoryId: expense.id }),
    );

    expect(state.status).toBe("error");
  });

  it("แก้รายการของอีกร้านไม่ได้ แม้จะรู้ id", async () => {
    const a = await makeShop("ร้านหนึ่ง");
    const b = await makeShop("ร้านสอง");

    ok(
      await createTransaction(IDLE, entryFormData({ shopId: a, amount: "10", title: "ของร้าน A" })),
    );
    const [txn] = await raw<{ id: string }[]>`select id from transactions`;

    const state = await updateTransaction(
      IDLE,
      fd({
        shopId: b,
        id: txn.id,
        direction: "in",
        txnDate: "2026-08-13",
        amount: "9999",
        title: "แอบแก้",
        categoryId: "",
        accountId: "",
        note: "",
      }),
    );

    expect(state.status).toBe("error");
    const [row] = await raw`select amount, title from transactions`;
    expect(row.amount).toBe("10.00");
    expect(row.title).toBe("ของร้าน A");
  });
});

/* ------------------------------------------------------------------ */

describe("ลบร้าน", () => {
  it("ลบร้านแล้วรายการของร้านนั้นหายตาม แต่ประเภทกลางไม่ถูกแตะ", async () => {
    const a = await makeShop("ร้านหนึ่ง");
    const b = await makeShop("ร้านสอง");

    ok(await createTransaction(IDLE, entryFormData({ shopId: a, amount: "10", title: "ของ A" })));
    ok(await createTransaction(IDLE, entryFormData({ shopId: b, amount: "20", title: "ของ B" })));

    ok(await deleteShop(IDLE, fd({ id: a })));

    const [counts] = await raw`
      select (select count(*)::int from transactions where is_deleted)     as "txnDeleted",
             (select count(*)::int from transactions where not is_deleted) as "txnLeft",
             (select count(*)::int from categories where is_deleted)       as "catDeleted",
             (select count(*)::int from accounts where is_deleted)         as "accDeleted"`;

    expect(counts.txnDeleted).toBe(1);
    expect(counts.txnLeft).toBe(1);
    // ประเภทเป็นของกลาง ร้านสองยังใช้อยู่
    expect(counts.catDeleted).toBe(0);
    // บัญชีเงินสดผูกกับร้านหนึ่ง จึงถูกลบตาม
    expect(counts.accDeleted).toBe(1);
  });

  it("ไม่มีการลบแถวออกจากฐานจริงสักแถว", async () => {
    const shopId = await makeShop();
    ok(await createTransaction(IDLE, entryFormData({ shopId, amount: "10", title: "x" })));

    ok(await deleteShop(IDLE, fd({ id: shopId })));

    const [counts] = await raw`
      select (select count(*)::int from shops)        as shops,
             (select count(*)::int from transactions) as txns,
             (select count(*)::int from accounts)     as accounts`;

    expect(counts.shops).toBe(1);
    expect(counts.txns).toBe(1);
    expect(counts.accounts).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

describe("เติมชุดประเภทตั้งต้นย้อนหลัง", () => {
  /** จำลองร้านที่สร้างไว้ก่อนที่ระบบจะใส่ชุดตั้งต้นให้ */
  async function shopWithoutDefaults() {
    const shopId = await makeShop();
    await raw`delete from categories`;
    return shopId;
  }

  it("เติมครบ 33 รายการ", async () => {
    const shopId = await shopWithoutDefaults();

    ok(await addDefaultCategories(IDLE, fd({ shopId })));

    const [{ count }] = await raw`select count(*)::int as count from categories`;
    expect(count).toBe(33);
  });

  it("ไม่สร้างของซ้ำกับประเภทที่พิมพ์เองไว้แล้ว", async () => {
    const shopId = await shopWithoutDefaults();

    ok(await createCategory(IDLE, fd({ shopId, direction: "out", name: "ค่าแรง", counts: "on" })));
    ok(await addDefaultCategories(IDLE, fd({ shopId })));

    const [{ count }] = await raw`
      select count(*)::int as count from categories where name = 'ค่าแรง' and is_deleted = false`;
    expect(count).toBe(1);
  });

  it("กดซ้ำแล้วไม่ได้ของเพิ่ม", async () => {
    const shopId = await shopWithoutDefaults();

    ok(await addDefaultCategories(IDLE, fd({ shopId })));
    ok(await addDefaultCategories(IDLE, fd({ shopId })));

    const [{ count }] = await raw`select count(*)::int as count from categories`;
    expect(count).toBe(33);
  });
});

/* ------------------------------------------------------------------ */

describe("บัญชี", () => {
  it("บัญชีที่ติ๊กใช้ร่วม ทุกร้านเห็น", async () => {
    const a = await makeShop("ร้านหนึ่ง");
    const b = await makeShop("ร้านสอง");

    ok(
      await createAccount(
        IDLE,
        fd({
          shopId: a,
          name: "กสิกร",
          kind: "bank",
          bank: "",
          accountNo: "",
          openingBalance: "0",
          shared: "on",
        }),
      ),
    );

    const seenByB = await accountsOf(b);
    expect(seenByB.map((r) => r.name)).toContain("กสิกร");
  });

  it("ลบบัญชีแล้วรายการเก่ายังอยู่ครบ", async () => {
    const shopId = await makeShop();
    const [cash] = await accountsOf(shopId);

    ok(
      await createTransaction(
        IDLE,
        entryFormData({ shopId, amount: "60", title: "ขาย", accountId: cash.id }),
      ),
    );

    ok(await deleteAccount(IDLE, fd({ shopId, id: cash.id })));

    const [row] = await raw`select amount, account_id from transactions where not is_deleted`;
    expect(row.amount).toBe("60.00");
    // ยังชี้ไปที่บัญชีเดิม แค่ query ไม่แสดงแล้ว ตามรอยเงินย้อนหลังได้
    expect(row.account_id).toBe(cash.id);
  });
});
