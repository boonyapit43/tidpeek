/** จำนวนประเภทในลิสต์ — เกินนี้รวบเป็นบรรทัดเดียว ไม่ตัดทิ้ง */
export const TOP_CATEGORIES = 6;

export type SpendRow = { key: string; name: string; total: string; percent: number };

/**
 * ลิสต์ว่าเงินไปกับอะไร พร้อมสัดส่วนของแต่ละก้อน
 *
 * แยกออกมาจากไฟล์หน้าจอเพราะไฟล์นั้นดึง next/headers เข้ามาด้วย ซึ่งเป็น
 * ของฝั่งเซิร์ฟเวอร์ล้วนๆ พอเทสอยากเรียกฟังก์ชันนี้ตรงๆ จะติดทั้งก้อนไปด้วย
 *
 * หกอันดับแรก ที่เหลือรวบเป็นบรรทัดเดียว — รวบ ไม่ใช่ตัดทิ้ง เพราะผลบวกของ
 * ลิสต์ต้องเท่ายอดรายจ่ายที่วงบอกเสมอ สองตัวเลขนี้อยู่ห่างกันไม่ถึงนิ้วบนภาพ
 * เดียวกัน ถ้าเล่าคนละเรื่องคนรับจะเลิกเชื่อทั้งภาพ
 *
 * สัดส่วนคิดจากยอดรายจ่ายรวมที่ส่งเข้ามา ไม่ใช่จากผลบวกของลิสต์ ทั้งสองค่า
 * เท่ากันอยู่แล้วเมื่อผู้เรียกกรองประเภทที่นับกำไรมาให้ถูก — คิดจากตัวที่วง
 * ใช้จริงทำให้เปอร์เซ็นต์กับวงไม่มีทางเล่าคนละเรื่อง
 */
export function spendRows(
  rows: { categoryId: string | null; name: string; total: string }[],
  expenseTotal: string,
): SpendRow[] {
  const total = Number.parseFloat(expenseTotal) || 0;
  const share = (value: string) =>
    total > 0 ? Math.round(((Number.parseFloat(value) || 0) / total) * 100) : 0;

  const shown = rows.slice(0, TOP_CATEGORIES).map((r) => ({
    key: r.categoryId ?? `none-${r.name}`,
    name: r.name,
    total: r.total,
    percent: share(r.total),
  }));

  const rest = rows.slice(TOP_CATEGORIES);
  if (rest.length === 0) return shown;

  const restTotal = String(rest.reduce((sum, r) => sum + Number.parseFloat(r.total), 0));

  return [
    ...shown,
    {
      key: "rest",
      name: `อีก ${rest.length} ประเภท`,
      total: restTotal,
      percent: share(restTotal),
    },
  ];
}
