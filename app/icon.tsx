import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #6EE7B7 0%, #10B981 55%, #047857 100%)",
          borderRadius: 9,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 32 32" fill="none">
          <path
            d="M9.5 16.6 13.7 20.8 23 11.3"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
