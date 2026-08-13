-- ============================================================
--  อัปเดตฐานข้อมูลที่มีอยู่แล้ว ให้ตรงกับโค้ดล่าสุด
-- ============================================================
--
--  วิธีใช้  Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run
--
--  ⚠️ ไฟล์เดียวสำหรับทุกการอัปเดต ไม่ต้องไล่ดูว่าเคยรันอันไหนไปแล้ว
--     ทุกคำสั่งมี if not exists จึงรันซ้ำได้เสมอ รันสิบรอบก็ได้ผลเท่ากับรอบเดียว
--     และไม่แตะข้อมูลเดิมเลยแม้แต่แถวเดียว มีแต่เพิ่มตารางกับดัชนี
--
--  ฐานข้อมูลที่สร้างใหม่จาก supabase/schema.sql มีทุกอย่างนี้อยู่แล้ว
--  ไม่ต้องรันไฟล์นี้
-- ============================================================

-- ------------------------------------------------------------
--  การโอนเงินระหว่างบัญชี
-- ------------------------------------------------------------
--  เก็บเป็นแถวเดียวต่อการโอนหนึ่งครั้ง ไม่ใช่รายการสองแถวที่หักล้างกัน
--  จึงไม่มีสิ่งที่เรียกว่า "สองขาไม่ตรงกัน" ให้เกิดขึ้นได้
--
--  ⚠️ query ที่คิดกำไรต้องไม่แตะตารางนี้
--     ส่วน query ที่คิดยอดคงเหลือต้องรวมตารางนี้เสมอ
-- ------------------------------------------------------------

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

create index if not exists idx_transfers_from on transfers using btree (from_account_id, is_deleted);
create index if not exists idx_transfers_to   on transfers using btree (to_account_id, is_deleted);

-- ปิด REST API อัตโนมัติของ Supabase เหมือนอีกสี่ตาราง
-- เปิด RLS โดยไม่สร้าง policy = PostgREST อ่านอะไรไม่ได้เลย
alter table transfers enable row level security;

-- ------------------------------------------------------------
--  ดัชนีที่เรียงลำดับได้จริง
-- ------------------------------------------------------------
--  ⚠️ ดัชนีชุดเดิมสร้างไว้เป็น `desc nulls last` ซึ่ง Postgres ใช้เรียงลำดับ
--     ให้ `order by x desc` ไม่ได้ (desc ของ Postgres หมายถึง nulls first)
--     ผลคือมันกลับไป Seq Scan ทั้งตารางแบบเงียบๆ ทั้งที่ดูผ่านๆ เหมือนมีดัชนีแล้ว
--
--     วัดที่ 22,000 แถว — nulls last 8.6ms เทียบกับ 0.09ms ต่างกัน 90 เท่า
--
--     ต้อง drop แล้วสร้างใหม่ ใช้ if exists / if not exists จึงรันซ้ำได้ปลอดภัย
--     คอลัมน์ทุกตัวเป็น not null อยู่แล้ว การทิ้ง nulls last ไม่เปลี่ยนความหมาย
--
--  ตารางของร้านมีไม่กี่พันแถว การสร้างดัชนีใหม่จึงเสร็จในพริบตา
-- ------------------------------------------------------------

drop index if exists idx_txn_shop_date;
drop index if exists idx_txn_shop_created;
drop index if exists idx_transfers_shop_date;

create index if not exists idx_txn_shop_date       on transactions using btree (shop_id, is_deleted, txn_date desc);
create index if not exists idx_txn_shop_created    on transactions using btree (shop_id, is_deleted, created_at desc);
create index if not exists idx_transfers_shop_date on transfers     using btree (shop_id, is_deleted, txn_date desc);
