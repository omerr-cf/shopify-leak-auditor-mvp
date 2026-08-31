import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "#07090E",
          backgroundImage:
            "radial-gradient(circle at 15% 0%, rgba(16,185,129,0.22) 0%, transparent 55%), radial-gradient(circle at 90% 90%, rgba(6,182,212,0.14) 0%, transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, #6EE7B7 0%, #10B981 55%, #047857 100%)",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <path
                d="M9.5 16.6 13.7 20.8 23 11.3"
                stroke="white"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", color: "#9CA3AF", fontSize: 30, fontWeight: 600 }}>
            LeakAudit for Shopify
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "white",
            maxWidth: 980,
          }}
        >
          Find the $400–$1,200/Month Your Shopify Store Is Leaking.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            color: "#34D399",
            fontWeight: 600,
          }}
        >
          In 60 seconds. No spreadsheets. No 2-hour setup.
        </div>
      </div>
    ),
    { ...size }
  );
}
