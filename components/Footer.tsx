import { PRODUCTION_APP_ROOT_URL } from "@/lib/utils";
import Logomark from "./Logomark";

export default function Footer() {
  return (
    <footer className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-gray-600 sm:flex-row">
        <div className="flex items-center gap-1.5">
          <Logomark className="h-4 w-4" muted />
          LeakAudit for Shopify
        </div>
        <p>
          Read-only Shopify Admin API access only. We never touch your ad spend
          or your money.
        </p>
        <a
          href={PRODUCTION_APP_ROOT_URL}
          className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-400"
        >
          🛍️ Get LeakAudit Free
        </a>
        <p>&copy; {new Date().getFullYear()} LeakAudit. All rights reserved.</p>
      </div>
    </footer>
  );
}
