"use client";

/**
 * ด่านสุดท้าย — ขึ้นเมื่อ root layout เองพัง
 *
 * error.tsx ธรรมดาอาศัย layout ในการ render จึงช่วยอะไรไม่ได้ถ้าตัว layout
 * คือสิ่งที่พัง ไฟล์นี้แทนที่เอกสารทั้งหน้าจึงต้องมี html กับ body ของตัวเอง
 *
 * ไม่มี CSS ของแอปให้ใช้ (ตัว layout ที่ import globals.css พังไปแล้ว)
 * จึงเขียนสไตล์ฝังไว้ในไฟล์ กรณีนี้เกิดยากมาก แต่ถ้าเกิดแล้วไม่มีอะไรรองรับ
 * คนใช้จะเจอหน้าขาวสนิทซึ่งเป็นสิ่งที่เรากำลังแก้อยู่พอดี
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f4f4f7",
          color: "#22232b",
        }}
      >
        <div style={{ maxWidth: "22rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", margin: 0 }}>แอปเปิดไม่สำเร็จ</h1>

          <p style={{ fontSize: "0.875rem", color: "#5a5b66", lineHeight: 1.6 }}>
            ลองปิดแล้วเปิดใหม่อีกครั้ง
            <br />
            ข้อมูลที่บันทึกไว้แล้วยังอยู่ครบ
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "2.75rem",
              width: "100%",
              borderRadius: "0.75rem",
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ลองใหม่
          </button>

          {error.digest && (
            <p style={{ fontSize: "0.6875rem", color: "#8a8b96" }}>
              รหัสอ้างอิง {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
