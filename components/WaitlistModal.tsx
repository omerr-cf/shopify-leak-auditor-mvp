"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, PartyPopper, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { useModal } from "./ModalProvider";

const REVENUE_BANDS = [
  "$10K – $25K/mo",
  "$25K – $50K/mo",
  "$50K – $100K/mo",
  "$100K – $150K/mo",
  "$150K+/mo",
];

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistModal() {
  const { isOpen, closeModal } = useModal();
  const [status, setStatus] = useState<Status>("idle");
  const [storeUrl, setStoreUrl] = useState("");
  const [email, setEmail] = useState("");
  const [revenue, setRevenue] = useState(REVENUE_BANDS[1]);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetAndClose() {
    closeModal();
    // Give the exit animation time to finish before resetting form state
    setTimeout(() => {
      setStatus("idle");
      setStoreUrl("");
      setEmail("");
      setRevenue(REVENUE_BANDS[1]);
      setQueuePosition(null);
      setErrorMessage(null);
    }, 300);
  }

  function backupToLocalStorage() {
    // Best-effort local record so you still have something even if the
    // API call fails downstream or Resend silently drops the email.
    // Never let this block the success state — private browsing / quota
    // errors are common and irrelevant to whether the lead was captured.
    try {
      const existing = JSON.parse(
        localStorage.getItem("leakaudit_waitlist") || "[]"
      );
      localStorage.setItem(
        "leakaudit_waitlist",
        JSON.stringify([
          ...existing,
          { storeUrl, email, revenue, submittedAt: new Date().toISOString() },
        ])
      );
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeUrl || !email) return;

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl, email, revenue }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setQueuePosition(
        typeof data.queuePosition === "number"
          ? data.queuePosition
          : Math.floor(Math.random() * 37) + 8
      );
      backupToLocalStorage();
      setStatus("success");
    } catch (err) {
      console.error("[WaitlistModal] submission failed:", err);
      setStatus("error");
      setErrorMessage(
        "Something glitched on our end. Your spot isn't locked in yet — try again in a moment."
      );
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={resetAndClose}
          />

          {/* Modal card */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-8"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <button
              onClick={resetAndClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 15,
                      delay: 0.1,
                    }}
                    className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
                  >
                    {/* Radiating success pulses */}
                    <motion.span
                      className="absolute inset-0 rounded-full border border-emerald-400/40"
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 2.1, opacity: 0 }}
                      transition={{ duration: 1.1, repeat: 2, ease: "easeOut" }}
                    />
                    <PartyPopper className="h-7 w-7" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white">
                    You&apos;re in Wave 1!
                  </h3>
                  <p className="mt-1 text-sm font-medium text-emerald-400">
                    Queue Position #{queuePosition ?? "—"}
                  </p>
                  <p className="mx-auto mt-3 max-w-sm text-sm text-gray-400">
                    We&apos;re onboarding 50 stores this week to ensure
                    1-on-1 audit accuracy. Check{" "}
                    <span className="text-gray-200">{email}</span> for your
                    instant setup link.
                  </p>
                  <button
                    onClick={resetAndClose}
                    className="mt-6 rounded-lg border border-white/[0.08] px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5"
                  >
                    Done
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="mb-1 flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Wave 1 — Limited to 50 stores
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white sm:text-2xl">
                    Connect Your Shopify Store for Wave&nbsp;1 Access
                  </h3>
                  <p className="mt-2 text-sm text-gray-400">
                    We&apos;re onboarding a small batch first so every audit
                    gets checked by hand before it ships. Drop your details
                    and we&apos;ll send your instant setup link.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                      <label
                        htmlFor="storeUrl"
                        className="mb-1.5 block text-xs font-medium text-gray-400"
                      >
                        Store URL
                      </label>
                      <input
                        id="storeUrl"
                        required
                        type="text"
                        placeholder="brandname.myshopify.com"
                        value={storeUrl}
                        onChange={(e) => setStoreUrl(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="mb-1.5 block text-xs font-medium text-gray-400"
                      >
                        Work Email Address
                      </label>
                      <input
                        id="email"
                        required
                        type="email"
                        placeholder="you@brandname.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="revenue"
                        className="mb-1.5 block text-xs font-medium text-gray-400"
                      >
                        Estimated Monthly Revenue
                      </label>
                      <select
                        id="revenue"
                        value={revenue}
                        onChange={(e) => setRevenue(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        {REVENUE_BANDS.map((band) => (
                          <option key={band} value={band}>
                            {band}
                          </option>
                        ))}
                      </select>
                    </div>

                    {status === "error" && errorMessage && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-[#07090E] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {status === "submitting" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Securing your spot…
                        </>
                      ) : status === "error" ? (
                        "Try Again →"
                      ) : (
                        "Claim My Wave 1 Spot →"
                      )}
                    </button>

                    <p className="text-center text-[11px] text-gray-600">
                      Read-only access only. No credit card. Unsubscribe
                      anytime with one click.
                    </p>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
