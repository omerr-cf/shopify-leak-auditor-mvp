"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, CreditCard, MousePointerClick } from "lucide-react";
import { useModal } from "./ModalProvider";

export default function Hero() {
  const { openModal } = useModal();

  return (
    <section className="mesh-bg relative overflow-hidden border-b border-line/60">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-24 h-[380px] w-[560px] rounded-full bg-cyan-500/[0.06] blur-[110px]" />

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pb-28 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400"
        >
          <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-red-500" />
          The Average $50K/mo Shopify Store Loses $847/mo to Silent Leaks
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl"
        >
          Find the{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
            $400–$1,200/Month
          </span>{" "}
          Your Shopify Store Is Leaking. In 60 Seconds.
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
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-emerald-500 px-7 py-4 text-base font-bold text-ink shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 animate-glow"
          >
            <Zap className="h-5 w-5 fill-ink" />
            Run 60-Second Store Audit — Free
          </motion.button>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Zero credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Read-only access
            </span>
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5" />
              1-click uninstall
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
