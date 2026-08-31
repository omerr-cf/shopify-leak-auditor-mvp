"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Store } from "lucide-react";
import { useModal } from "./ModalProvider";
import Logomark from "./Logomark";
import IconTile from "./IconTile";

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
        <div className="flex items-center gap-2.5">
          <Logomark className="h-8 w-8 shrink-0 drop-shadow-[0_2px_8px_rgba(16,185,129,0.35)]" />
          <span className="font-display text-[15px] font-medium italic tracking-tight text-white sm:text-base">
            LeakAudit <span className="text-gray-500">for Shopify</span>
          </span>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Badge icon={<Store />} label="Shopify App Store Partner" />
          <Badge icon={<ShieldCheck />} label="100% Read-Only & Secure" />
        </div>

        <button
          onClick={openModal}
          className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-3.5 py-2 text-xs font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400 sm:px-4 sm:text-sm"
        >
          Check My Store (Free)
        </button>
      </div>
    </motion.header>
  );
}

function Badge({ icon, label }: { icon: React.ReactElement; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 text-[11px] font-medium text-gray-400">
      <IconTile icon={icon} tone="neutral" size="sm" className="!h-5 !w-5" />
      {label}
    </div>
  );
}
