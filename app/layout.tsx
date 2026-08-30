import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/500-italic.css";
import "@fontsource/fraunces/600-italic.css";
import "./globals.css";

// Geist ships as local font files (no network fetch at build time). Fraunces
// — the display serif used for headlines only, to break the "one grotesk
// sans everywhere" default every AI-generated SaaS template falls into —
// is loaded via @fontsource rather than next/font/google. Same reasoning
// as Geist: it ships the actual woff2 files through npm, so the build
// never depends on reaching fonts.googleapis.com at build time (which is
// blocked in some CI/sandboxed environments). Numbers (dollar figures,
// stats) use Geist Mono instead of the body sans — tabular, deliberate,
// reads as "real data" rather than decorative type.

const siteUrl = "https://leakaudit-mvp.vercel.app";
const title =
  "LeakAudit — Find the $400–$1,200/Month Your Shopify Store Is Leaking";
const description =
  "Connect your Shopify store and see a 1-page Cash Leak Report in 60 seconds. No 2-hour setup, no order-volume pricing cliffs, no bloated dashboards. Read-only, flat pricing, 1-click uninstall.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "Shopify profit tracker",
    "Shopify cost leak audit",
    "Shopify hidden fees",
    "Shopify FX markup",
    "Shopify app bloat",
    "Shopify net margin app",
  ],
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "LeakAudit for Shopify",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeakAudit — Cash Leak Report preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-ink text-gray-200 antialiased">
        {/* Subtle grain overlay — the single fastest fix for the "flat AI
            gradient" look. Fixed, non-interactive, sits above everything. */}
        <div className="grain-overlay pointer-events-none fixed inset-0 z-[60]" />
        {children}
      </body>
    </html>
  );
}
