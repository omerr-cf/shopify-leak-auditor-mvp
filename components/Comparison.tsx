"use client";

import { PRODUCTION_APP_ROOT_URL } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const ROWS = [
  {
    label: "Setup Time",
    us: "60 Seconds",
    them: "2+ Hours",
    usGood: true,
  },
  {
    label: "Interface",
    us: "1 Actionable Page",
    them: "50+ Complex BI Dashboards",
    usGood: true,
  },
  {
    label: "Pricing Model",
    us: "Flat $49/mo, always",
    them: "$49 → $149 → $299 as you grow",
    usGood: true,
  },
  {
    label: "Billing Trust",
    us: "100% Native Shopify Managed Billing",
    them: "Third-Party Subscription Lock-ins",
    usGood: true,
  },
  {
    label: "App Bloat Detection",
    us: "Included",
    them: "None",
    usGood: true,
  },
];

export default function Comparison() {
  return (
    <section className="border-b border-line/60 bg-panel/40">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            No spin, just the truth
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
            LeakAudit vs. Legacy Profit Apps
          </h2>
          <p className="mt-3 leading-relaxed text-gray-400">
            We built this after reading hundreds of 1-star reviews on BeProfit
            and Lifetimely. Here&apos;s what we fixed.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="glass-panel overflow-hidden rounded-2xl"
        >
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-line bg-[#111827] text-xs font-semibold uppercase tracking-wide sm:text-sm">
            <div className="p-2 text-gray-400 sm:p-4">&nbsp;</div>
            <div className="border-x border-line bg-emerald-500/10 p-2 text-center text-emerald-400 sm:p-4">
              LeakAudit
            </div>
            <div className="p-2 text-center text-gray-400 sm:p-4">
              BeProfit / Lifetimely
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 ${
                i !== ROWS.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div className="flex items-center p-2 text-xs font-medium text-gray-400 sm:p-4 sm:text-sm">
                {row.label}
              </div>
              <div className="flex items-center justify-center gap-2 border-x border-line bg-emerald-500/[0.04] p-2 text-center text-xs font-semibold text-white sm:p-4 sm:text-sm">
                <Check
                  className="h-4 w-4 shrink-0 text-emerald-400"
                  strokeWidth={2}
                />
                {row.us}
              </div>
              <div className="flex items-center justify-center gap-2 p-2 text-center text-xs text-gray-400 sm:p-4 sm:text-sm">
                <X
                  className="h-4 w-4 shrink-0 text-red-500/70"
                  strokeWidth={2}
                />
                {row.them}
              </div>
            </div>
          ))}
        </motion.div>

        <div className="mt-10 text-center">
          <a
            href={PRODUCTION_APP_ROOT_URL}
            className="inline-block rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-7 py-3.5 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400"
          >
            See the Difference on My Store →
          </a>
        </div>
      </div>
    </section>
  );
}
