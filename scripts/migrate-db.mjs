/**
 * ย้ายข้อมูลทั้งหมดจากฐานหนึ่งไปอีกฐานหนึ่ง
 *
 *   node scripts/migrate-db.mjs "<ปลายทางเดิม>" "<ปลายทางใหม่>"
 *
 * ใช้ตอนย้าย region ของ Supabase (เปลี่ยน region ของโปรเจกต์เดิมไม่ได้
 * ต้องสร้างใหม่แล้วย้ายข้อมูลตาม) และใช้ซ้ำได้ตอนย้ายไป Postgres บน VPS
 * หรือโฮสต์อื่นในอนาคต
 *
 * สิ่งที่รับประกัน
 *   • คง UUID เดิมทุกแถว ความสัมพันธ์ระหว่างตารางจึงไม่ขาด
 *   • คงค่า is_deleted / created_at / updated_at เดิม ไม่ใช่เวลาที่ย้าย
 *   • ใส่ตามลำดับ shops → accounts → categories → transactions
 *     ตามทิศทางของ foreign key
 *   • ทำใน transaction เดียว ถ้าพังกลางทางฝั่งใหม่จะว่างเปล่าเหมือนเดิม
 *     ไม่เหลือข้อมูลครึ่งๆ กลางๆ ให้สับสน
 *
 * อ่านอย่างเดียวจากฝั่งเดิม ไม่แตะต้องข้อมูลต้นทางเลย
 * รันซ้ำได้ถ้าปลายทางยังว่าง ถ้าปลายทางมีข้อมูลแล้วจะหยุดและเตือน
 */
import postgres from "postgres";

const [from, to] = process.argv.slice(2);

if (!from || !to) {
  console.error("วิธีใช้: node scripts/migrate-db.mjs \"<url เดิม>\" \"<url ใหม่>\"");
  console.error("\nตัวอย่าง");
  console.error('  node scripts/migrate-db.mjs "postgresql://...mumbai...:5432/postgres" \\');
  console.error('                              "postgresql://...singapore...:5432/postgres"');
  process.exit(1);
}

if (from === to) {
  console.error("ต้นทางกับปลายทางเป็นที่เดียวกัน ตรวจ url อีกครั้ง");
  process.exit(1);
}

const connect = (url) =>
  postgres(url, {
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
    max: 1,
    connect_timeout: 20,
  });

const src = connect(from);
const dst = connect(to);

/** เรียงตามทิศทางของ foreign key — ตารางที่ถูกอ้างถึงต้องมาก่อน */
const TABLES = ["shops", "accounts", "categories", "transactions"];

const label = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}`;
  } catch {
    return "(url ไม่ถูกต้อง)";
  }
};

async function main() {
  console.log(`\nต้นทาง  ${label(from)}`);
  console.log(`ปลายทาง ${label(to)}\n`);

  // ปลายทางต้องมีตารางครบก่อน — รัน supabase/schema.sql หรือ db:migrate ไว้ก่อน
  const dstTables = await dst`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_name in ${dst(TABLES)}`;

  if (dstTables.length < TABLES.length) {
    const have = new Set(dstTables.map((t) => t.table_name));
    console.error("ปลายทางยังไม่มีตาราง: " + TABLES.filter((t) => !have.has(t)).join(", "));
    console.error("รัน supabase/schema.sql หรือ npm run db:migrate ที่ปลายทางก่อน");
    process.exit(1);
  }

  // กันการเผลอรันทับข้อมูลที่มีอยู่แล้ว
  for (const table of TABLES) {
    const [{ n }] = await dst`select count(*)::int as n from ${dst(table)}`;
    if (n > 0) {
      console.error(`ปลายทางมีข้อมูลอยู่แล้วในตาราง ${table} (${n} แถว)`);
      console.error("ล้างปลายทางก่อน หรือย้ายไปฐานที่ว่างจริงๆ");
      process.exit(1);
    }
  }

  const counts = {};

  await dst.begin(async (tx) => {
    for (const table of TABLES) {
      // เรียงตาม created_at เพื่อให้ลำดับใน dump อ่านง่าย ไม่มีผลกับความถูกต้อง
      const rows = await src`select * from ${src(table)} order by created_at`;
      counts[table] = rows.length;

      if (rows.length === 0) continue;

      // ใส่ทีละก้อน 500 แถว กัน parameter ล้นเมื่อข้อมูลเยอะ
      for (let i = 0; i < rows.length; i += 500) {
        await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 500))}`;
      }
    }
  });

  console.log("ย้ายข้อมูลเรียบร้อย");
  for (const table of TABLES) console.log(`  ${table.padEnd(14)} ${counts[table]} แถว`);

  // ตรวจซ้ำจากฝั่งปลายทางจริง ไม่เชื่อตัวเลขที่นับตอนใส่
  console.log("\nตรวจทานปลายทาง");
  let ok = true;

  for (const table of TABLES) {
    const [{ n }] = await dst`select count(*)::int as n from ${dst(table)}`;
    const match = n === counts[table];
    if (!match) ok = false;
    console.log(`  ${table.padEnd(14)} ${n} แถว ${match ? "ตรงกัน" : "ไม่ตรง!"}`);
  }

  // ยอดรวมเงินต้องเท่ากันเป๊ะ ถ้าไม่เท่าแปลว่ามีแถวหายหรือค่าเพี้ยน
  const sumOf = (client) =>
    client`select coalesce(sum(amount), 0)::text as total from transactions where is_deleted = false`;

  const [[srcSum], [dstSum]] = await Promise.all([sumOf(src), sumOf(dst)]);
  const sumMatch = srcSum.total === dstSum.total;
  if (!sumMatch) ok = false;

  console.log(`  ยอดรวมเงิน    ${dstSum.total} ${sumMatch ? "ตรงกัน" : `ไม่ตรง! เดิม ${srcSum.total}`}`);

  console.log(
    ok
      ? "\nเสร็จสมบูรณ์ — เปลี่ยน DATABASE_URL ไปที่ปลายทางได้เลย\n"
      : "\nมีบางอย่างไม่ตรง อย่าเพิ่งเปลี่ยน DATABASE_URL\n",
  );

  process.exitCode = ok ? 0 : 1;
}

main()
  .catch((error) => {
    console.error("\nย้ายไม่สำเร็จ:", error instanceof Error ? error.message : error);
    console.error("ข้อมูลต้นทางไม่ถูกแตะต้อง และปลายทางถูกย้อนกลับทั้งหมดแล้ว");
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([src.end(), dst.end()]);
  });
