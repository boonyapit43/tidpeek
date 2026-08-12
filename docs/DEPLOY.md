# การติดตั้งและย้ายโฮสต์

---

## 1. เริ่มที่เครื่องตัวเอง

```bash
npm install
cp .env.example .env.local
```

เปิด `.env.local` แล้วเติมสี่ค่า

| ตัวแปร | เอามาจากไหน |
|---|---|
| `DATABASE_URL` | Supabase → **Project Settings → Database → Connection string → URI** (ไม่ใช่ API key) |
| `DATABASE_SSL` | `1` สำหรับ Supabase · `0` สำหรับ Postgres ที่ลงเองบนเครื่องเดียวกัน |
| `APP_PIN` | ตั้งเอง แนะนำ 6 หลักขึ้นไป |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

แล้วสร้างตารางกับใส่ข้อมูลตั้งต้น

```bash
npm run db:migrate && npm run db:seed && npm run dev
```

### อยากลองบนเครื่องโดยไม่ต้องมี Supabase

ถ้ามี Docker อยู่แล้ว รันฐานข้อมูลบนเครื่องได้เลย

```bash
docker run -d --name ledger-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=ledger -p 55432:5432 postgres:16
```

แล้วตั้งใน `.env.local`

```
DATABASE_URL=postgresql://postgres:dev@localhost:55432/ledger
DATABASE_SSL=0
```

แล้วตรวจว่าต่อติดและ schema ครบ

```bash
npm run db:check
```

### ⚠️ อย่าใช้ direct connection ของ Supabase

`db.<project-ref>.supabase.co` มีแต่ **IPv6 (AAAA record) ไม่มี IPv4** ตั้งแต่ปี 2024 เครื่องหรือโฮสต์ที่ไม่มี IPv6 จะต่อไม่ติดโดยขึ้น `ENOTFOUND` ซึ่งดูเหมือนพิมพ์ชื่อโฮสต์ผิด

ให้ใช้ **pooler** แทน หน้าตาแบบนี้

```
postgresql://postgres.<project-ref>:<รหัส>@aws-0-<region>.pooler.supabase.com:<port>/postgres
```

สังเกตว่าชื่อผู้ใช้เปลี่ยนจาก `postgres` เป็น `postgres.<project-ref>` ด้วย

| พอร์ต | ชื่อ | ใช้เมื่อ |
|---|---|---|
| **5432** | Session pooler | เซิร์ฟเวอร์ที่รันค้างไว้ — dev บนเครื่อง, VPS, DirectAdmin |
| **6543** | Transaction pooler | serverless — Vercel |

ถ้าใช้ 5432 บน Vercel connection จะหมดภายในไม่กี่นาทีแล้วแอปล่ม ส่วน 6543 ไม่รองรับ prepared statement โค้ดตรวจพอร์ตให้อัตโนมัติแล้ว (`src/db/index.ts`)

หา URI ทั้งสองแบบได้ที่ **Project Settings → Database → Connection pooling**

### รหัสผ่านที่มีอักขระพิเศษ

ถ้ารหัสผ่านมี `$ & @ # / ? :` ต้อง percent-encode ก่อนใส่ใน URI

```
$ → %24    & → %26    @ → %40    # → %23
```

ถ้าไม่ encode ตัวแยกวิเคราะห์ URL จะตัดรหัสผ่านกลางคัน แล้วขึ้น error ว่า `password authentication failed` ซึ่งชวนให้เข้าใจผิดว่ารหัสผิด ทั้งที่รหัสถูกแต่ถูกตัดครึ่ง

---

## 2. Vercel

### ก่อนตัดสินใจ — เรื่องแพ็กเกจ

เอกสาร [Fair Use ของ Vercel](https://vercel.com/docs/limits/fair-use-guidelines) เขียนไว้ตรงๆ ว่า

> **Hobby teams are restricted to non-commercial personal use only.** All commercial usage requires either a Pro or Enterprise plan.

นิยามของเชิงพาณิชย์คือ *"deployment ที่ใช้เพื่อผลประโยชน์ทางการเงินของใครก็ตามที่เกี่ยวข้องกับการผลิตโปรเจกต์"*

ตัวอย่างที่เขาแจกแจงไว้ (รับชำระเงินจากผู้เข้าชม, โฆษณาขายของ, รับจ้างทำเว็บ, affiliate, ติด AdSense) **ไม่มีข้อไหนตรงกับแอปบัญชีที่ใช้ภายในร้าน** แต่นิยามกว้างๆ ข้างบนตีความให้ครอบคลุมได้ เพราะแอปนี้ใช้บริหารเงินของกิจการ

เอกสารเขาบอกเองว่าถ้าไม่แน่ใจให้ถามฝ่ายสนับสนุน — **ควรถามก่อนใช้ Hobby ระยะยาว** ส่วน Pro อยู่ที่ราว **$20/เดือน (~฿8,600/ปี)** เทียบกับ HostNeverDie ที่ **฿999/ปี**

### ⚠️ จุดตายที่ต้องตั้งให้ถูก — region

Vercel รัน function ที่ **`iad1` (วอชิงตัน ดีซี) เป็นค่าเริ่มต้นของทุกโปรเจกต์ใหม่** ส่วนฐานข้อมูลเราอยู่มุมไบ ถ้าปล่อยไว้ทุก query จะวิ่งข้ามโลกไปกลับ

ไฟล์ [vercel.json](../vercel.json) ตั้งไว้ให้แล้ว

```json
{ "regions": ["bom1"] }
```

`bom1` = `ap-south-1` = มุมไบ **ตรงกับ region ของ Supabase พอดี** เอกสาร Vercel เขียนเองว่า *"Functions should be executed in the same region as your database"*

| ถ้าตั้ง | function ↔ ฐานข้อมูล | ผู้ใช้ในไทย ↔ function |
|---|---|---|
| `iad1` (ค่าเริ่มต้น — **ผิด**) | ดีซี ↔ มุมไบ ~250 ms | ~250 ms |
| `bom1` (ตั้งไว้แล้ว) | ~1 ms | ~120 ms |
| `sin1` + ย้าย Supabase ไปสิงคโปร์ | ~1 ms | **~30 ms** |

ทุกหน้าของแอปเป็น server-rendered คนใช้จึงรอ function ทุกครั้งที่กด แถวสุดท้ายคือทางที่เร็วที่สุด แต่ต้องสร้างโปรเจกต์ Supabase ใหม่ (เปลี่ยน region ของโปรเจกต์เดิมไม่ได้)

> Hobby เลือกได้ **region เดียว** ซึ่งพอสำหรับแอปนี้

### ขั้นตอน

1. push ขึ้น GitHub แล้ว **Import** ที่ Vercel — ไม่ต้องตั้ง build command เอง Next.js ถูกตรวจจับอัตโนมัติ
2. ใส่ env สี่ตัวใน **Settings → Environment Variables**

   | ตัวแปร | ค่า |
   |---|---|
   | `DATABASE_URL` | **พอร์ต 6543** (transaction pooler) — สำคัญ ดูข้างล่าง |
   | `DATABASE_SSL` | `1` |
   | `APP_PIN` | รหัสที่ตั้งเอง |
   | `AUTH_SECRET` | สุ่มใหม่ ไม่ใช้ตัวเดียวกับเครื่อง dev |

3. Deploy แล้วเปิด `/api/export` เช็คว่าต่อฐานข้อมูลติด

**ต้องใช้พอร์ต 6543 เท่านั้นบน Vercel** เพราะแต่ละ request เกิดบน instance ใหม่ ถ้าใช้ session pooler (5432) connection จะค้างสะสมจนเต็มภายในไม่กี่นาที โค้ดตรวจพอร์ตให้เองแล้ว (`src/db/index.ts`) — เจอ 6543 จะปิด prepared statement ให้อัตโนมัติ เพราะ pgBouncer โหมด transaction ไม่รองรับ

### สิ่งที่ทำงานต่างไปบน Vercel

| เรื่อง | ผลกระทบ |
|---|---|
| `output: "standalone"` | ปิดอัตโนมัติเมื่อเจอตัวแปร `VERCEL` — Vercel แพ็กผลลัพธ์ด้วยวิธีของตัวเอง ([next.config.ts](../next.config.ts)) |
| ตัวนับ PIN ผิด | เก็บในหน่วยความจำของ instance แต่ละตัว บน serverless จึงหลวมกว่าที่ตั้งไว้ ถ้าต้องการของจริงจังให้ย้ายไปเก็บใน Postgres |
| `X-Forwarded-For` | Vercel ส่งมาให้ถูกต้องอยู่แล้ว ตัวนับจึงแยกตาม IP ได้จริง |
| Cookie `secure` | เปิดเองเพราะ `NODE_ENV=production` และ Vercel เป็น HTTPS เสมอ |

### โควตา Hobby (ต่อเดือน)

Fast Data Transfer 100 GB · Function Invocations 1M · Active CPU 4 ชม.

แอปบัญชีร้านที่มีคนใช้ไม่กี่คนใช้ไม่ถึงเศษเสี้ยวของนี้ ข้อจำกัดจริงคือเรื่องเชิงพาณิชย์ข้างบน ไม่ใช่โควตา

---

## 3. HostNeverDie แบบ Web Hosting (DirectAdmin)

**ถามซัพพอร์ตให้ได้คำตอบก่อนซื้อ 2 ข้อ**

1. *"Node.js Selector ของแพลนนี้มีเวอร์ชันอะไรให้เลือกบ้าง มี 20 หรือ 22 ไหม"*
   Next.js 16 **ต้องการ Node 20 ขึ้นไป** เอกสารของ HostNeverDie ยังเขียนว่า "14 ขึ้นไป" และตัวอย่างเป็น 14.18.3 ซึ่งเป็นเอกสารเก่า ถ้าได้สูงสุดต่ำกว่า 20 ต้องไปข้อ 4
2. *"เปิด outbound connection พอร์ต 5432 กับ 6543 ให้ไหม"*
   แอปต่อ Supabase ออกไปข้างนอก แชร์โฮสติ้งบางเจ้าบล็อกขาออก

> แชร์โฮสติ้งของ HostNeverDie มีแต่ **MySQL/MariaDB ไม่มี PostgreSQL** — ไม่เป็นปัญหา เพราะฐานข้อมูลอยู่ที่ Supabase ไม่ได้อยู่บนโฮสต์

### ขั้นตอน

**ต้อง build ที่เครื่องตัวเอง ห้าม build บนโฮสต์** เพราะ CloudLinux จำกัด RAM ต่อ account แล้ว `next build` มักถูกฆ่ากลางคัน

```bash
npm run build && npm run pack
```

1. อัปโหลดทุกอย่างในโฟลเดอร์ `deploy/` ผ่าน File Manager หรือ FTP
2. สร้างไฟล์ `.env` ไว้ในโฟลเดอร์เดียวกับ `server.js` ใส่ env สี่ตัว (ใช้ **พอร์ต 5432** เพราะ Passenger รันค้างไว้)
3. DirectAdmin → **Advanced Features → Setup Node.js App** → CREATE APPLICATION
   - Application root = โฟลเดอร์ที่อัปโหลด
   - Application startup file = `server.js`
   - Node.js version = 20 ขึ้นไป
   - Application mode = Production
4. กด CREATE แล้ว START

Passenger จัดการพอร์ตและการรีสตาร์ทให้เอง ไม่ต้องตั้ง reverse proxy

**ถ้าแอปจะอยู่ใต้ path ย่อย** เช่น `example.com/ledger` ต้อง build ใหม่โดยตั้ง `BASE_PATH` ก่อน

```bash
BASE_PATH=/ledger npm run build && npm run pack
```

ค่านี้ถูกฝังตอน build ไม่ใช่ตอน runtime — เปลี่ยนทีต้อง build ใหม่ทุกครั้ง

**การอัปเดตครั้งถัดไป** — build + pack ที่เครื่อง อัปโหลดทับ (เก็บไฟล์ `.env` ไว้) แล้วกด RESTART

---

## 4. VPS

```bash
npm ci && npm run build
pm2 start ecosystem.config.js && pm2 save && pm2 startup
sudo cp deploy-nginx.conf.example /etc/nginx/sites-available/shop-ledger
sudo ln -s /etc/nginx/sites-available/shop-ledger /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ledger.example.com
```

ลง Postgres ไว้เครื่องเดียวกันได้เลย ตั้ง `DATABASE_SSL=0` แล้วเลิกพึ่ง Supabase

VPS ของ HostNeverDie เริ่มที่ ฿999/**เดือน** ส่วนแชร์โฮสติ้ง ฿999/**ปี** — ต่างกัน 12 เท่า เลือกข้อ 3 ก่อนถ้าทำได้

---

## 5. ย้ายฐานข้อมูลไปที่ใหม่ (เปลี่ยน region หรือย้ายโฮสต์)

Supabase **เปลี่ยน region ของโปรเจกต์เดิมไม่ได้** ต้องสร้างโปรเจกต์ใหม่แล้วย้ายข้อมูลตาม

> **ทำไมถึงคุ้ม:** ตอนนี้อยู่มุมไบ คนใช้ในไทยรอราว 120 ms ถ้าย้ายไปสิงคโปร์จะเหลือราว 30 ms — **เร็วขึ้น 4 เท่า** และยิ่งข้อมูลน้อยยิ่งย้ายง่าย

### ขั้นตอน

1. สร้างโปรเจกต์ Supabase ใหม่ เลือก region **Southeast Asia (Singapore)**
2. ที่โปรเจกต์ใหม่ เปิด SQL Editor วาง [supabase/schema.sql](../supabase/schema.sql) แล้ว Run
3. **ล้างข้อมูลตั้งต้นที่ไฟล์นั้นใส่มาให้** ไม่งั้นจะชนกับข้อมูลจริงที่กำลังจะย้ายไป

   ```sql
   truncate transactions, categories, accounts, shops cascade;
   ```

4. ย้ายข้อมูล — ใช้ **connection pooler** ของทั้งสองฝั่ง

   ```bash
   node scripts/migrate-db.mjs "<url เดิม>" "<url ใหม่>"
   ```

5. เปลี่ยน `DATABASE_URL` ที่ Vercel เป็นของใหม่ (**พอร์ต 6543**) แล้ว Redeploy
6. เปลี่ยน `vercel.json` เป็น `{ "regions": ["sin1"] }` แล้ว push
7. `npm run db:check` ยืนยันว่าทุกอย่างครบ

### สคริปต์ย้ายรับประกันอะไร

- **คง UUID เดิมทุกแถว** ความสัมพันธ์ระหว่างตารางจึงไม่ขาด
- คง `is_deleted` / `created_at` / `updated_at` เดิม ไม่ใช่เวลาที่ย้าย
- ใส่ตามลำดับ foreign key: shops → accounts → categories → transactions
- ทำใน transaction เดียว พังกลางทางแล้วปลายทางว่างเหมือนเดิม ไม่เหลือข้อมูลครึ่งๆ
- **อ่านอย่างเดียวจากต้นทาง** ไม่แตะข้อมูลเดิมเลย
- หยุดเองถ้าปลายทางมีข้อมูลอยู่แล้ว
- ตรวจทานหลังย้ายด้วยการนับแถวและ**เทียบยอดรวมเงิน** ถ้าไม่ตรงจะไม่บอกว่าสำเร็จ

สคริปต์นี้ใช้ซ้ำได้ตอนย้ายไป Postgres บน VPS หรือโฮสต์อื่นในอนาคต ไม่ได้ผูกกับ Supabase

---

## 6. ย้ายฐานข้อมูลด้วย pg_dump

ทั้งแอปต่อฐานข้อมูลผ่าน `DATABASE_URL` จุดเดียว (`src/db/index.ts`) ย้ายไป Postgres เจ้าไหนก็ได้

```bash
pg_dump "$OLD_DATABASE_URL" -Fc -f backup.dump
pg_restore -d "$NEW_DATABASE_URL" --no-owner --no-privileges backup.dump
```

แล้วเปลี่ยน `DATABASE_URL` กับรีสตาร์ท — จบ ไม่ต้องแตะโค้ดสักบรรทัด

**เอาข้อมูลออกโดยไม่ต้องมี psql** — ล็อกอินแล้วเปิด `/api/export` (JSON ทั้งก้อน) หรือ `/api/export?f=csv` (เปิดใน Excel ได้ ใส่ BOM มาให้แล้วภาษาไทยไม่เพี้ยน) หรือกดจากหน้าตั้งค่า

---

## 6. ไอคอนสำหรับปักหน้าจอโฮม

ยังไม่มีไฟล์ไอคอนมาให้ ต้องใส่เองสองไฟล์

```
public/icon-192.png    192×192
public/icon-512.png    512×512
```

ก่อนใส่ แอปยังใช้งานได้ปกติทุกอย่าง แค่ไอคอนบนหน้าโฮมจะเป็นภาพจับหน้าจอแทน

---

## สิ่งที่จงใจไม่ใช้ เพื่อให้ย้ายโฮสต์ได้

| ไม่ใช้ | เพราะ |
|---|---|
| `middleware.ts` | รันบน Edge runtime ซึ่ง Passenger รันไม่ได้ — ย้ายการ์ดล็อกอินไปไว้ที่ layout กับ server action ทุกตัวแทน |
| `supabase-js` และ Supabase Auth/Storage/Realtime | ผูกกับ Supabase — ใช้ `postgres.js` ต่อผ่าน `DATABASE_URL` อย่างเดียว |
| `@vercel/*`, Vercel Cron, on-demand ISR | ผูกกับ Vercel |
| `next/image` แบบปรับขนาดอัตโนมัติ | ต้องมี image optimizer ที่แชร์โฮสติ้งไม่มี — ตั้ง `images.unoptimized` ไว้แล้ว |
| Google Fonts ตอน build | โฮสต์บางที่ต่อเน็ตออกนอกไม่ได้ — ใช้ `@fontsource-variable/noto-sans-thai` จาก npm แทน |

ทุก route handler และทุกหน้าประกาศ `export const runtime = "nodejs"` ไว้ชัดเจน กันไม่ให้เผลอกลายเป็น Edge

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ |
|---|---|
| แอปไม่ขึ้น ล็อกบอก `ตั้งค่า environment ไม่ครบ` | ไม่มีไฟล์ `.env` ในโฟลเดอร์เดียวกับ `server.js` หรือค่าไม่ครบสี่ตัว |
| `prepared statement already exists` แบบสุ่ม | ใช้พอร์ต 6543 แต่โค้ดตรวจไม่เจอ — ตรวจว่า `DATABASE_URL` มี `:6543` จริง |
| หน้าเว็บขึ้นแต่ไม่มี CSS เลย | ลืมก๊อบ `.next/static` — ใช้ `npm run pack` แทนการก๊อบเอง |
| ล็อกอินแล้วเด้งกลับหน้าล็อกอินวนไป | `AUTH_SECRET` ไม่ตรงกันระหว่างตอนสร้าง cookie กับตอนอ่าน หรือสั้นกว่า 32 ตัวอักษร |
| กดวันนี้แล้วได้วันถัดไป | ไม่น่าเกิด — "วันนี้" ตรึงไว้ที่ `Asia/Bangkok` ใน `src/lib/date.ts` ไม่ได้พึ่งเวลาเครื่อง |
| ทุกคนโดนล็อกเพราะกรอกรหัสผิด | nginx ไม่ได้ส่ง `X-Forwarded-For` — ดู `deploy-nginx.conf.example` |
