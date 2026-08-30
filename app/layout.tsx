import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// Geist ships as local font files (no Google Fonts network fetch at build
// time), and gives the Linear/Stripe-tier feel requested for this redesign.

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
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans bg-ink text-gray-200 antialiased">
        {children}
      </body>
    </html>
  );
}
