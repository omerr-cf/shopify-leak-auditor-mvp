# LeakAudit for Shopify — Smoke Test Landing Page

A fake-door MVP landing page for "The 60-Second Net Profit & Cost Leak Auditor." Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide icons, and Geist.

## What this is

A single-page marketing/validation site with:

- An interactive leak calculator (client-side estimate, not a real audit) with a live-activity ticker and a radar-scan indicator
- A high-fidelity mockup of the real product's 1-page report
- A brutally honest comparison table vs. BeProfit/Lifetimely
- An objections FAQ (performance, security scope, pricing philosophy)
- A "Wave 1" waitlist modal that posts to `/api/lead`, which emails you the lead via Resend (or logs to console if you haven't set up Resend yet — the UI never breaks either way)

## Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Setting up real lead notifications (Resend)

1. Copy `.env.local.example` to `.env.local`.
2. Sign up at [resend.com](https://resend.com), verify a sending domain (you cannot send from a bare Gmail address — Resend requires a domain you control), and grab an API key.
3. Set `RESEND_API_KEY`, and optionally override `LEAD_NOTIFICATION_EMAIL` (defaults to `omerbussy1995@gmail.com` in code) and `LEAD_FROM_EMAIL`.
4. Until you do this, `app/api/lead/route.ts` still returns success to the client and logs the full lead payload to the server console — so the waitlist modal works and captures leads from day one, you just won't get the email alert until Resend is wired up.
5. Leads also get a best-effort backup written to `localStorage` (`leakaudit_waitlist`) client-side, purely as a redundant local record — the API response is the source of truth for the queue-position number shown to the merchant.

## Swapping in a real Lottie animation

`components/RadarScan.tsx` currently renders a pure-CSS pulsing radar dot (Tailwind's `animate-ping`) — zero extra weight, no external asset needed. `components/LottieSlot.tsx` is a ready slot for a real Lottie JSON if you want more polish later: export one from LottieFiles.com, drop it under `public/lottie/`, and pass it as `animationData` — see the comment at the top of that file for the exact usage.

## Notes on the calculator numbers

The leak estimator in `lib/utils.ts` (`estimateLeaks`) uses illustrative
multipliers calibrated so the *default* slider position ($50K revenue, 12
apps, 20% cross-border) lands on ~$860/mo — matching the hero's headline
claim. These are directional, not audited figures. Treat them as smoke-test
copy, not a promise you have to back with real methodology until the actual
product exists.

## Notes on the live-activity ticker and FAQ copy

The "19 Shopify stores scanned... $1.4M GMV analyzed" ticker and the FAQ's
"$49/mo flat" and "read-only OAuth scope" claims are all specific, checkable
statements. Keep them true in practice (update the ticker numbers as real
traffic comes in, and don't let the actual OAuth scopes drift from
read-only) — this project's own market research flagged trust-eroding,
unverifiable claims as the #1 reason merchants leave 1-star reviews on
competitor apps. Don't reproduce that failure mode here.
