import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-ink text-gray-200 antialiased">
        {children}
      </body>
    </html>
  );
}
