"use client";

import { buildInstallUrl, sanitizeShopDomain } from "@/lib/utils";
import { useState } from "react";

// Replaces the old "open the waitlist modal" fake-door flow. The
// production app on Fly.io is live, so this routes a merchant straight
// into the real Shopify OAuth install — no email capture, no queue
// position, no waiting.
export default function InstallForm({
  inputClassName,
  buttonClassName,
  buttonLabel = "⚡ Install Free Founder Beta ↗",
  placeholder = "your-store.myshopify.com",
  stacked = false,
}: {
  inputClassName?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  placeholder?: string;
  stacked?: boolean;
}) {
  const [shop, setShop] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sanitized = sanitizeShopDomain(shop);
    if (!sanitized) {
      setError("Enter a valid store domain, e.g. your-store.myshopify.com");
      return;
    }
    setError(null);
    window.location.href = buildInstallUrl(sanitized);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        stacked ? "flex flex-col gap-2.5" : "flex flex-col gap-2.5 sm:flex-row"
      }
    >
      <input
        type="text"
        required
        value={shop}
        onChange={(e) => {
          setShop(e.target.value);
          if (error) setError(null);
        }}
        placeholder={placeholder}
        aria-label="Shop domain"
        className={inputClassName}
      />
      <button type="submit" className={buttonClassName}>
        {buttonLabel}
      </button>
      {error && <p className="text-xs text-red-400 sm:basis-full">{error}</p>}
    </form>
  );
}
