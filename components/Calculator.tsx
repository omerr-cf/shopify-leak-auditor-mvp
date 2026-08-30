"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Package, Ghost, RotateCcw } from "lucide-react";
import { estimateLeaks, formatUSD } from "@/lib/utils";
import { useModal } from "./ModalProvider";
import AnimatedNumber from "./AnimatedNumber";

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
      icon: <CreditCard className="h-4 w-4" />,
      emoji: "💳",
      label: "Hidden FX & Gateway Markup",
      value: leaks.fxLeak,
    },
    {
      icon: <Package className="h-4 w-4" />,
      emoji: "📦",
      label: "Negative-Margin / Shipping Variances",
      value: leaks.marginShippingLeak,
    },
    {
      icon: <Ghost className="h-4 w-4" />,
      emoji: "👻",
      label: "Abandoned App Scripts & Bloat",
      value: leaks.bloatLeak,
    },
    {
      icon: <RotateCcw className="h-4 w-4" />,
      emoji: "🔄",
      label: "Refund Drift & Chargeback Slippage",
      value: leaks.refundLeak,
    },
  ];

  return (
    <section id="calculator" className="border-b border-line/60 bg-panel/40">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Try it yourself
          </span>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            What Is Your Store Actually Leaking?
          </h2>
          <p className="mt-3 text-gray-400">
            Drag the sliders to match your store. This is a rough estimate —
            your real audit connects live data and gets specific.
          </p>
        </div>

        <div className="grid gap-8 rounded-2xl border border-line bg-panel p-6 shadow-xl shadow-black/20 sm:p-8 lg:grid-cols-2 lg:gap-12">
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
          <div className="flex flex-col justify-center rounded-xl border border-line bg-ink p-6 sm:p-8">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-500">
              Estimated Monthly Cash Leak
            </p>
            <div className="my-3 text-center">
              <span className="bg-gradient-to-b from-red-400 to-amber-400 bg-clip-text text-5xl font-extrabold text-transparent drop-shadow-[0_0_30px_rgba(239,68,68,0.25)] sm:text-6xl">
                ~$
                <AnimatedNumber
                  value={leaks.total}
                  formatter={(n) => Math.round(n).toLocaleString("en-US")}
                />
              </span>
              <span className="ml-1 text-lg font-semibold text-gray-500">
                /mo
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-line/70 bg-panel px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm text-gray-300">
                    <span aria-hidden>{row.emoji}</span>
                    {row.label}
                  </span>
                  <span className="text-sm font-semibold text-white">
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
              className="mt-6 w-full rounded-lg bg-emerald-500 py-3.5 text-sm font-bold text-ink transition hover:bg-emerald-400"
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
        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-sm font-bold text-emerald-400">
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
