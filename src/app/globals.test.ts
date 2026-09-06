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

/* ------------------------------------------------------------------ */

/**
 * สีแถบสถานะต้องตรงกับสีแถบหัวแอป
 *
 * สีเดียวกันนี้ถูกเขียนไว้สามที่คนละรูปแบบ
 *
 *   globals.css   --chrome-from          เป็น oklch()
 *   layout.tsx    viewport.themeColor    เป็น hex
 *   manifest.ts   theme_color            เป็น hex
 *
 * ต้องเป็น hex ในสองที่หลังเพราะ meta tag กับ manifest รับได้แค่ hex
 * แปลว่าวันหนึ่งจะมีคนแก้สีที่ globals.css แล้วลืมอีกสองที่ ผลคือแถบสถานะ
 * เป็นคนละสีกับแถบหัวที่อยู่ใต้มัน เห็นเป็นเส้นแบ่งคาจอ ซึ่งเป็นอาการที่
 * มองไม่เห็นตอนพัฒนาบนคอม เพราะเบราว์เซอร์บนเดสก์ท็อปไม่ใช้ค่าพวกนี้เลย
 *
 * เทสนี้แปลง oklch กลับเป็น sRGB แล้วเทียบกับ hex ที่เขียนไว้จริง
 */

/** oklch → sRGB 0-255 ตามสูตรของ Björn Ottosson */
function oklchToRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map((v) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(g * 255)));
  }) as [number, number, number];
}

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * ดึงค่า oklch ของ --chrome-from จากบล็อกที่ให้มา
 *
 * ต้องเป็น chrome ไม่ใช่ band — สองอันนี้เท่ากันในโหมดสว่างแต่ต่างกัน
 * ในโหมดมืด ถ้าจับผิดตัวเทสจะผ่านทั้งที่สีแถบสถานะไม่ตรงกับแถบหัว
 */
function chromeFrom(block: string): [number, number, number] {
  const m = block.match(/--chrome-from:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!m) throw new Error("ไม่เจอ --chrome-from ในบล็อกที่ให้มา");
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** ดึง hex ที่ผูกกับ prefers-color-scheme ค่าหนึ่งออกจากไฟล์ */
function themeColorFor(source: string, scheme: "light" | "dark"): string {
  const at = source.indexOf(`prefers-color-scheme: ${scheme})`);
  if (at < 0) throw new Error(`ไม่เจอ themeColor ของโหมด ${scheme} ใน layout.tsx`);

  // ค่าสีตัวแรกที่โผล่หลังชื่อโหมด คือค่าของโหมดนั้น
  const m = source.slice(at).match(/#[0-9a-fA-F]{6}/);
  if (!m) throw new Error(`เจอโหมด ${scheme} แต่ไม่เจอค่าสีตามหลัง`);
  return m[0].toLowerCase();
}

describe("สีแถบสถานะตรงกับสีแถบหัวแอป", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const manifest = readFileSync("src/app/manifest.ts", "utf8");

  /**
   * ยอมให้ต่างได้ช่องละ 2 จากการปัดเศษตอนแปลงสี
   * ถ้าลืมแก้ไฟล์ใดไฟล์หนึ่งจริงๆ ค่าจะต่างกันเป็นสิบขึ้นไป จับได้แน่นอน
   */
  const ต้องใกล้กัน = (got: number[], want: number[], ที่ไหน: string) => {
    got.forEach((v, i) => {
      expect(Math.abs(v - want[i]), `${ที่ไหน} ช่องที่ ${i}`).toBeLessThanOrEqual(2);
    });
  };

  it("โหมดสว่าง — themeColor ตรงกับ --chrome-from", () => {
    const fromCss = oklchToRgb(...chromeFrom(blockAfter(":root")));
    ต้องใกล้กัน(hexToRgb(themeColorFor(layout, "light")), fromCss, "layout.tsx โหมดสว่าง");
  });

  it("โหมดมืด — themeColor ตรงกับ --chrome-from", () => {
    const fromCss = oklchToRgb(...chromeFrom(blockAfter(':root[data-theme="dark"]')));
    ต้องใกล้กัน(hexToRgb(themeColorFor(layout, "dark")), fromCss, "layout.tsx โหมดมืด");
  });

  it("theme_color ใน manifest ตรงกับโหมดสว่าง", () => {
    const m = manifest.match(/theme_color:\s*"(#[0-9a-fA-F]{6})"/);
    expect(m, "ไม่เจอ theme_color ใน manifest.ts").not.toBeNull();
    const fromCss = oklchToRgb(...chromeFrom(blockAfter(":root")));
    ต้องใกล้กัน(hexToRgb(m![1].toLowerCase()), fromCss, "manifest.ts");
  });
});
