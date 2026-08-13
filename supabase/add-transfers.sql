-- ============================================================
--  เพิ่มตาราง transfers — สำหรับฐานข้อมูลที่สร้างไว้ก่อนหน้านี้
-- ============================================================
--
--  วิธีใช้  Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run
--
--  รันซ้ำได้ปลอดภัย ทุกคำสั่งมี if not exists
--  ไม่แตะข้อมูลเดิมเลยแม้แต่แถวเดียว มีแต่เพิ่มตารางใหม่
--
--  ถ้าเป็นฐานข้อมูลที่สร้างใหม่จาก supabase/schema.sql อยู่แล้ว ไม่ต้องรันไฟล์นี้
--  เพราะตารางนี้อยู่ในไฟล์นั้นแล้ว
-- ============================================================

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

create index if not exists idx_transfers_shop_date on transfers using btree (shop_id, is_deleted, txn_date desc nulls last);
create index if not exists idx_transfers_from      on transfers using btree (from_account_id, is_deleted);
create index if not exists idx_transfers_to        on transfers using btree (to_account_id, is_deleted);

-- ปิด REST API อัตโนมัติของ Supabase เหมือนอีกสี่ตาราง
-- เปิด RLS โดยไม่สร้าง policy = PostgREST อ่านอะไรไม่ได้เลย
alter table transfers enable row level security;
