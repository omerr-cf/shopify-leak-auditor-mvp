"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Package, Ghost, RotateCcw } from "lucide-react";
import { estimateLeaks, formatUSD } from "@/lib/utils";
import { useModal } from "./ModalProvider";
import AnimatedNumber from "./AnimatedNumber";
import RadarScan from "./RadarScan";
import LottieSlot from "./LottieSlot";
import IconTile from "./IconTile";

export default function Calculator() {
  const { openModal } = useModal();
  const [revenue, setRevenue] = useState(50000);
  const [apps, setApps] = useState(12);
  const [crossBorderShare, setCrossBorderShare] = useState(20);

  const leaks = useMemo(
    () => estimateLeaks({ revenue, apps, crossBorderShare }),
    [revenue, apps, crossBorderShare]
  );

  const rows = [
    {
      icon: <CreditCard />,
      tone: "emerald" as const,
      label: "Hidden FX & Gateway Markup",
      value: leaks.fxLeak,
    },
    {
      icon: <Package />,
      tone: "amber" as const,
      label: "Negative-Margin / Shipping Variances",
      value: leaks.marginShippingLeak,
    },
    {
      icon: <Ghost />,
      tone: "cyan" as const,
      label: "Abandoned App Scripts & Bloat",
      value: leaks.bloatLeak,
    },
    {
      icon: <RotateCcw />,
      tone: "red" as const,
      label: "Refund Drift & Chargeback Slippage",
      value: leaks.refundLeak,
    },
  ];

  return (
    <section
      id="calculator"
      className="mesh-bg relative border-b border-line/60"
    >
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Try it yourself
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl">
            What Is Your Store Actually Leaking?
          </h2>
          <p className="mt-3 text-gray-400">
            Drag the sliders to match your store. This is a rough estimate —
            your real audit connects live data and gets specific.
          </p>
        </div>

        {/* Live activity ticker (social proof) */}
        <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-gray-400 backdrop-blur-md">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>
            <span className="font-semibold text-emerald-400">
              Live Engine Active
            </span>{" "}
            •{" "}
            <span className="font-mono">19</span> Shopify stores scanned in
            the last 24 hours (<span className="font-mono">$1.4M</span> GMV
            analyzed)
          </span>
        </div>

        {/*
          LOTTIE SLOT #2 — "calc-radar"
          Live: public/lottie/calc-radar.json — a small figure working
          through a chart, playing on loop while the merchant drags sliders.
        */}
        <div className="mb-8 flex justify-center">
          <LottieSlot
            src="/lottie/calc-radar.json"
            fallback={<RadarScan />}
            className="h-20 w-20 sm:h-24 sm:w-24"
          />
        </div>

        <div className="glass-panel grid gap-8 rounded-2xl p-6 shadow-xl shadow-black/30 sm:p-8 lg:grid-cols-2 lg:gap-12">
          {/* Inputs */}
          <div className="flex flex-col justify-center gap-8">
            <SliderInput
              label="Monthly Store Revenue"
              value={revenue}
              min={10000}
              max={250000}
              step={1000}
              onChange={setRevenue}
              display={formatUSD(revenue) + "/mo"}
            />
            <SliderInput
              label="Estimated Paid / Active Apps Installed"
              value={apps}
              min={3}
              max={30}
              step={1}
              onChange={setApps}
              display={`${apps} apps`}
            />
            <SliderInput
              label="International / Cross-Border Sales Share"
              value={crossBorderShare}
              min={0}
              max={50}
              step={1}
              onChange={setCrossBorderShare}
              display={`${crossBorderShare}%`}
            />
          </div>

          {/* Output */}
          <div className="glass-panel flex flex-col justify-center rounded-xl p-6 sm:p-8">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-500">
              Estimated Monthly Cash Leak
            </p>
            <div className="my-3 text-center">
              <span className="bg-gradient-to-b from-red-400 to-amber-400 bg-clip-text font-mono text-5xl font-bold text-transparent drop-shadow-[0_0_30px_rgba(239,68,68,0.25)] sm:text-6xl">
                ~$
                <AnimatedNumber
                  value={leaks.total}
                  formatter={(n) => Math.round(n).toLocaleString("en-US")}
                />
              </span>
              <span className="ml-1 font-mono text-lg font-medium text-gray-500">
                /mo
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2.5 text-sm text-gray-300">
                    <IconTile icon={row.icon} tone={row.tone} size="sm" />
                    {row.label}
                  </span>
                  <span className="font-mono text-sm font-semibold text-white">
                    ~<AnimatedNumber
                      value={row.value}
                      formatter={(n) => Math.round(n).toLocaleString("en-US")}
                    />
                    /mo
                  </span>
                </div>
              ))}
            </div>

            <motion.button
              onClick={openModal}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-6 w-full rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400"
            >
              Claim My Full Store Audit →
            </motion.button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-sm font-bold text-emerald-400">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--range-progress" as any]: `${progress}%` }}
      />
    </div>
  );
}
