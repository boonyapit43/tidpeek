import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * โหมดมืดมีสองทางเข้า และทั้งคู่ต้องให้สีเดียวกัน
 *
 *   1) ตามเครื่อง  @media (prefers-color-scheme: dark)
 *   2) เลือกเอง    :root[data-theme="dark"]
 *
 * CSS ไม่มีวิธีประกาศโทเคนชุดเดียวแล้วเอาไปใช้สองสโคปโดยไม่เขียนซ้ำ
 * (ไม่มี mixin) จึงต้องก๊อปสองที่ ซึ่งแปลว่าวันหนึ่งจะมีคนแก้ที่เดียวแล้วลืม
 * อีกที่ ผลคือคนที่กดเลือกธีมเองเห็นสีคนละชุดกับคนที่ปล่อยตามเครื่อง
 * โดยไม่มีอะไรฟ้อง
 *
 * เทสนี้อ่านไฟล์ CSS จริงแล้วเทียบสองบล็อกทีละบรรทัด
 */

const css = readFileSync("src/app/globals.css", "utf8");

/** ดึงเนื้อในวงเล็บปีกกาที่เปิดหลังข้อความที่ให้มา นับปีกกาซ้อนให้ถูก */
function blockAfter(marker: string): string {
  const at = css.indexOf(marker);
  if (at < 0) throw new Error(`ไม่เจอ ${marker} ใน globals.css`);

  const open = css.indexOf("{", at + marker.length);
  let depth = 0;

  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }

  throw new Error(`ปีกกาของ ${marker} ไม่ปิด`);
}

/** เฉพาะบรรทัดที่ประกาศโทเคน ตัดคอมเมนต์กับย่อหน้าออกให้เทียบกันได้ */
function tokensIn(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("--"));
}

describe("โทเคนโหมดมืดสองสโคปต้องตรงกัน", () => {
  const fromDevice = tokensIn(blockAfter(':root:not([data-theme="light"])'));
  const fromChoice = tokensIn(blockAfter(':root[data-theme="dark"]'));

  it("ทั้งสองบล็อกมีโทเคนครบเท่ากัน", () => {
    expect(fromChoice).toEqual(fromDevice);
  });

  it("มีโทเคนอยู่จริง ไม่ใช่ว่างเปล่าทั้งคู่แล้วผ่านไปเฉยๆ", () => {
    expect(fromDevice.length).toBeGreaterThan(10);
  });

  /**
   * บล็อกของเครื่องต้องยอมแพ้ให้คนที่เลือก "สว่าง" เอง
   *
   * ถ้าไม่มี :not([data-theme="light"]) คนที่ตั้งเครื่องเป็นมืดแล้วกดปุ่ม
   * เลือกสว่างจะยังได้จอมืดอยู่ ปุ่มกลายเป็นกดแล้วไม่เกิดอะไร
   */
  it("เลือกสว่างเองแล้วชนะการตั้งค่าของเครื่อง", () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root:not([data-theme="light"])');
  });
});
