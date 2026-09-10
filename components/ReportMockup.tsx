"use client";

import { PRODUCTION_APP_ROOT_URL } from "@/lib/utils";
import { motion } from "framer-motion";
import Image from "next/image";

// Real screenshot of the live production app (public/screenshots/real-app-dashboard.png),
// captured against leakaudit-test-store.myshopify.com -- replaces what used
// to be a hand-built HTML recreation of the dashboard with synthetic
// numbers ($847/mo, "UrbanAesthetic.myshopify.com", a fake "Refreshed 4
// min ago" timestamp). The $244/mo figure in the badge below is copied
// directly from what's visible in that screenshot ("Total Money You Can
// Recover Today: $244 / month") -- verified against the actual image file
// before wiring it in, not just taken on faith. The store name visible in
// the screenshot is a test store, which is left as-is rather than cropped
// out -- it's honest about what it is.
export default function ReportMockup() {
  return (
    <section className="border-b border-line/60">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            What you actually get
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
            One Page. Four Leaks. Zero Guesswork.
          </h2>
          <p className="mt-3 leading-relaxed text-gray-400">
            A real screenshot of the live app — not a mockup. This is what
            LeakAudit shows the moment its first scan finishes.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-lg pt-5"
        >
          {/* Floating badge overlay */}
          <div className="absolute left-1/2 top-0 z-10 w-max -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2 text-xs font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-8px_rgba(16,185,129,0.5)] sm:text-sm">
            ⚡ Real Store Scan: $244/mo Recoverable Cash Detected
          </div>

          {/*
            Glassmorphic frame rather than a perspective-tilted card: this
            screenshot is dense with real numbers a visitor is meant to
            actually read, and tilting a data-heavy dashboard in 3D fights
            legibility -- the opposite of what this section is for.
          */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink shadow-2xl shadow-black/40">
            <Image
              src="/screenshots/real-app-dashboard.png"
              alt="Real LeakAudit dashboard screenshot showing $244/month in recoverable cash leaks, a store margin health score, and itemized leak cards with one-click fixes"
              width={1196}
              height={1278}
              className="h-auto w-full"
              sizes="(min-width: 640px) 512px, 100vw"
            />
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <a
            href={PRODUCTION_APP_ROOT_URL}
            className="inline-block rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-6 py-3 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400"
          >
            Get My Real Report →
          </a>
        </div>
      </div>
    </section>
  );
}
