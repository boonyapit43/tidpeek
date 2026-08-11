-- ============================================================
--  บัญชีร้าน — schema สำหรับวางใน Supabase SQL Editor
-- ============================================================
--
--  วิธีใช้
--    1. เปิด Supabase → SQL Editor → New query
--    2. วางไฟล์นี้ทั้งไฟล์ แล้วกด Run
--    3. เอา connection string จาก Project Settings → Database →
--       Connection string → URI มาใส่ DATABASE_URL ใน .env.local
--       (เอา URI ไม่ใช่ anon key และไม่ใช่ service_role key)
--
--  รันซ้ำได้ปลอดภัย ตารางที่มีอยู่แล้วจะถูกข้าม และข้อมูลตั้งต้นจะไม่ใส่ซ้ำ
--
--  ⚠️ ถ้าใช้ไฟล์นี้สร้างตาราง ให้ใช้ `npm run db:push` เวลาจะแก้ schema
--     ทีหลัง ไม่ใช่ `npm run db:migrate`
--     เพราะ db:migrate ไล่รันไฟล์ใน drizzle/ ตามลำดับโดยดูจากตารางบันทึก
--     ของตัวเอง ซึ่งไฟล์นี้ไม่ได้เขียนลงไป มันจึงจะพยายามสร้างตารางซ้ำ
--     ส่วน db:push เทียบ schema กับฐานข้อมูลจริงแล้วแก้เฉพาะส่วนต่าง
--
--     อีกทางคือไม่ต้องใช้ไฟล์นี้เลย ตั้ง DATABASE_URL แล้วสั่ง
--     `npm run db:migrate && npm run db:seed` ซึ่งได้ผลเหมือนกันทุกอย่าง
-- ============================================================

-- gen_random_uuid() เป็นฟังก์ชันในตัวตั้งแต่ Postgres 13 (Supabase ใหม่กว่านั้น)
-- บรรทัดนี้มีไว้เผื่อย้ายไป Postgres รุ่นเก่ากว่านั้นบน VPS
create extension if not exists pgcrypto;

-- ============================================================
--  ตาราง
-- ============================================================
--
--  ทุกตารางมีสามคอลัมน์นี้เหมือนกันหมด
--
--    is_deleted   ลบแบบไม่ลบจริง ทุก query กรอง is_deleted = false ออกไป
--                 ข้อมูลยังอยู่ในฐานครบ กู้กลับได้ด้วย SQL บรรทัดเดียว
--                 ในระบบบัญชี การลบแถวออกจริงคือการทำลายหลักฐาน
--                 และรายการที่อ้างถึงแถวนั้นจะกลายเป็นเด็กกำพร้าทันที
--
--    created_at   แถวนี้เกิดเมื่อไหร่
--    updated_at   ถูกแตะครั้งสุดท้ายเมื่อไหร่ (รวมถึงตอนถูกลบ)
--
--  ส่วน is_active เป็นคนละเรื่องกับ is_deleted
--    is_active = false  คือปิดใช้งานชั่วคราว ยังเห็นในหน้าตั้งค่า เปิดกลับได้
--    is_deleted = true  คือลบแล้ว หายไปจากทุกที่
-- ============================================================

-- ---------- ร้าน ----------
create table if not exists shops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- ---------- บัญชี / ช่องทางเงิน ----------
-- shop_id ว่าง = บัญชีกลาง ทุกร้านใช้ร่วมกัน (เช่นบัญชีธนาคารใบเดียวใช้สองร้าน)
-- shop_id มีค่า = บัญชีของร้านนั้นร้านเดียว
--
-- opening_balance เป็นของ "บัญชี" ไม่ใช่ของ "ร้าน" ห้ามนับซ้ำระดับร้าน
-- ไม่งั้นสองร้านที่ใช้บัญชีร่วมกันจะเห็นยอดตั้งต้นคนละใบ
-- ชื่อ constraint ทุกตัวตั้งให้ตรงกับที่ drizzle-kit สร้างเป๊ะๆ
-- เพื่อให้ `npm run db:push` กับฐานที่สร้างจากไฟล์นี้ไม่เห็นความต่าง
-- ถ้าปล่อยให้ Postgres ตั้งชื่อเอง (xxx_fkey) drizzle จะพยายามรื้อสร้างใหม่
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid,
  name            text not null,
  kind            text not null default 'bank',
  bank            text,
  account_no      text,
  opening_balance numeric(12, 2) not null default '0',
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  is_deleted      boolean not null default false,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now(),
  constraint accounts_kind_check check (kind in ('cash', 'bank', 'ewallet')),
  constraint accounts_shop_id_shops_id_fk
    foreign key (shop_id) references shops(id) on delete cascade
);

-- ---------- ประเภทรายรับรายจ่าย ----------
-- counts = false คือเงินที่เข้าออกจริงแต่ไม่ใช่กำไรหรือขาดทุนของร้าน
--          เช่น เติมทุน เงินกู้ ถอนใช้ส่วนตัว โอนย้ายบัญชี
--
-- ⚠️ กฎเหล็ก: ธงนี้ใช้กรองตอน "คิดกำไร" เท่านั้น
--    ห้ามใช้กรองตอน "คิดยอดคงเหลือของบัญชี" เด็ดขาด
--    ไม่งั้นยอดในแอปจะไม่ตรงกับยอดในแอปธนาคาร
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid,
  direction  text not null,
  name       text not null,
  counts     boolean not null default true,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint categories_direction_check check (direction in ('in', 'out')),
  constraint categories_shop_id_shops_id_fk
    foreign key (shop_id) references shops(id) on delete cascade
);

-- ---------- รายการเคลื่อนไหว ----------
-- amount เก็บเป็นค่าบวกเสมอ ทิศทางเงินอยู่ที่คอลัมน์ direction
--
-- txn_date เป็นชนิด date ล้วน ไม่มีเวลาและไม่มี timezone
-- จึงไม่มีทางเลื่อนไปวันอื่นไม่ว่าเซิร์ฟเวอร์จะตั้งเวลาไว้เป็นอะไร
-- ส่วน created_at เป็น timestamptz เพราะเป็นเวลาที่กดบันทึกจริง
-- ไม่ใช่วันของรายการ สองอย่างนี้ต่างกันและต้องใช้ชนิดต่างกัน
create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null,
  txn_date    date not null,
  direction   text not null,
  category_id uuid,
  account_id  uuid,
  title       text not null,
  amount      numeric(12, 2) not null,
  note        text,
  is_deleted  boolean not null default false,
  created_at  timestamp with time zone not null default now(),
  updated_at  timestamp with time zone not null default now(),
  constraint transactions_direction_check check (direction in ('in', 'out')),
  constraint transactions_amount_check    check (amount >= 0),
  constraint transactions_shop_id_shops_id_fk
    foreign key (shop_id) references shops(id) on delete cascade,
  constraint transactions_category_id_categories_id_fk
    foreign key (category_id) references categories(id) on delete set null,
  constraint transactions_account_id_accounts_id_fk
    foreign key (account_id) references accounts(id) on delete set null
);

-- ============================================================
--  ดัชนี
-- ============================================================
--  ใส่ is_deleted ไว้ในดัชนีด้วย เพราะทุก query กรองด้วยคอลัมน์นี้เสมอ
--  ถ้าไม่ใส่ Postgres จะต้องอ่านแถวที่ลบไปแล้วขึ้นมาก่อนแล้วค่อยทิ้ง
-- ============================================================

create index if not exists idx_accounts_shop   on accounts   using btree (shop_id, is_deleted);
create index if not exists idx_categories_shop on categories using btree (shop_id, is_deleted);
create index if not exists idx_shops_live      on shops      using btree (is_deleted, sort_order);

-- ดัชนีหลักที่ทุกหน้าใช้ — กรองร้าน ตัดของที่ลบแล้ว เรียงวันใหม่สุดขึ้นก่อน
create index if not exists idx_txn_shop_date on transactions using btree (shop_id, is_deleted, txn_date desc nulls last);
create index if not exists idx_txn_account   on transactions using btree (account_id, is_deleted);
create index if not exists idx_txn_category  on transactions using btree (category_id, is_deleted);

-- ============================================================
--  ปิด REST API อัตโนมัติของ Supabase
-- ============================================================
--
--  Supabase เปิด REST endpoint (PostgREST) ให้ทุกตารางใน schema public
--  โดยอัตโนมัติ ใครที่รู้ anon key จะยิงอ่านตารางได้ตรงๆ ซึ่งแอปนี้ไม่ต้องการ
--  เพราะต่อ Postgres ตรงผ่าน DATABASE_URL
--
--  การเปิด row level security โดย "ไม่สร้าง policy สักอัน" ทำให้ PostgREST
--  อ่านอะไรไม่ได้เลย ส่วนแอปยังทำงานปกติเพราะ role ใน connection string
--  เป็นเจ้าของตาราง ซึ่ง Postgres ยกเว้น RLS ให้อยู่แล้ว
--
--  ⚠️ ถ้าวันหนึ่งจะเรียกข้อมูลผ่าน supabase-js จากฝั่ง browser
--     ต้องเขียน policy ก่อน ไม่งั้นจะได้ผลลัพธ์ว่างเปล่าโดยไม่มี error
-- ============================================================

alter table shops        enable row level security;
alter table accounts     enable row level security;
alter table categories   enable row level security;
alter table transactions enable row level security;

-- ============================================================
--  ข้อมูลตั้งต้น
-- ============================================================
--  ทั้งบล็อกทำงานเฉพาะตอนที่ยังไม่มีร้านในระบบ รันซ้ำจึงไม่เกิดข้อมูลซ้ำ
-- ============================================================

do $$
begin
  if exists (select 1 from shops) then
    raise notice 'มีข้อมูลอยู่แล้ว ข้ามการใส่ข้อมูลตั้งต้น';
    return;
  end if;

  insert into shops (name, sort_order) values ('ร้านหลัก', 1);

  -- บัญชีกลาง shop_id เป็น null จึงใช้ได้ทุกร้าน
  -- ยอดตั้งต้นเป็น 0 ไว้ก่อน ไปแก้ให้ตรงกับยอดจริงที่หน้าตั้งค่าในแอป
  insert into accounts (shop_id, name, kind, opening_balance, sort_order) values
    (null, 'เงินสดหน้าร้าน', 'cash', 0, 1),
    (null, 'บัญชีธนาคาร',   'bank', 0, 2);

  -- ประเภทชุดกลาง shop_id เป็น null จึงเห็นเหมือนกันทุกร้าน
  insert into categories (shop_id, direction, name, counts, sort_order) values
    -- ฝั่งรับ ที่นับเป็นรายได้
    (null, 'in',  'ขายหน้าร้าน',            true,  1),
    (null, 'in',  'ขายออนไลน์',             true,  2),
    (null, 'in',  'ค่าส่งที่เก็บจากลูกค้า', true,  3),
    (null, 'in',  'รายได้อื่น',             true,  4),
    -- ฝั่งรับ ที่เงินเข้าจริงแต่ไม่ใช่กำไร
    (null, 'in',  'เติมทุน',                false, 5),
    (null, 'in',  'เงินกู้',                false, 6),
    (null, 'in',  'รับเงินคืน',             false, 7),

    -- ฝั่งจ่าย ที่นับเป็นรายจ่าย
    (null, 'out', 'ซื้อของเข้าร้าน',        true,  1),
    (null, 'out', 'ค่าแรง',                 true,  2),
    (null, 'out', 'ค่าส่ง',                 true,  3),
    (null, 'out', 'ค่าน้ำค่าไฟ',            true,  4),
    (null, 'out', 'ของใช้ในร้าน',           true,  5),
    -- ฝั่งจ่าย ที่เงินออกจริงแต่ไม่ใช่ขาดทุน
    (null, 'out', 'ถอนใช้ส่วนตัว',          false, 6),
    (null, 'out', 'โอนย้ายบัญชี',           false, 7),
    (null, 'out', 'ยืมข้ามร้าน',            false, 8);

  raise notice 'ใส่ข้อมูลตั้งต้นแล้ว: 1 ร้าน, 2 บัญชี, 15 ประเภท';
end $$;

-- ============================================================
--  กู้ของที่ลบไปแล้ว
-- ============================================================
--  ดูรายการที่ถูกลบของร้านหนึ่ง
--    select id, txn_date, title, amount, updated_at
--      from transactions where is_deleted = true order by updated_at desc;
--
--  กู้กลับ
--    update transactions set is_deleted = false, updated_at = now()
--     where id = 'ใส่ id ที่ได้จากด้านบน';
-- ============================================================
