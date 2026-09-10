"use client";

import { estimateLeaks, formatUSD } from "@/lib/utils";
import {
  Code2,
  CreditCard,
  Ghost,
  Package,
  RotateCcw,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import AnimatedNumber from "./AnimatedNumber";
import IconTile from "./IconTile";
import InstallForm from "./InstallForm";
import LottieSlot from "./LottieSlot";

// Manually update this as real Founder Beta installs come in -- there is
// no live counter wired to the production app's install count (separate
// repo/host), so this is a hand-maintained number, not a computed one.
const FOUNDER_BETA_SPOTS_REMAINING = 14;
const FOUNDER_BETA_TOTAL_SPOTS = 20;

export default function Calculator() {
  const [revenue, setRevenue] = useState(50000);
  const [apps, setApps] = useState(12);
  const [crossBorderShare, setCrossBorderShare] = useState(20);

  const leaks = useMemo(
    () => estimateLeaks({ revenue, apps, crossBorderShare }),
    [revenue, apps, crossBorderShare],
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
      className="mesh-bg relative overflow-hidden border-b border-line/60"
    >
      {/*
        LOTTIE SLOT #2 — "calc-radar" (background placement)
        Live: public/lottie/calc-radar.json — a figure working through a
        chart. Faded and bled off the left edge of the section so it reads
        as ambient background texture behind the calculator, not a literal
        icon. Hidden below lg: at narrower widths there's no spare room for
        a background flourish next to the calculator card without it
        competing with the sliders.
      */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[560px] items-center overflow-hidden opacity-[0.13] [mask-image:linear-gradient(to_right,#000_35%,transparent_92%)] lg:flex xl:w-[680px]">
        <LottieSlot
          src="/lottie/calc-radar.json"
          fallback={null}
          className="-ml-24 w-[520px] max-w-none xl:w-[640px]"
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Try it yourself
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
            What Is Your Store Actually Leaking?
          </h2>
          <p className="mt-3 leading-relaxed text-gray-400">
            Drag the sliders to match your store. This is a rough estimate —
            your real audit connects live data and gets specific.
          </p>
        </div>

        {/* Founder Beta status indicator */}
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-gray-400 backdrop-blur-md">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>
            <span className="font-semibold text-emerald-400">
              🟢 Live Engine
            </span>{" "}
            • Founder Beta: 100% Free Lifetime Access for the First{" "}
            {FOUNDER_BETA_TOTAL_SPOTS} Stores ({FOUNDER_BETA_SPOTS_REMAINING}{" "}
            spots remaining)
          </span>
        </div>

        {/* 4 audit vectors -- ungated summary, distinct from the gated
            numeric breakdown further down in the output panel */}
        <div className="mx-auto mb-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              icon: <CreditCard />,
              tone: "emerald" as const,
              title: "Hidden FX & Gateway Drag",
              subtitle: "1.8% average markup",
            },
            {
              icon: <Code2 />,
              tone: "cyan" as const,
              title: "Leftover Theme App Scripts",
              subtitle: "Uninstalled bloat",
            },
            {
              icon: <TrendingDown />,
              tone: "amber" as const,
              title: "Negative-Margin SKUs",
              subtitle: "Post-shipping loss",
            },
            {
              icon: <RotateCcw />,
              tone: "rose" as const,
              title: "Silent Return Rate Drift",
              subtitle: "",
            },
          ].map((vector) => (
            <div
              key={vector.title}
              className="glass-panel flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-4 text-center transition-colors duration-300 hover:border-white/[0.16]"
            >
              <IconTile icon={vector.icon} tone={vector.tone} size="md" />
              <span className="text-xs font-semibold leading-tight text-white">
                {vector.title}
              </span>
              {vector.subtitle && (
                <span className="text-[11px] leading-tight text-gray-400">
                  {vector.subtitle}
                </span>
              )}
            </div>
          ))}
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
            <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400">
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

            {/* Breakdown — ungated. This used to sit blurred behind a
                separate email-unlock form stacked on top of the install
                form below (two competing CTAs on the same card). That
                email-gate overlay was also the confirmed root cause of a
                real click-through bug: it was position:absolute inside a
                fixed-height container, its actual content ran taller than
                that container, and the overflow silently sat on top of
                whatever rendered after it (z-index:auto still paints above
                normal in-flow siblings). Simplest fix that also resolves
                the click bug: one honest breakdown, one CTA. */}
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
                    ~
                    <AnimatedNumber
                      value={row.value}
                      formatter={(n) => Math.round(n).toLocaleString("en-US")}
                    />
                    /mo
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <InstallForm
                stacked
                buttonLabel="⚡ Reveal & Audit My Store Leaks (Free) ↗"
                inputClassName="min-h-[48px] w-full rounded-lg border border-white/[0.1] bg-black/30 px-3.5 py-3 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                buttonClassName="min-h-[48px] w-full rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.98]"
              />
            </div>
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
