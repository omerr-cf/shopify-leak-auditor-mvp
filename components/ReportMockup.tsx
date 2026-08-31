"use client";

import { motion } from "framer-motion";
import {
  Store,
  CreditCard,
  PackageX,
  Gauge,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useModal } from "./ModalProvider";
import IconTile from "./IconTile";
import LottieSlot from "./LottieSlot";

const LEAK_CARDS = [
  {
    icon: <CreditCard />,
    title: "Non-Native Currency Gateway Markup",
    detail:
      "23% of orders settle in EUR/GBP through a gateway route charging a 1.9% FX markup above interbank rate.",
    amount: "$210/mo",
    fix: "Switch FX routing",
  },
  {
    icon: <PackageX />,
    title: "2 SKUs Selling at Negative Margin After Shipping",
    detail:
      '"Weighted Canvas Tote — Large" and "Ceramic Mug Bundle" cost more to fulfill than they sell for once shipping is included.',
    amount: "$195/mo",
    fix: "Reprice 2 SKUs",
  },
  {
    icon: <Gauge />,
    title: "3 Leftover Theme Scripts Delaying Mobile Load by 1.4s",
    detail:
      "Scripts from 3 uninstalled apps are still injected in theme.liquid, slowing mobile checkout and depressing conversion.",
    amount: "$290/mo in lost conversions",
    fix: "Remove 3 scripts",
  },
  {
    icon: <RotateCcw />,
    title: "1 Variant with 22% Return Rate",
    detail:
      '"Slim Fit Denim — 32W" returns at 4.8x your store average, driving silent refund + restocking drag.',
    amount: "$152/mo",
    fix: "Review sizing chart",
  },
];

export default function ReportMockup() {
  const { openModal } = useModal();

  return (
    <section className="border-b border-line/60">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            What you actually get
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl">
            One Page. Four Leaks. Zero Guesswork.
          </h2>
          <p className="mt-3 text-gray-400">
            This is a real preview of the embedded report — not a 50-tab
            dashboard you have to learn.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="glass-panel overflow-hidden rounded-2xl shadow-2xl shadow-black/40"
        >
          {/* Polaris-style top bar */}
          <div className="flex items-center justify-between border-b border-line bg-[#111827] px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Store className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
              Store: <span className="text-white">UrbanAesthetic.myshopify.com</span>
              <span className="text-gray-600">— Cash Leak Audit</span>
            </div>
            <span className="hidden rounded-full border border-line px-2.5 py-1 text-[11px] text-gray-500 sm:inline-block">
              Refreshed 4 min ago
            </span>
          </div>

          {/* Red total banner */}
          <div className="flex flex-col items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-6 py-6 text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-red-400">
              Total Identified Leaks
            </span>
            <div className="flex items-center gap-3">
              {/*
                LOTTIE SLOT #4 — "report-leak-icon"
                Still open. The 4 Lotties received so far (a scanning
                matrix, a person-with-chart, and a green success
                checkmark) don't fit this spot semantically — this banner
                is a red "problem found" alert, and a green checkmark here
                would read as the opposite signal. Best fit is a coin-drip
                / money-leaving animation. Once you have one:
                  <LottieSlot animationData={leakIconAnimation} fallback={null} className="h-8 w-8" />
                fallback stays null until then — the number alone carries
                this moment fine on its own.
              */}
              <LottieSlot fallback={null} />
              <span className="font-mono text-4xl font-bold text-red-400 sm:text-5xl">
                $847.00{" "}
                <span className="text-lg font-medium text-red-400/70">
                  / month
                </span>
              </span>
            </div>
          </div>

          {/* Leak cards */}
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
            {LEAK_CARDS.map((card, i) => (
              <div
                key={card.title}
                className="rounded-xl border border-line bg-ink p-4"
              >
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <IconTile icon={card.icon} tone="amber" size="md" className="mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Leak {i + 1}
                      </p>
                      <p className="text-sm font-semibold leading-snug text-white">
                        {card.title}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-gray-500">
                  {card.detail}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-amber-400">
                    {card.amount}
                  </span>
                  <button className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20">
                    {card.fix}
                    <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Green footer */}
          <div className="flex flex-col items-center gap-3 border-t border-emerald-500/20 bg-emerald-500/10 px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={1.75} />
              <span className="font-mono text-base font-bold text-emerald-400">
                Money You Can Recover Today: $847.00/mo
              </span>
            </div>
            <button
              onClick={openModal}
              className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-5 py-2.5 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400"
            >
              Get My Real Report →
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
