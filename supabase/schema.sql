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

-- ---------- การโอนเงินระหว่างบัญชี ----------
-- เก็บเป็น "แถวเดียวต่อการโอนหนึ่งครั้ง" ไม่ใช่รายการสองแถว
--
-- เหตุผล การโอนไม่ใช่รายรับและไม่ใช่รายจ่าย เงินไม่ได้เพิ่มหรือลด แค่ย้ายที่
-- ถ้าเก็บปนใน transactions มันต้องแกล้งเป็นรายรับก้อนหนึ่งกับรายจ่ายอีกก้อน
-- ที่หักล้างกันพอดี ซึ่งทำให้ยอดขายและยอดรายจ่ายพองขึ้นทั้งคู่
-- และเปิดช่องให้ลบหรือแก้ขาเดียวจนเงินงอกจากอากาศ
--
-- แถวเดียวมีจำนวนเงินตัวเดียว จึงไม่มีสิ่งที่เรียกว่า "สองขาไม่ตรงกัน"
--
-- ⚠️ query ที่คิดกำไรต้องไม่แตะตารางนี้ ส่วน query ที่คิดยอดคงเหลือ
--    ต้องรวมตารางนี้เสมอ ลืมเมื่อไหร่ยอดจะไม่ตรงกับแอปธนาคาร
--
-- on delete restrict ที่ foreign key ของบัญชี ไม่ใช่ set null
-- เพราะการโอนที่ไม่รู้ว่าเงินมาจากไหนหรือไปไหน ไม่มีความหมายเลย
-- (การลบบัญชีในแอปเป็นการตั้งธง is_deleted ไม่ได้ลบแถวจริง จึงไม่ติดข้อนี้)
create table if not exists transfers (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null,
  from_account_id uuid not null,
  to_account_id   uuid not null,
  txn_date        date not null,
  amount          numeric(12, 2) not null,
  note            text,
  is_deleted      boolean not null default false,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now(),
  constraint transfers_amount_check          check (amount > 0),
  constraint transfers_accounts_differ_check check (from_account_id <> to_account_id),
  constraint transfers_shop_id_shops_id_fk
    foreign key (shop_id) references shops(id) on delete cascade,
  constraint transfers_from_account_id_accounts_id_fk
    foreign key (from_account_id) references accounts(id) on delete restrict,
  constraint transfers_to_account_id_accounts_id_fk
    foreign key (to_account_id) references accounts(id) on delete restrict
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
-- ⚠️ เขียน desc เฉยๆ ห้ามใส่ nulls last
--    `order by x desc` ของ Postgres หมายถึง nulls first ถ้าดัชนีเป็น nulls last
--    มันจะใช้เรียงลำดับไม่ได้ แล้วกลับไป Seq Scan ทั้งตารางแบบเงียบๆ
--    วัดที่ 22,000 แถว — nulls last 8.6ms เทียบกับ 0.09ms ต่างกัน 90 เท่า
--    คอลัมน์พวกนี้เป็น not null อยู่แล้ว จึงไม่มีผลต่อความหมาย

create index if not exists idx_txn_shop_date on transactions using btree (shop_id, is_deleted, txn_date desc);
create index if not exists idx_txn_account   on transactions using btree (account_id, is_deleted);
create index if not exists idx_txn_category  on transactions using btree (category_id, is_deleted);

-- เรียงตามเวลาที่กดบันทึก ไม่ใช่วันของรายการ — ใช้ที่ลิสต์ "เพิ่งบันทึกไป"
-- ใต้ฟอร์ม ซึ่งอยู่บนหน้าที่เปิดบ่อยที่สุดของแอป
create index if not exists idx_txn_shop_created on transactions using btree (shop_id, is_deleted, created_at desc);

-- การโอนถูกอ่านสองแบบ คือทั้งร้าน (หน้ารายการโอน) และรายบัญชี (หน้าเคลื่อนไหว)
-- จึงต้องมีดัชนีของทั้งขาต้นทางและขาปลายทางแยกกัน
create index if not exists idx_transfers_shop_date on transfers using btree (shop_id, is_deleted, txn_date desc);
create index if not exists idx_transfers_from      on transfers using btree (from_account_id, is_deleted);
create index if not exists idx_transfers_to        on transfers using btree (to_account_id, is_deleted);

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
alter table transfers    enable row level security;

-- ============================================================
--  ข้อมูลตั้งต้น — ไม่มีในไฟล์นี้โดยตั้งใจ
-- ============================================================
--
--  แอปใส่ให้เองตอนเพิ่มร้านแรกจากหน้าเลือกร้าน (ดู createShop)
--  โดยอ่านจาก src/db/defaults.ts ซึ่งเป็นแหล่งความจริงแหล่งเดียว
--
--  เดิมไฟล์นี้มีบล็อกใส่ข้อมูลตั้งต้นของตัวเอง แล้วมันค่อยๆ ไม่ตรงกับ
--  defaults.ts จนกลายเป็นคนละชุดกัน (2 บัญชี 15 ประเภท เทียบกับ
--  1 บัญชี 31 ประเภท) ร้านที่ตั้งจากไฟล์นี้กับร้านที่ตั้งจากในแอป
--  จึงได้ของไม่เท่ากันโดยไม่มีใครสังเกต — ตัดทิ้งแล้วให้เหลือทางเดียว
-- ============================================================

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
