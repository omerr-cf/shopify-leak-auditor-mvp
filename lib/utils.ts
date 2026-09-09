export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatUSD(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * Heuristic "leak" estimator used for the marketing-site calculator.
 * These are illustrative multipliers grounded in category benchmarks
 * (avg. FX/gateway markup, refund drift, and per-app ghost-subscription cost),
 * NOT a real audit — the real audit only exists once a store is connected.
 * The FX rate (1.8%) is kept in sync with the real production app's
 * documented rate and the badge-card copy in Calculator.tsx -- do not
 * change one without the other two.
 */
export function estimateLeaks(params: {
  revenue: number;
  apps: number;
  crossBorderShare: number; // 0-50
}) {
  const { revenue, apps, crossBorderShare } = params;

  const fxLeak = revenue * (crossBorderShare / 100) * 0.018;
  const marginShippingLeak = revenue * 0.0042;
  const bloatLeak = apps * 21.67;
  const refundLeak = revenue * 0.003;

  const total = fxLeak + marginShippingLeak + bloatLeak + refundLeak;

  return {
    fxLeak: Math.round(fxLeak),
    marginShippingLeak: Math.round(marginShippingLeak),
    bloatLeak: Math.round(bloatLeak),
    refundLeak: Math.round(refundLeak),
    total: Math.round(total),
  };
}

const PRODUCTION_APP_URL = "https://leakaudit-app.fly.dev";

/**
 * Normalizes whatever a merchant types into a real `*.myshopify.com` handle:
 * strips protocol, whitespace, and any path/query, then appends
 * `.myshopify.com` only if it's missing. So "my-shop", "my-shop.myshopify.com",
 * and "https://my-shop.myshopify.com/admin" all resolve the same way.
 * Returns "" for anything that doesn't look like a plausible shop handle.
 */
export function sanitizeShopDomain(input: string): string {
  let shop = input.trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, "");
  shop = shop.replace(/\/.*$/, "");
  shop = shop.replace(/^www\./, "");

  if (!shop) return "";
  if (!shop.endsWith(".myshopify.com")) {
    shop = `${shop}.myshopify.com`;
  }

  // Handle portion (before .myshopify.com) must be a plausible Shopify
  // handle: lowercase letters, digits, hyphens, not empty.
  const handle = shop.slice(0, -".myshopify.com".length);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(handle)) return "";

  return shop;
}

/**
 * Builds the URL that hands a sanitized shop domain straight to the live
 * production app's OAuth flow. This intentionally targets `/auth` (the
 * app's OAuth-initiation catch-all route), NOT `/auth/login` — `/auth/login`
 * is a separate manual "type your shop domain" form page in the app itself
 * that doesn't read a `shop` query param to pre-fill anything, so linking
 * there would just show the visitor a second, empty domain field to fill
 * in again. `/auth?shop=...` redirects straight into Shopify's real OAuth
 * authorize screen with no extra intermediate page.
 */
export function buildInstallUrl(sanitizedShop: string): string {
  return `${PRODUCTION_APP_URL}/auth?shop=${encodeURIComponent(sanitizedShop)}`;
}

export const PRODUCTION_APP_ROOT_URL = PRODUCTION_APP_URL;
