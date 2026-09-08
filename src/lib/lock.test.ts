import { describe, expect, it } from "vitest";
import { AWAKE_COOKIE, AWAKE_MAX_AGE_SECONDS, awakeCookie } from "./lock";

/**
 * บรรทัด cookie ที่ฝั่งหน้าจอเอาไปต่ออายุตัวเอง
 *
 * เขียนผิดสักตัวแล้วเบราว์เซอร์จะทิ้งทั้งบรรทัดเงียบๆ ไม่มี error ไม่มีอะไรฟ้อง
 * อาการที่คนใช้เจอคือ "ใช้ไปสักพักแล้วเด้งออกเอง" ซึ่งไล่หาสาเหตุยากมาก
 * เพราะมันเกิดหลังผ่านไป 15 นาที ไม่ใช่ตอนกดอะไร
 */
describe("awakeCookie", () => {
  it("ล็อก 15 นาทีไว้ ไม่ให้ใครมาขยับโดยไม่ตั้งใจ", () => {
    expect(AWAKE_MAX_AGE_SECONDS).toBe(900);
  });

  it("มีครบทุกส่วนที่เบราว์เซอร์ต้องการ", () => {
    const c = awakeCookie(false);
    expect(c).toContain(`${AWAKE_COOKIE}=1`);
    // path=/ สำคัญ ไม่มีแล้ว cookie จะติดอยู่เฉพาะหน้าที่เซ็ต
    // แล้วด่านของหน้าอื่นจะมองไม่เห็น = เด้งออกทันทีที่เปลี่ยนหน้า
    expect(c).toContain("path=/");
    expect(c).toContain(`max-age=${AWAKE_MAX_AGE_SECONDS}`);
    expect(c).toContain("samesite=lax");
  });

  it("เป็น https ถึงจะใส่ secure", () => {
    expect(awakeCookie(true)).toContain("secure");
  });

  /**
   * เคสนี้คือเหตุผลที่ awakeCookie รับพารามิเตอร์แทนที่จะฮาร์ดโค้ด secure ไว้
   * ตอนรันที่ localhost แบบ http เบราว์เซอร์จะทิ้ง cookie ที่มี secure ทิ้งทันที
   * ผลคือ dev เด้งออกทุก 15 นาทีโดยไม่มีทางรู้ว่าทำไม
   */
  it("เป็น http ห้ามใส่ secure ไม่งั้นเบราว์เซอร์ทิ้งทั้งบรรทัด", () => {
    expect(awakeCookie(false)).not.toContain("secure");
  });
});
