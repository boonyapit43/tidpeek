import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasSession } from "@/lib/auth";
import { getSelectedShop, isValidShop, rememberShop } from "@/lib/shop";
import { closeTestDb, createSchema, raw, resetData } from "@/test/db";
import { IDLE } from "./shared";
import { login, logout } from "./auth";
import { createShop, switchShop } from "./settings";

/**
 * ด่านความปลอดภัยและการเลือกร้าน
 *
 * สองเรื่องนี้ผิดไม่ได้เลย
 *   • ยังไม่ล็อกอินต้องแตะข้อมูลไม่ได้ — server action ยิงตรงจากเน็ตได้
 *     ไม่ได้ถูกกันโดยอัตโนมัติเพราะปุ่มอยู่หลังหน้าล็อกอิน
 *   • "กำลังบันทึกลงร้านไหน" ต้องไม่มีทางเดาผิด ระบบจึงไม่เลือกร้านให้เอง
 *     และไม่ยอมจำ id ที่ไม่มีอยู่จริง
 */

const fd = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) form.set(k, v);
  return form;
};

/** login/logout/switchShop จบด้วย redirect ซึ่งทำงานด้วยการโยน error */
async function expectRedirect(fn: () => Promise<unknown>, to: string) {
  await expect(fn()).rejects.toMatchObject({ digest: expect.stringContaining(to) });
}

beforeAll(async () => {
  await createSchema();
});

beforeEach(async () => {
  await resetData();
  await logout().catch(() => undefined);
});

afterAll(async () => {
  await closeTestDb();
});

describe("ล็อกอิน", () => {
  it("รหัสถูก ได้ session แล้วพาไปหน้าเลือกร้าน", async () => {
    await expectRedirect(() => login(IDLE, fd({ pin: "0000" })), "/shops");
    expect(await hasSession()).toBe(true);
  });

  it("รหัสผิด ไม่ได้ session และไม่บอกว่าผิดตรงไหน", async () => {
    const state = await login(IDLE, fd({ pin: "9999" }));

    expect(state).toMatchObject({ status: "error", message: "รหัสไม่ถูกต้อง" });
    expect(await hasSession()).toBe(false);
  });

  it("รหัสว่าง ไม่ผ่าน", async () => {
    const state = await login(IDLE, fd({ pin: "" }));

    expect(state.status).toBe("error");
    expect(await hasSession()).toBe(false);
  });

  it("ออกจากระบบแล้ว session หายจริง", async () => {
    await expectRedirect(() => login(IDLE, fd({ pin: "0000" })), "/shops");
    expect(await hasSession()).toBe(true);

    await expectRedirect(() => logout(), "/login");
    expect(await hasSession()).toBe(false);
  });
});

describe("เลือกร้าน", () => {
  async function makeShop(name: string) {
    await login(IDLE, fd({ pin: "0000" })).catch(() => undefined);
    await createShop(IDLE, fd({ name }));
    const [row] = await raw<{ id: string }[]>`select id from shops where name = ${name}`;
    return row.id;
  }

  it("สลับไปร้านที่มีอยู่จริงได้", async () => {
    const shopId = await makeShop("ร้านหนึ่ง");

    await expectRedirect(() => switchShop(fd({ shopId })), "/");

    const shop = await getSelectedShop();
    expect(shop?.id).toBe(shopId);
  });

  it("id มั่วจากภายนอก ต้องไม่ถูกจำไว้", async () => {
    await makeShop("ร้านหนึ่ง");

    // ไม่ redirect เพราะ id ใช้ไม่ได้ — คืนเงียบๆ แทน
    await switchShop(fd({ shopId: "6f7c2e1a-0b3d-4e5f-8a9b-1c2d3e4f5a6b" }));

    expect(await getSelectedShop()).toBeNull();
  });

  it("ยังไม่ล็อกอิน สลับร้านไม่ได้", async () => {
    const shopId = await makeShop("ร้านหนึ่ง");
    await expectRedirect(() => logout(), "/login");

    await switchShop(fd({ shopId }));

    expect(await getSelectedShop()).toBeNull();
  });

  /**
   * เคสที่อันตรายที่สุด — ร้านที่จำไว้ถูกลบไปแล้ว
   *
   * ต้องคืน null เพื่อให้ layout เด้งกลับไปหน้าเลือกร้าน ห้ามตกไปใช้ร้านแรก
   * ให้อัตโนมัติ ไม่งั้นคนจะบันทึกรายการลงผิดร้านโดยไม่รู้ตัว
   */
  it("ร้านที่จำไว้ถูกลบ ต้องคืน null ไม่ใช่เดาร้านอื่นให้", async () => {
    const shopId = await makeShop("ร้านหนึ่ง");
    await makeShop("ร้านสอง");
    await rememberShop(shopId);

    expect((await getSelectedShop())?.id).toBe(shopId);

    await raw`update shops set is_deleted = true where id = ${shopId}`;

    expect(await getSelectedShop()).toBeNull();
  });

  it("ร้านที่ถูกปิดใช้งาน ก็ต้องคืน null เหมือนกัน", async () => {
    const shopId = await makeShop("ร้านหนึ่ง");
    await rememberShop(shopId);

    await raw`update shops set is_active = false where id = ${shopId}`;

    expect(await getSelectedShop()).toBeNull();
    expect(await isValidShop(shopId)).toBe(false);
  });
});
