-- ============================================================
--  ปิด REST API อัตโนมัติของ Supabase
-- ============================================================
--
--  Supabase เปิด REST endpoint (PostgREST) ให้ทุกตารางใน schema public
--  โดยอัตโนมัติ ใครก็ตามที่รู้ anon key ของโปรเจกต์จะยิงอ่านตารางได้ตรงๆ
--  ซึ่งแอปนี้ไม่ต้องการเลย เพราะต่อ Postgres ตรงผ่าน DATABASE_URL
--
--  การเปิด row level security โดย "ไม่สร้าง policy สักอัน" ทำให้ PostgREST
--  อ่านอะไรไม่ได้เลย ส่วนแอปยังทำงานปกติเพราะ role ที่อยู่ใน connection string
--  เป็นเจ้าของตาราง ซึ่ง Postgres ยกเว้น RLS ให้อยู่แล้ว
--
--  บน Postgres ที่ลงเองบน VPS คำสั่งพวกนี้ไม่มีผลอะไร รันทิ้งไว้ได้ไม่เสียหาย
--
--  ⚠️ ถ้าวันหนึ่งจะเรียกข้อมูลผ่าน supabase-js จากฝั่ง browser จริงๆ
--     ต้องเขียน policy ก่อน ไม่งั้นจะได้ผลลัพธ์ว่างเปล่าโดยไม่มี error
-- ============================================================

ALTER TABLE "shops"        ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounts"     ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "categories"   ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
