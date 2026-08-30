"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useModal } from "./ModalProvider";

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
  const { openModal } = useModal();

  return (
    <section className="border-b border-line/60 bg-panel/40">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            No spin, just the truth
          </span>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            LeakAudit vs. Legacy Profit Apps
          </h2>
          <p className="mt-3 text-gray-400">
            We built this after reading hundreds of 1-star reviews on
            BeProfit and Lifetimely. Here&apos;s what we fixed.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-2xl border border-line"
        >
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-line bg-[#111827] text-xs font-semibold uppercase tracking-wide sm:text-sm">
            <div className="p-4 text-gray-500">&nbsp;</div>
            <div className="border-x border-line bg-emerald-500/10 p-4 text-center text-emerald-400">
              LeakAudit
            </div>
            <div className="p-4 text-center text-gray-500">
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
              <div className="flex items-center p-4 text-xs font-medium text-gray-400 sm:text-sm">
                {row.label}
              </div>
              <div className="flex items-center justify-center gap-2 border-x border-line bg-emerald-500/[0.04] p-4 text-center text-xs font-semibold text-white sm:text-sm">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                {row.us}
              </div>
              <div className="flex items-center justify-center gap-2 p-4 text-center text-xs text-gray-500 sm:text-sm">
                <X className="h-4 w-4 shrink-0 text-red-500/70" />
                {row.them}
              </div>
            </div>
          ))}
        </motion.div>

        <div className="mt-10 text-center">
          <button
            onClick={openModal}
            className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-bold text-ink transition hover:bg-emerald-400"
          >
            See the Difference on My Store →
          </button>
        </div>
      </div>
    </section>
  );
}
