# LeakAudit for Shopify — Smoke Test Landing Page

A fake-door MVP landing page for "The 60-Second Net Profit & Cost Leak Auditor." Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, and Lucide icons.

## What this is

A single-page marketing/validation site with:

- An interactive leak calculator (client-side estimate, not a real audit)
- A high-fidelity mockup of the real product's 1-page report
- A brutally honest comparison table vs. BeProfit/Lifetimely
- A "Wave 1" waitlist modal that captures leads to `localStorage` (swap for a real API route once you have signal)

## Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Wiring up real lead capture later

`components/WaitlistModal.tsx` currently writes submissions to `localStorage` under
the key `leakaudit_waitlist`. To go live:

1. Create `app/api/waitlist/route.ts` that writes to Supabase/Postgres (or posts to a Google Sheet / Airtable via webhook for the fastest possible v0).
2. Replace the `localStorage.setItem(...)` block in `handleSubmit` with a `fetch("/api/waitlist", { method: "POST", body: JSON.stringify(lead) })` call.
3. Wire up a transactional email (Resend, Postmark) to actually send the "check your email" setup link referenced in the success state — right now that's a fake-door promise, so don't leave it dangling for more than a few days of collected leads.

## Notes on the calculator numbers

The leak estimator in `lib/utils.ts` (`estimateLeaks`) uses illustrative
multipliers calibrated so the *default* slider position ($50K revenue, 12
apps, 20% cross-border) lands on ~$860/mo — matching the hero's headline
claim. These are directional, not audited figures. Treat them as smoke-test
copy, not a promise you have to back with real methodology until the actual
product exists.
