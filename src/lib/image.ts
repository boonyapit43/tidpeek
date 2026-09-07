/**
 * ย่อรูปให้เล็กก่อนส่ง
 *
 * รูปร้านถูกโชว์แค่ราว 40px บนหน้าเลือกร้าน แต่รูปที่ถ่ายจากมือถือมาเป็น
 * หลายล้านพิกเซล ถ้าส่งไปทั้งดุ้นจะได้แถวข้อมูลขนาดหลายเมกะไบต์ ซึ่งทำให้
 * คิวรีที่ดึงรายชื่อร้านช้าลงทั้งแอปโดยไม่ได้อะไรกลับมาเลย
 *
 * ย่อในเครื่องก่อนส่ง ไม่ได้ย่อที่เซิร์ฟเวอร์ เพราะเน็ตมือถือที่หน้าร้าน
 * อัปโหลดรูป 4MB ขึ้นไปช้ามาก และการย่อฝั่งเซิร์ฟเวอร์ต้องรับของใหญ่
 * เข้ามาก่อนอยู่ดี
 */

/** ด้านของรูปที่เก็บจริง — โชว์ 40px แต่เผื่อจอความละเอียดสูง */
export const IMAGE_SIZE = 128;

/**
 * กรอบที่จะตัดจากรูปต้นฉบับ ให้ได้จัตุรัสตรงกลางโดยไม่บีบรูปให้เพี้ยน
 *
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพราะเลขชุดนี้ผิดง่ายและผลลัพธ์เห็นชัด —
 * ผิดแล้วรูปยืดจนคนในรูปหน้าแบน หรือตัดโดนหัวขาด
 */
export function coverCrop(width: number, height: number) {
  const side = Math.min(width, height);

  return {
    // ตัดจากกลางภาพทั้งแนวนอนและแนวตั้ง
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    size: side,
  };
}

/**
 * อ่านไฟล์รูปแล้วคืน data URL ที่ย่อเป็นจัตุรัสแล้ว
 *
 * คืน null เมื่อไฟล์ไม่ใช่รูปหรืออ่านไม่ได้ ให้ฝั่งที่เรียกตัดสินใจเองว่า
 * จะบอกผู้ใช้ยังไง
 */
export async function shrinkToDataUrl(
  file: File,
  size = IMAGE_SIZE,
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // ไฟล์เสีย หรือเป็นชนิดที่เบราว์เซอร์ถอดรหัสไม่ได้ (เช่น HEIC บางรุ่น)
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const { sx, sy, size: side } = coverCrop(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    /**
     * webp เล็กกว่า jpeg ราวครึ่งหนึ่งที่คุณภาพเท่ากัน
     * เบราว์เซอร์ที่ไม่รองรับจะคืน data URL ของ png กลับมาแทนเงียบๆ
     * ซึ่งก็ยังใช้ได้ แค่ไฟล์ใหญ่กว่า — schema ฝั่งเซิร์ฟเวอร์รับทั้งสาม
     */
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    bitmap.close();
  }
}
