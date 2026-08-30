"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "Will this app slow down my storefront?",
    a: "Zero impact. We use 100% backend GraphQL API calls. No theme code is injected onto your customer-facing store.",
  },
  {
    q: "Can you change my prices or touch my ad spend?",
    a: "No. Our Shopify OAuth scope is strictly read-only. We cannot edit products, spend money, or alter configurations.",
  },
  {
    q: "Why is it a flat $49/mo instead of charging per order?",
    a: "Because we don't believe in punishing merchants for growing. The compute cost to check 5,000 orders is virtually the same as 500.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-b border-line/60">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Before you ask
          </span>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Common Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={item.q}
                className="glass-panel overflow-hidden rounded-xl"
              >
                <h3 className="m-0">
                  <button
                    id={`faq-header-${i}`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-white sm:text-base">
                      {item.q}
                    </span>
                    <Plus
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 text-emerald-400 transition-transform duration-200 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-header-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <p className="px-5 pb-4 text-sm leading-relaxed text-gray-400">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
