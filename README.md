# LeakAudit for Shopify — Smoke Test Landing Page

A fake-door MVP landing page for "The 60-Second Net Profit & Cost Leak Auditor." Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide icons, and Geist.

## What this is

A single-page marketing/validation site with:

- An interactive leak calculator (client-side estimate, not a real audit) with a live-activity ticker and a radar-scan indicator
- A high-fidelity mockup of the real product's 1-page report
- A brutally honest comparison table vs. BeProfit/Lifetimely
- An objections FAQ (performance, security scope, pricing philosophy)
- A "Wave 1" waitlist modal that posts to `/api/lead`, which durably persists every lead to Netlify Blobs *and* emails you a notification via Resend (email is best-effort on top of storage, not the source of truth — a lead is never lost just because an email didn't send)

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
5. Leads also get a best-effort backup written to `localStorage` (`leakaudit_waitlist`) client-side — purely a redundant, per-visitor local record, not something you can see. The real, durable record is Netlify Blobs (below).

## Where leads actually get stored (Netlify Blobs)

Every submission to `/api/lead` is written to a Netlify Blobs store named `leads` *before* the Resend email is even attempted — so a misconfigured API key, a 403 from Resend's sandbox restrictions, or a missed inbox never means a lost lead. The API response includes both `emailed` and `saved` booleans so you can tell which succeeded.

**Viewing captured leads:**
- Set `ADMIN_SECRET` in your environment (Netlify dashboard or `netlify env:set ADMIN_SECRET "something-long-and-random"`), then visit `https://your-site.netlify.app/api/leads?secret=YOUR_ADMIN_SECRET` for a JSON dump of every lead, newest first. The endpoint is disabled entirely (503) if `ADMIN_SECRET` isn't set — it never ships open by accident.
- Or via the CLI: `netlify blobs:list --store=leads` to see keys, `netlify blobs:get --store=leads --key=<key>` to read one.

**Local development caveat:** Netlify Blobs needs Netlify's own environment to authenticate. Plain `npm run dev` (`next dev`) can't reach it — `persistLead()` catches that and logs a warning instead of crashing the route, so the form still works locally, it just won't actually persist anything until you either run `netlify dev` instead, or test against the deployed site.

## Lottie animations

Three of the four marked Lottie slots are wired up and live, fetched
client-side from `public/lottie/` (never bundled into the page JS, so the
site stays light even with real animation assets):

- **Hero** (`hero-scan.json`) — a scanning-matrix animation, recolored to
  the site's emerald palette, next to "Scanning your store's revenue..."
- **Calculator** (`calc-radar.json`) — a small figure working through a
  chart, looping above the sliders
- **Waitlist success state** (`success-celebration.json`) — a
  checkmark + confetti burst, played once when a lead converts

The fourth slot, `components/ReportMockup.tsx` ("report-leak-icon", next to
the red total-leaks banner), is still open — none of the animations
received so far fit a "money leaking" moment without clashing with that
banner's red/alarm framing. See the comment at that slot for what to send.

`components/LottieSlot.tsx` is the shared component: pass `src="/lottie/x.json"`
and it fetches and renders full-motion, falling back to a CSS-only visual
(`components/RadarScan.tsx` or similar) if the fetch ever fails. To add a
new animation: export the JSON from LottieFiles.com, drop it under
`public/lottie/`, and pass its path as `src`.

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
