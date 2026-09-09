"use client";

import { motion } from "framer-motion";
import { MousePointerClick, ShieldCheck } from "lucide-react";
import InstallForm from "./InstallForm";
import RadarScan from "./RadarScan";

// Large ambient background rings, pure CSS (Tailwind's animate-ping),
// replacing what used to be a lottie-react animation here. That Lottie
// JSON itself was tiny (39KB, 3 layers) and fetched async/non-blocking,
// so it was never really "starving the main thread" -- but lottie-react +
// lottie-web are a genuinely heavy dependency to ship just for ambient
// texture, and removing them from Hero's client bundle does shave real
// weight off the JS this section needs before it hydrates. Zero network
// fetch, zero JS execution cost, runs entirely on the compositor thread.
function RadarBackdrop() {
  const rings = [0, 1, 2, 3];
  return (
    <div className="relative flex h-[480px] w-[480px] items-center justify-center sm:h-[640px] sm:w-[640px]">
      {rings.map((i) => (
        <span
          key={i}
          className="absolute rounded-full border border-emerald-500/25 bg-emerald-500/[0.03] animate-ping"
          style={{
            height: `${22 + i * 20}%`,
            width: `${22 + i * 20}%`,
            animationDelay: `${i * 700}ms`,
            animationDuration: "3.5s",
          }}
        />
      ))}
      <span className="absolute h-[8%] w-[8%] rounded-full bg-emerald-400/60 blur-[2px]" />
    </div>
  );
}

export default function Hero() {
  return (
    <section className="mesh-bg relative overflow-hidden border-b border-line/60">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-24 h-[380px] w-[560px] rounded-full bg-cyan-500/[0.06] blur-[110px]" />

      {/*
        Ambient background texture. Used to be a Lottie animation
        (public/lottie/hero-scan.json) — swapped for a pure-CSS pulsing
        radar so this section carries zero extra JS weight or network
        fetch on the path to becoming interactive.
      */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.16] [mask-image:radial-gradient(ellipse_85%_80%_at_50%_35%,#000_45%,transparent_92%)] sm:opacity-[0.22]">
        <RadarBackdrop />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400"
        >
          <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-red-500" />
          The Average $50K/mo Shopify Store Loses{" "}
          <span className="font-mono font-medium">$847/mo</span> to Silent Leaks
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-balance font-display text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-6xl"
        >
          Find the{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text font-mono italic text-transparent">
            $400–$1,200
          </span>
          /Month Your Shopify Store Is Leaking. In 60 Seconds.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-5 max-w-2xl text-balance text-base text-gray-400 sm:text-lg"
        >
          No 2-hour onboarding. No manual spreadsheets. No order-volume price
          penalties. Connect your store and see your 1-page Cash Leak Report
          before your coffee gets cold.
        </motion.p>

        {/*
          Deliberately a plain div, NOT motion.div. Everything else in this
          section fades in via framer-motion's initial={{opacity:0}} ->
          animate={{opacity:1}}, which server-renders at opacity:0 and only
          flips once React hydrates client-side. Verified directly against
          the live production build: the fade-in wrapper this used to be
          sat at computed opacity:0 for a real, multi-second window after
          document.readyState was already "complete" -- i.e. the shop-input
          CTA was invisible and effectively unusable until hydration caught
          up, independent of the Lottie/JSON question raised separately.
          This is the one interactive element on the page, so it always
          renders at full opacity and is clickable/focusable from first
          paint, decorative fade-ins or not.
        */}
        <div className="mt-9 flex flex-col items-center gap-3">
          <div className="w-full max-w-md">
            <InstallForm
              inputClassName="w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none sm:flex-1"
              buttonClassName="flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-6 py-3.5 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-10px_rgba(16,185,129,0.45)] transition-all hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.98]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              Zero credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              Read-only access
            </span>
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5" strokeWidth={1.75} />
              1-click uninstall
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-panel mx-auto mt-12 flex w-fit items-center gap-3 rounded-full px-5 py-3"
        >
          <RadarScan label="Scanning your store's revenue..." />
        </motion.div>
      </div>
    </section>
  );
}
