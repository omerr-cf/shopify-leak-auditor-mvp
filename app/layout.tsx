import "@fontsource/fraunces/500-italic.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600-italic.css";
import "@fontsource/fraunces/600.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
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

// Real production domain confirmed by Gemini/Omer (2026-09-09):
// https://leakauditb2b.netlify.app/. NEXT_PUBLIC_SITE_URL still overrides it
// so a future custom domain doesn't require another code change -- just set
// the env var in Netlify and redeploy.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://leakauditb2b.netlify.app";
const title =
  "LeakAudit — Find the $400–$1,200/Month Your Shopify Store Is Leaking";
const description =
  "Connect your Shopify store and see a 1-page Cash Leak Report in 60 seconds. No 2-hour setup, no order-volume pricing cliffs, no bloated dashboards. Read-only, flat pricing, 1-click uninstall.";

// JSON-LD structured data (SoftwareApplication). Deliberately omits
// aggregateRating / review fields -- there are no real reviews yet, and
// fabricating one would be exactly the kind of fake social proof already
// stripped out of the Calculator ticker elsewhere in this codebase.
//
// applicationCategory: verified against Google's Software App structured
// data docs (developers.google.com/search/docs/appearance/structured-data/
// software-app) -- this field expects a SINGLE value from Google's fixed
// list, not a comma-joined string of multiple categories. "FinanceApplication"
// is the more precise single match (the product audits FX fees, margins and
// profit -- a financial-analysis tool) vs. the more generic
// "BusinessApplication" used previously.
//
// offers.price: intentionally left at "49", matching the real
// `shopify.server.ts` billing plan ($49/month flat, currently gated off
// during the free Founder Beta). Structured data must reflect the actual
// price a user would be charged -- Google's structured-data guidelines
// explicitly warn against marking up "irrelevant or misleading content" --
// so this is NOT switched to "0" even though the app is free right now;
// "free during a beta" and "the product's real price" are different facts,
// and only the latter belongs in a permanent Offer schema.
const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LeakAudit for Shopify",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Shopify",
  description,
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "49",
    priceCurrency: "USD",
  },
};

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
    // No explicit `images` here — app/opengraph-image.tsx generates a real
    // branded 1200x630 PNG at build time and Next wires it in automatically.
    // The old code pointed at a static /og-image.png that was never
    // actually added to public/, so every social share was a broken image.
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
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
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationJsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}
