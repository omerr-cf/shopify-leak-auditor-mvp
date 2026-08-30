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
 * Heuristic "leak" estimator used purely for the fake-door calculator.
 * These are illustrative multipliers grounded in category benchmarks
 * (avg. FX/gateway markup, refund drift, and per-app ghost-subscription cost),
 * NOT a real audit — the real audit only exists once a store is connected.
 */
export function estimateLeaks(params: {
  revenue: number;
  apps: number;
  crossBorderShare: number; // 0-50
}) {
  const { revenue, apps, crossBorderShare } = params;

  const fxLeak = revenue * (crossBorderShare / 100) * 0.024;
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
