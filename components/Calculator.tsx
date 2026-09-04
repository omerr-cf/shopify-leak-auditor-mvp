"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Package,
  Ghost,
  RotateCcw,
  Lock,
  Unlock,
  Flame,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { estimateLeaks, formatUSD } from "@/lib/utils";
import { useModal } from "./ModalProvider";
import AnimatedNumber from "./AnimatedNumber";
import LottieSlot from "./LottieSlot";
import IconTile from "./IconTile";

type UnlockStatus = "idle" | "submitting" | "error";

export default function Calculator() {
  const { openModal } = useModal();
  const [revenue, setRevenue] = useState(50000);
  const [apps, setApps] = useState(12);
  const [crossBorderShare, setCrossBorderShare] = useState(20);

  // Gated breakdown: the visitor always sees the big total, but the 4
  // category cards stay blurred behind a single-field email unlock. Cold
  // Meta traffic was bouncing because the full breakdown was free to see —
  // this turns "curiosity satisfied" into "curiosity satisfied only after
  // giving an email."
  const [unlocked, setUnlocked] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockStatus, setUnlockStatus] = useState<UnlockStatus>("idle");
  const [showUnlockToast, setShowUnlockToast] = useState(false);

  const leaks = useMemo(
    () => estimateLeaks({ revenue, apps, crossBorderShare }),
    [revenue, apps, crossBorderShare]
  );

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockEmail || unlockStatus === "submitting") return;

    setUnlockStatus("submitting");

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: unlockEmail,
          estimatedLeak: Math.round(leaks.total),
          revenue: `${formatUSD(revenue)}/mo`,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setUnlocked(true);
      setUnlockStatus("idle");
      setShowUnlockToast(true);
      setTimeout(() => setShowUnlockToast(false), 5000);
    } catch (err) {
      console.error("[Calculator] unlock failed:", err);
      setUnlockStatus("error");
    }
  }

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

            {/* Unlock success toast */}
            <AnimatePresence>
              {showUnlockToast && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 flex items-center gap-2 overflow-hidden rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  Breakdown unlocked! We also sent a 1-page summary to your
                  email.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gated breakdown — blurred until unlocked with an email */}
            <div className="relative mt-4 min-h-[220px]">
              <div
                aria-hidden={!unlocked}
                className={`space-y-2.5 transition-all duration-700 ${
                  unlocked
                    ? "opacity-100 blur-0"
                    : "pointer-events-none select-none opacity-60 blur-[8px]"
                }`}
              >
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

              <AnimatePresence>
                {!unlocked && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center"
                  >
                    <IconTile icon={<Lock />} tone="emerald" size="lg" />
                    <p className="text-sm font-semibold text-white">
                      4 Critical Leak Vectors Detected in Your Range
                    </p>
                    <p className="max-w-[260px] text-xs leading-relaxed text-gray-400">
                      Enter your email below to instantly unblur and reveal
                      where your cash is leaking.
                    </p>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                      <Flame className="h-3 w-3 shrink-0" strokeWidth={2} />
                      38 store owners unlocked their audit this week
                    </div>

                    <form
                      onSubmit={handleUnlock}
                      className="mt-1 flex w-full max-w-xs flex-col gap-2"
                    >
                      <input
                        type="email"
                        required
                        placeholder="work@company.com"
                        value={unlockEmail}
                        onChange={(e) => setUnlockEmail(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={unlockStatus === "submitting"}
                        className="animate-pulse-glow flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 py-2.5 text-xs font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {unlockStatus === "submitting" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        Unlock My Breakdown (Instant)
                      </button>
                    </form>

                    {unlockStatus === "error" && (
                      <p className="text-[11px] text-red-400">
                        Something glitched — try again in a moment.
                      </p>
                    )}

                    <p className="text-[10px] text-gray-600">
                      🔒 Zero spam. Instant unblur. 1-click unsubscribe.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
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
