"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, Store } from "lucide-react";
import { useModal } from "./ModalProvider";

export default function Header() {
  const { openModal } = useModal();

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-40 border-b border-line/80 bg-ink/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 fill-emerald-500 text-emerald-500" />
          <span className="text-sm font-bold tracking-tight text-white sm:text-base">
            LeakAudit <span className="text-gray-500">for Shopify</span>
          </span>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Badge icon={<Store className="h-3 w-3" />} label="Shopify App Store Partner" />
          <Badge
            icon={<ShieldCheck className="h-3 w-3" />}
            label="100% Read-Only & Secure"
          />
        </div>

        <button
          onClick={openModal}
          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-emerald-400 sm:px-4 sm:text-sm"
        >
          Check My Store (Free)
        </button>
      </div>
    </motion.header>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-[11px] font-medium text-gray-400">
      {icon}
      {label}
    </div>
  );
}
