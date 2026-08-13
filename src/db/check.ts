/**
 * ตรวจสุขภาพฐานข้อมูล
 *
 *   npm run db:check
 *
 * ใช้ยืนยันว่าต่อ Supabase (หรือ Postgres ที่ไหนก็ตาม) ติดจริง และ schema
 * ครบถ้วนตรงกับที่โค้ดคาดหวัง ก่อนจะไปเสียเวลาไล่หาสาเหตุในหน้าเว็บ
 *
 * รันได้ทุกเมื่อ ไม่แก้ไขข้อมูลอะไรเลย อ่านอย่างเดียว
 *
 * ไม่ import จาก src/db/index.ts เพราะไฟล์นั้นติด "server-only" ซึ่งตั้งใจ
 * ให้พังเมื่อถูกเรียกนอก React Server Component สคริปต์นี้รันบน Node ตรงๆ
 */
import postgres from "postgres";

const raw = process.env.DATABASE_URL;

if (!raw || raw.includes("REPLACE_ME")) {
  console.error("✗ ยังไม่ได้ตั้ง DATABASE_URL ใน .env.local");
  console.error("  เอามาจาก Supabase → Project Settings → Database → Connection string → URI");
  process.exit(1);
}

// แยกตัวแปรหลังเช็คแล้ว เพื่อให้ TypeScript รู้ว่าไม่ใช่ undefined ตลอดทั้งไฟล์
const url: string = raw;

const port = (() => {
  try {
    return new URL(url).port;
  } catch {
    return "";
  }
})();

const isPooler = port === "6543";

const sql = postgres(url, {
  ssl: process.env.DATABASE_SSL === "0" ? false : "require",
  prepare: !isPooler,
  max: 1,
  connect_timeout: 15,
});

/** ตารางที่ต้องมี พร้อมคอลัมน์ที่โค้ดพึ่งพาจริงๆ */
const EXPECTED: Record<string, string[]> = {
  shops: ["id", "name", "sort_order", "is_active", "is_deleted", "created_at", "updated_at"],
  accounts: [
    "id", "shop_id", "name", "kind", "bank", "account_no", "opening_balance",
    "sort_order", "is_active", "is_deleted", "created_at", "updated_at",
  ],
  categories: [
    "id", "shop_id", "direction", "name", "counts",
    "sort_order", "is_active", "is_deleted", "created_at", "updated_at",
  ],
  transactions: [
    "id", "shop_id", "txn_date", "direction", "category_id", "account_id",
    "title", "amount", "note", "is_deleted", "created_at", "updated_at",
  ],
  transfers: [
    "id", "shop_id", "from_account_id", "to_account_id",
    "txn_date", "amount", "note", "is_deleted", "created_at", "updated_at",
  ],
};

const EXPECTED_CONSTRAINTS = [
  "accounts_kind_check",
  "categories_direction_check",
  "transactions_direction_check",
  "transactions_amount_check",
  "accounts_shop_id_shops_id_fk",
  "categories_shop_id_shops_id_fk",
  "transactions_shop_id_shops_id_fk",
  "transactions_category_id_categories_id_fk",
  "transactions_account_id_accounts_id_fk",
  "transfers_amount_check",
  // กันโอนเข้าบัญชีตัวเอง บังคับที่ระดับฐานข้อมูล ไม่ได้เชื่อฝั่งแอปอย่างเดียว
  "transfers_accounts_differ_check",
  "transfers_shop_id_shops_id_fk",
  "transfers_from_account_id_accounts_id_fk",
  "transfers_to_account_id_accounts_id_fk",
];

let failed = false;

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => {
  console.log(`  ✗ ${msg}`);
  failed = true;
};
const warn = (msg: string) => console.log(`  ! ${msg}`);

async function main() {
  /* ---------- ต่อติดไหม ---------- */
  console.log("\nการเชื่อมต่อ");

  const [{ version }] = await sql<{ version: string }[]>`select version()`;
  const short = version.split(" ").slice(0, 2).join(" ");
  ok(`ต่อติด — ${short}`);

  // pooler ของ Supabase ใช้ทั้งพอร์ต 5432 (session) และ 6543 (transaction)
  // ตัว host ต่างหากที่บอกว่าผ่าน pooler หรือต่อตรง
  const viaPooler = url.includes(".pooler.supabase.com");

  if (isPooler) {
    ok("transaction pooler (6543) — เหมาะกับ Vercel และ serverless");
  } else if (port === "5432" && viaPooler) {
    ok("session pooler (5432) — เหมาะกับเซิร์ฟเวอร์ที่รันค้างไว้ และรองรับ IPv4");
  } else if (port === "5432") {
    ok("ต่อตรง (5432) — เหมาะกับ Postgres ที่ลงเอง");
    if (url.includes(".supabase.co")) {
      warn("direct connection ของ Supabase เป็น IPv6 อย่างเดียว");
      warn("เครื่องที่ไม่มี IPv6 จะต่อไม่ติด ให้ใช้ pooler แทน");
    }
  } else if (port) {
    warn(`พอร์ต ${port} ไม่ใช่ 5432 หรือ 6543 — ตรวจว่าถูกต้องไหม`);
  }

  /* ---------- ตารางกับคอลัมน์ ---------- */
  console.log("\nโครงสร้างตาราง");

  const columns = await sql<{ table_name: string; column_name: string }[]>`
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ${sql(Object.keys(EXPECTED))}
  `;

  for (const [table, expectedCols] of Object.entries(EXPECTED)) {
    const actual = new Set(
      columns.filter((c) => c.table_name === table).map((c) => c.column_name),
    );

    if (actual.size === 0) {
      bad(`ไม่พบตาราง ${table}`);
      continue;
    }

    const missing = expectedCols.filter((c) => !actual.has(c));
    if (missing.length > 0) bad(`${table} — ขาดคอลัมน์: ${missing.join(", ")}`);
    else ok(`${table} — ครบ ${expectedCols.length} คอลัมน์`);
  }

  /* ---------- constraint ---------- */
  console.log("\nกฎกันข้อมูลเสีย");

  const constraints = await sql<{ conname: string }[]>`
    select conname from pg_constraint
     where connamespace = 'public'::regnamespace
  `;

  const names = new Set(constraints.map((c) => c.conname));
  const missingConstraints = EXPECTED_CONSTRAINTS.filter((c) => !names.has(c));

  if (missingConstraints.length > 0) {
    bad(`ขาด constraint: ${missingConstraints.join(", ")}`);
    warn("ถ้าสร้างตารางเองอาจตั้งชื่อไม่ตรง — ใช้ supabase/schema.sql หรือ db:migrate");
  } else {
    ok(`ครบ ${EXPECTED_CONSTRAINTS.length} ตัว (เช็คเงินติดลบ ทิศทาง ชนิดบัญชี และ foreign key)`);
  }

  /* ---------- RLS ---------- */
  console.log("\nการปิด REST API อัตโนมัติของ Supabase");

  const rls = await sql<{ relname: string; relrowsecurity: boolean; policies: number }[]>`
    select c.relname,
           c.relrowsecurity,
           (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ${sql(Object.keys(EXPECTED))}
  `;

  const unprotected = rls.filter((r) => !r.relrowsecurity);
  const withPolicies = rls.filter((r) => r.policies > 0);

  if (unprotected.length > 0) {
    bad(`RLS ยังไม่เปิดที่: ${unprotected.map((r) => r.relname).join(", ")}`);
    warn("ตารางเหล่านี้อ่านได้จากภายนอกด้วย publishable key — รัน drizzle/0001_enable_rls.sql");
  } else {
    // นับจากที่ตรวจจริง ไม่เขียนตัวเลขตายไว้ ไม่งั้นวันที่เพิ่มตารางแล้วลืมแก้
    // ข้อความจะบอกจำนวนผิดทั้งที่ตรวจถูก
    ok(`RLS เปิดครบ ${rls.length} ตาราง`);
  }

  if (withPolicies.length > 0) {
    warn(
      `มี policy อยู่ที่: ${withPolicies.map((r) => r.relname).join(", ")} — ` +
        "แอปนี้ไม่ต้องใช้ ตรวจว่าตั้งใจหรือเปล่า",
    );
  } else if (unprotected.length === 0) {
    ok("ไม่มี policy — PostgREST อ่านอะไรไม่ได้เลย ตามที่ออกแบบไว้");
  }

  /* ---------- ข้อมูล ---------- */
  console.log("\nข้อมูล");

  const [counts] = await sql<
    { shops: number; accounts: number; categories: number; transactions: number; deleted: number }[]
  >`
    select (select count(*)::int from shops where is_deleted = false)        as shops,
           (select count(*)::int from accounts where is_deleted = false)     as accounts,
           (select count(*)::int from categories where is_deleted = false)   as categories,
           (select count(*)::int from transactions where is_deleted = false) as transactions,
           (select count(*)::int from transactions where is_deleted = true)  as deleted
  `;

  ok(
    `ร้าน ${counts.shops} · บัญชี ${counts.accounts} · ` +
      `ประเภท ${counts.categories} · รายการ ${counts.transactions}`,
  );

  if (counts.deleted > 0) ok(`รายการที่ลบไปแล้วแต่ยังกู้ได้ ${counts.deleted} รายการ`);

  if (counts.shops === 0) {
    warn("ยังไม่มีร้าน — รัน `npm run db:seed` หรือเพิ่มร้านแรกจากหน้าเลือกร้าน");
  }
  if (counts.categories === 0) {
    warn("ยังไม่มีประเภท — รัน `npm run db:seed` เพื่อใส่ชุดตั้งต้น");
  }

  /* ---------- สรุป ---------- */
  console.log(
    failed
      ? "\n✗ ฐานข้อมูลยังไม่พร้อม แก้ตามที่แจ้งข้างบนแล้วรันใหม่\n"
      : "\n✓ ฐานข้อมูลพร้อมใช้งาน\n",
  );
}

main()
  .catch((error: unknown) => {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);

    console.error(`\n✗ ต่อฐานข้อมูลไม่ได้: ${message}\n`);

    // แปล error ที่เจอบ่อยเป็นภาษาที่บอกได้ว่าต้องไปแก้ตรงไหน
    if (message.includes("password authentication failed")) {
      console.error("  รหัสผ่านใน DATABASE_URL ไม่ถูก");
      console.error("  Supabase → Project Settings → Database → Reset database password");
    } else if (message.includes("ENOTFOUND") || message.includes("EAI_AGAIN")) {
      console.error("  หาโฮสต์ไม่เจอ — ตรวจว่าคัดลอก URI มาครบและเน็ตใช้ได้");
    } else if (message.includes("ETIMEDOUT") || message.includes("ECONNREFUSED")) {
      console.error("  ต่อไม่ติด — ถ้าอยู่บนแชร์โฮสติ้ง อาจโดนบล็อก outbound พอร์ตนี้");
    } else if (message.toLowerCase().includes("ssl")) {
      console.error("  ปัญหา SSL — Supabase ต้องใช้ DATABASE_SSL=1 ส่วน Postgres ในเครื่องใช้ 0");
    }
  })
  .finally(async () => {
    await sql.end();
    process.exitCode = failed ? 1 : 0;
  });
