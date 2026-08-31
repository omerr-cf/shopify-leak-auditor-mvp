"use client";

import { motion } from "framer-motion";
import { CreditCard, ShieldCheck, MousePointerClick } from "lucide-react";
import { useModal } from "./ModalProvider";
import RadarScan from "./RadarScan";
import LottieSlot from "./LottieSlot";

export default function Hero() {
  const { openModal } = useModal();

  return (
    <section className="mesh-bg relative overflow-hidden border-b border-line/60">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-24 h-[380px] w-[560px] rounded-full bg-cyan-500/[0.06] blur-[110px]" />

      {/*
        LOTTIE SLOT #1 — "hero-scan" (background placement)
        Live: public/lottie/hero-scan.json (recolored to the site's emerald
        palette). Sits behind all the hero copy, faded via opacity + a wide
        radial mask so it reads as ambient texture filling the section
        rather than a literal icon. Speed is slowed to 0.55x — the source
        file plays fast by default and reads jittery at this size.
        fallback is null — nothing renders until the fetch resolves, which
        is fine since it's a background flourish, not content.
      */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.16] [mask-image:radial-gradient(ellipse_85%_80%_at_50%_35%,#000_45%,transparent_92%)] sm:opacity-[0.22]">
        <LottieSlot
          src="/lottie/hero-scan.json"
          fallback={null}
          speed={0.55}
          className="w-[900px] max-w-none sm:w-[1200px] lg:w-[1500px] xl:w-[1700px]"
        />
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
          <span className="font-mono font-medium">$847/mo</span> to Silent
          Leaks
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-9 flex flex-col items-center gap-3"
        >
          <motion.button
            onClick={openModal}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-7 py-4 text-base font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-10px_rgba(16,185,129,0.45)] transition hover:from-emerald-300 hover:to-emerald-400"
          >
            <CreditCard className="h-5 w-5" strokeWidth={2} />
            Run 60-Second Store Audit — Free
          </motion.button>

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
        </motion.div>

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
