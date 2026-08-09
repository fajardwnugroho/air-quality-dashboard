import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const alt = "Pipefitter - Lightweight Data Pipeline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const imageBuffer = fs.readFileSync(
    path.join(process.cwd(), "public/og-image.png")
  );
  const screenshotUri = `data:image/png;base64,${imageBuffer.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
        color: "#fafafa",
        fontFamily: "Inter",
        padding: "48px 56px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <svg viewBox="0 0 64 64" style={{ width: 36, height: 36 }}>
          <rect width="64" height="64" rx="12" fill="#FFFFFF" />
          <circle cx="46" cy="46" r="6" fill="#2563EB" />
        </svg>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>
          Pipefitter
        </span>
      </div>

      <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 24 }}>
        Lightweight Data Pipeline orchestration, built for your growth data team
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 24,
        }}
      >
        <img
          src={screenshotUri}
          alt="Dashboard"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 15,
          color: "#94a3b8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#22c55e" }}>✓</span>
          <span>Schedule Jobs</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#22c55e" }}>✓</span>
          <span>Multiple Data Source</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#22c55e" }}>✓</span>
          <span>Python and R</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#22c55e" }}>✓</span>
          <span>Dashboard + AI Ready</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 20,
          fontSize: 13,
          color: "#64748b",
        }}
      >
        fajardwnugroho.com
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
