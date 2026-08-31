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
          Read-only Shopify Admin API access only. We never touch your ad
          spend or your money.
        </p>
        <p>&copy; {new Date().getFullYear()} LeakAudit. All rights reserved.</p>
      </div>
    </footer>
  );
}
