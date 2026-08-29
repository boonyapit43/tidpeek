/**
 * หน้าที่ขึ้นเมื่อเข้าที่อยู่ที่ไม่มีอยู่จริง
 *
 * เกิดได้จากบุ๊กมาร์กเก่าหรือพิมพ์ที่อยู่ผิด ถ้าไม่มีไฟล์นี้จะได้หน้า 404
 * ภาษาอังกฤษของ Next.js ซึ่งไม่มีทางออกให้กดกลับเข้าแอป
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="num text-4xl font-bold text-ink-soft">404</p>

      <div>
        <h1 className="text-lg font-bold text-ink">ไม่พบหน้านี้</h1>
        <p className="mt-1.5 text-sm text-ink-soft">ที่อยู่อาจพิมพ์ผิดหรือถูกย้ายไปแล้ว</p>
      </div>

      <a
        href="/shops"
        className="bg-brand-gradient flex min-h-touch w-full items-center justify-center rounded-xl font-semibold text-on-accent shadow-md shadow-brand/25 transition active:scale-[0.98]"
      >
        กลับไปหน้าเลือกร้าน
      </a>
    </main>
  );
}
