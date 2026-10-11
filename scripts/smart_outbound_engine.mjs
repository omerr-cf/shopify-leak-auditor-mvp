#!/usr/bin/env node
/**
 * smart_outbound_engine.mjs -- SMB Shopify lead discovery, qualification,
 * and (optionally) outreach.
 *
 * Shares its low-level utilities (fetch/timeout, HTML helpers, robots.txt
 * check, email extraction+blocklist, domain/title exclusion filters, the
 * contact-page prober) with find_shopify_stores.mjs via a plain ESM
 * `import` rather than duplicating ~400 already-tested lines into a
 * second file where the two copies could quietly drift apart. That
 * required one small change to find_shopify_stores.mjs: its `main()` call
 * is now guarded behind an "is this the entry module" check, so importing
 * it for its exports doesn't also kick off the whole DuckDuckGo scraper
 * as a side effect. Nothing about find_shopify_stores.mjs's own CLI
 * behavior changed.
 *
 * WHAT THIS DOES, IN ORDER
 * 1. Discovery: reads a domain list YOU curate (--seed-domains, same
 *    convention as find_shopify_stores.mjs), and/or queries a Google
 *    Search API with the same boutique-focused dorks -- Serper.dev
 *    (SERPER_API_KEY / --serper-key) and/or Brave Search
 *    (BRAVE_API_KEY / --brave-key). Both can be given at once (seed
 *    domains run first, then Serper, then Brave); added Brave as a
 *    second backend on 2026-09-10 after repeated Serper.dev signup
 *    failures (429/400 errors, Cloudflare Turnstile issues) blocked
 *    discovery entirely. Deliberately does NOT fall back to scraping
 *    DuckDuckGo's HTML endpoint -- that's the exact brittle/CAPTCHA'd
 *    approach this script exists to replace. find_shopify_stores.mjs is
 *    still there if you want that path.
 * 2. Qualification ("SMB avatar filter"): confirms the domain really
 *    runs Shopify, excludes obvious software/agency/App-Store noise
 *    (same filters as find_shopify_stores.mjs), then probes the public,
 *    unauthenticated `/products.json` endpoint every Shopify store
 *    exposes by default and keeps only stores reporting between
 *    PRODUCT_COUNT_MIN and PRODUCT_COUNT_MAX products -- a cheap proxy
 *    for "independent/boutique scale," not enterprise, not an empty/dead
 *    store.
 * 3. Personalization signal: checks the homepage for EUR/GBP/CAD/AUD
 *    currency-code tokens as a heuristic "this store sells cross-border"
 *    signal (hasCrossBorder). This is a text-presence check, not a real
 *    currency-selector-widget detector -- it can miss a JS-rendered
 *    switcher that isn't in the static HTML, and can in principle
 *    false-positive on an unrelated mention of one of those codes
 *    elsewhere on the page. Treat it as a heuristic signal, not a fact.
 * 4. Contact + draft: reuses find_shopify_stores.mjs's contact-page
 *    prober for a verified public email, then generates a subject/body
 *    templated on hasCrossBorder. The copy only asserts things actually
 *    checked for that store (multi-currency support is real if detected;
 *    it never invents a specific dollar figure for a store we have no
 *    financial data on -- that would be exactly the kind of fabricated
 *    stat this whole project has avoided elsewhere). Drafts also include
 *    a Founder Beta offer (FOUNDER_BETA_CAP stores, 100% free lifetime
 *    access for feedback + a review) confirmed directly by Omer on
 *    2026-09-10 -- automatically dropped from new drafts once the
 *    approximate slot count (see shouldIncludeFounderBeta()) looks used up.
 * 5. Output: qualified_smb_leads.json and .csv, in CUMULATIVE mode
 *    (2026-09-10, per Gemini) -- each run loads whatever's already in the
 *    output JSON, skips re-qualifying domains already present, and adds
 *    only genuinely new leads, so repeated runs grow one master list
 *    instead of overwriting it. Dedup happens at merge time (by domain),
 *    not via a literal file-append, since a blind append can't dedupe.
 *    CSV columns (reordered 2026-09-10 for faster manual review): [Shop
 *    URL, Email, Status, Personalized Subject, Personalized Body, Store
 *    Name, Product Count, Detected Leaks, Install Link] -- the things you
 *    actually need to eyeball a lead (the real store, who it goes to,
 *    whether it's already been sent, the exact copy) come first. Status
 *    defaults to "Pending" and flips to "Sent <ISO date>" the moment
 *    --send successfully delivers that lead (the actual send/no-send
 *    gate is still the separate already_contacted.json list below --
 *    this column is for human visibility, not the enforcement mechanism).
 * 6. Optional send via Resend, defaulting to --dry-run. See the block of
 *    comments above the --send handling in main() for what was added
 *    beyond the original spec and why -- short version: CAN-SPAM has real,
 *    legally required elements (a physical postal address, a working
 *    opt-out mechanism honored within 10 business days) that a bare
 *    "generate copy + fire it through an API" implementation would have
 *    silently skipped. Verified against the FTC's own CAN-SPAM compliance
 *    guide rather than assumed.
 *
 * USAGE
 *   node scripts/smart_outbound_engine.mjs --seed-domains domains.txt --limit 20
 *   node scripts/smart_outbound_engine.mjs --serper-key $SERPER_API_KEY --limit 20
 *   node scripts/smart_outbound_engine.mjs --brave-key $BRAVE_API_KEY --limit 20
 *   node scripts/smart_outbound_engine.mjs --seed-domains domains.txt --send   (after reviewing the dry-run output)
 *   node scripts/smart_outbound_engine.mjs --suppress someone@store.com        (opt-out utility)
 *   node scripts/smart_outbound_engine.mjs --follow-up                          (after --send, once 48h+ have passed)
 *   node scripts/smart_outbound_engine.mjs --selftest
 *
 * Same "run this from your own terminal, not from Claude's sandbox" note
 * as find_shopify_stores.mjs applies -- no general internet egress there.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Optional .env / .env.local auto-loading (2026-09-10, per Gemini) -- a
// convenience so Omer doesn't have to re-`export` RESEND_API_KEY and friends
// every new terminal session. Deliberately conservative: a key already set
// in the real shell environment always wins (this never overrides an
// explicit `export`), and it's a plain hand-rolled parser rather than
// pulling in the `dotenv` package, since this repo has no existing
// dependency-install step for it and a ~15-line parser doesn't need one.
// Only invoked from the CLI entrypoint below (isMainModule), not at
// import time, so importing this file for its exports elsewhere (as
// smart_outbound_engine.mjs itself does with find_shopify_stores.mjs)
// never has this side effect.
// ---------------------------------------------------------------------------
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

import {
  USER_AGENT,
  buildInstallLink,
  csvEscape,
  domainFromUrl,
  extractMetaDescription,
  extractRawTitle,
  extractStoreName,
  fetchWithTimeout,
  findContactEmail,
  hasExcludedKeyword,
  isExcludedByDomain,
  looksLikeShopify,
  sleep,
} from "./find_shopify_stores.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCT_COUNT_MIN = 8;
const PRODUCT_COUNT_MAX = 200;

// Founder Beta offer (2026-09-10, confirmed directly by Omer, not just
// relayed via Gemini -- a real, decided business policy, not copy
// embellishment): the first FOUNDER_BETA_CAP stores get 100% free
// lifetime access in exchange for honest feedback + an App Store review.
// Since this script has no signal from the app side about who actually
// installs/redeems, it approximates "slots remaining" from how many
// leads in the master list already show a "Sent ..." status (i.e.,
// already made this same promise) -- see shouldIncludeFounderBeta()
// below. That's a real limitation worth flagging as real signups start
// coming in: this counts emails promised, not seats actually claimed, so
// it can undercount how many are truly still available if some
// recipients never convert. Fine for a first batch of 5-10 well under
// the cap; worth tightening (e.g. a manually-maintained "beta seats
// claimed" count once real installs are trackable) as the count nears 20.
const FOUNDER_BETA_CAP = 20;

// Word-boundary matched against the homepage HTML -- a heuristic
// "sells cross-border" signal, not a guaranteed-accurate detector. See
// the module docstring's point 3.
const CROSS_BORDER_CURRENCY_CODES = ["EUR", "GBP", "CAD", "AUD"];

// 2026-09-10: "powered by shopify" + "contact us" + a niche word, with the
// exclusion baked directly into the query text (-site:shopify.com) rather
// than relying only on post-hoc filtering -- narrows what comes back
// before it's even fetched.
// Expanded from 5 to 11 niches (2026-09-14, per Gemini/Omer) as discovery
// scales toward 100+ stores -- kept the DEFAULT_DORK_QUERIES name rather
// than renaming to DEFAULT_NICHE_QUERIES as suggested, since it's already
// referenced by that name at the one call site below and a rename is
// pure churn with no behavior change.
const DEFAULT_DORK_QUERIES = [
  '"powered by shopify" "contact us" boutique clothing -site:shopify.com',
  '"powered by shopify" "contact us" boutique jewelry -site:shopify.com',
  '"powered by shopify" "contact us" boutique home decor -site:shopify.com',
  '"powered by shopify" "contact us" boutique fitness apparel -site:shopify.com',
  '"powered by shopify" "contact us" boutique skincare -site:shopify.com',
  '"powered by shopify" "contact us" boutique candles fragrance -site:shopify.com',
  '"powered by shopify" "contact us" boutique pet accessories -site:shopify.com',
  '"powered by shopify" "contact us" boutique leather goods bags -site:shopify.com',
  '"powered by shopify" "contact us" artisan coffee tea boutique -site:shopify.com',
  '"powered by shopify" "contact us" boutique baby kids clothing -site:shopify.com',
  '"powered by shopify" "contact us" boutique swimwear resortwear -site:shopify.com',
];

// 2026-10-11: discovery had dried up -- the 11 queries above only ever
// return the same ~110 domains, all already in the master list, so every
// repeat run found nothing new. These niches are physical-goods stores
// that ship orders (so shipping/fee/margin leaks are real for them), the
// sweet spot for LeakAudit. Combined with --pages (Serper result pages
// 2..N) this multiplies the candidate pool by ~15-30x. The product-count
// (8-200) and live-Shopify checks in qualifyDomain still apply to each.
const EXTRA_NICHES = [
  "organic supplements vitamins", "protein snacks", "gourmet hot sauce", "craft chocolate",
  "raw honey", "spices seasoning", "handmade soap", "natural deodorant",
  "haircare shampoo", "makeup cosmetics", "nail polish", "perfume fragrance oils",
  "mens grooming beard", "activewear yoga leggings", "streetwear hoodies", "socks",
  "hats caps beanies", "sunglasses", "watches", "wallets cardholders",
  "backpacks travel bags", "sneakers shoes", "sandals", "lingerie sleepwear",
  "plus size clothing", "maternity clothing", "wooden toys", "baby accessories",
  "dog collars leashes", "cat toys", "dog treats", "outdoor camping gear",
  "fishing gear", "hiking gear", "cycling accessories", "surf skate",
  "gaming accessories", "phone cases", "stationery desk accessories", "planners journals",
  "art prints posters", "wall art", "furniture", "rugs",
  "bedding linen", "kitchenware", "ceramics tableware", "plants planters",
  "garden tools", "knives cutlery", "water bottles tumblers", "essential oils diffusers",
  "incense crystals", "wedding party supplies", "gift sets", "embroidery patches",
  "yarn knitting", "fabric sewing supplies", "beads jewelry making", "board games puzzles",
  "lamps lighting", "car accessories", "yoga mats fitness equipment", "tea accessories",
];

function buildNicheQuery(niche) {
  return `"powered by shopify" "contact us" ${niche} -site:shopify.com`;
}

// Existing 11 first (page 2+ of them is new ground), then the new niches.
const ALL_DORK_QUERIES = [...DEFAULT_DORK_QUERIES, ...EXTRA_NICHES.map(buildNicheQuery)];

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_RATE_LIMIT_MS = 10_000;

// Minimum hours since the initial "Sent ..." before a lead is eligible for
// a follow-up touch (2026-09-14, per Gemini). Deliberately only a floor,
// not a 48-72h window with an upper bound -- if --follow-up isn't run on
// the exact day a lead crosses 72h, an upper cutoff would silently and
// permanently skip that lead's only follow-up rather than just sending it
// a bit later than ideal.
const FOLLOWUP_MIN_HOURS = 48;

const DEFAULT_OUTPUT_BASENAME = "qualified_smb_leads";
const DEFAULT_SUPPRESSION_LIST_PATH = "suppression_list.json";
const DEFAULT_CONTACTED_LIST_PATH = "already_contacted.json";
const DEFAULT_REJECTED_DOMAINS_PATH = "rejected_domains.json";

// ---------------------------------------------------------------------------
// Step 1: discovery (Serper.dev, or a curated seed-domains file)
// ---------------------------------------------------------------------------

/**
 * Calls the Serper.dev Google Search API. Verified against Serper's own
 * marketing page (2,500 free queries, no card required -- matches the
 * spec) and a widely-used open-source integration (LangChain's Serper
 * wrapper) for the actual request/response shape, since Serper's own
 * docs pages didn't render fetchable API reference content at write
 * time. `result.link` is that integration's field name for the URL --
 * flagged as the one part of this integration not independently
 * confirmed against Serper's raw JSON; the diagnostic logging below will
 * make it obvious immediately if that field name is wrong (0 URLs
 * extracted from a 200 response with a non-trivial body).
 */
async function searchSerper(query, apiKey, num = 10, page = 1) {
  const resp = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ q: query, num, ...(page > 1 ? { page } : {}) }),
  });
  const bodyText = await resp.text();
  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {
    // fall through with json = null, handled below
  }
  const organic = Array.isArray(json?.organic) ? json.organic : [];
  const urls = organic.map((r) => r?.link).filter((link) => typeof link === "string");

  console.log(
    `  [${query}${page > 1 ? ` (page ${page})` : ""}] Status: ${resp.status}, body length: ${bodyText.length} bytes, organic results: ${organic.length}, URLs: ${urls.length}`
  );
  if (!resp.ok) {
    console.warn(`  [warn] Serper returned HTTP ${resp.status} for ${JSON.stringify(query)}: ${bodyText.slice(0, 200)}`);
  } else if (organic.length === 0) {
    console.warn(
      `  [warn] Serper returned HTTP 200 but 0 organic results for ${JSON.stringify(
        query
      )} -- either a genuinely empty result set, or the response shape didn't match what this script expects (see the searchSerper() comment above).`
    );
  }

  return urls;
}

/**
 * Calls the Brave Search API. Verified directly against Brave's own API
 * docs (api-dashboard.search.brave.com/app/documentation/web-search) --
 * GET request, auth via the X-Subscription-Token header (not a bearer
 * token, not a query param), results under web.results[] with a `url`
 * field (Brave, unlike Serper's `.link`). Note on cost: Brave's free
 * tier (~$5/month credit, roughly 1,000 queries) DOES require a credit
 * card on file for identity verification -- it is not charged on the
 * free tier, but the card requirement is real, confirmed against
 * Brave's own pricing page (this corrects an earlier secondhand claim
 * that no card was needed).
 */
async function searchBrave(query, apiKey, num = 10) {
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(num));

  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
      "User-Agent": USER_AGENT,
    },
  });
  const bodyText = await resp.text();
  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {
    // fall through with json = null, handled below
  }
  const urls = extractBraveUrls(json);

  console.log(
    `  [${query}] Brave status: ${resp.status}, body length: ${bodyText.length} bytes, URLs: ${urls.length}`
  );
  if (!resp.ok) {
    console.warn(`  [warn] Brave returned HTTP ${resp.status} for ${JSON.stringify(query)}: ${bodyText.slice(0, 200)}`);
  } else if (urls.length === 0) {
    console.warn(
      `  [warn] Brave returned HTTP 200 but 0 URLs for ${JSON.stringify(
        query
      )} -- either a genuinely empty result set, or the response shape didn't match what this script expects (see extractBraveUrls() below).`
    );
  }

  return urls;
}

// Pulled out as its own pure function (unlike Serper's inline parsing)
// specifically so it's unit-testable in runSelftest() without a network
// call -- see the self-tests below.
function extractBraveUrls(json) {
  const results = Array.isArray(json?.web?.results) ? json.web.results : [];
  return results.map((r) => r?.url).filter((u) => typeof u === "string");
}

async function loadSeedDomains(path) {
  const text = await readFile(path, "utf-8");
  return text
    .split(/\r?\n/)
    .map((line) => line.split("#")[0].trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Step 2: SMB avatar qualification
// ---------------------------------------------------------------------------

/**
 * Probes the public, unauthenticated /products.json endpoint every
 * default Shopify storefront exposes. Returns a product count, or null
 * if it couldn't be determined (endpoint disabled, password-protected
 * dev store, non-JSON response, network error) -- null is treated as
 * "can't verify avatar fit" by the caller, not as "0 products".
 *
 * FIXED 2026-09-10 (real bug, caught from live output): without an
 * explicit `limit` param this endpoint defaults to Shopify's standard
 * page size of 30 -- which is exactly why every qualified store in the
 * first production run showed suspiciously exactly "30 products"
 * regardless of its real catalog size (the one store with fewer, 21,
 * showed its true count, because its whole catalog fit under the
 * default page). Now explicitly requests `?limit=250` (the endpoint's
 * max) so productCount reflects the real count for any store with under
 * 250 products. Shopify still caps at 250 with no pagination here, so a
 * store above that cap reports 250 (true count unknown, could be
 * higher) -- doesn't cause an incorrect PASS/FAIL, since PRODUCT_COUNT_MAX
 * is 200 and 250 already correctly fails the "under 200" check.
 */
async function fetchProductCount(domain) {
  try {
    const resp = await fetchWithTimeout(`https://${domain}/products.json?limit=250`);
    if (!resp.ok) return null;
    const json = await resp.json();
    return Array.isArray(json?.products) ? json.products.length : null;
  } catch {
    return null;
  }
}

function isQualifiedProductCount(count) {
  return typeof count === "number" && count >= PRODUCT_COUNT_MIN && count <= PRODUCT_COUNT_MAX;
}

function detectCrossBorder(html) {
  return CROSS_BORDER_CURRENCY_CODES.some((code) => new RegExp(`\\b${code}\\b`).test(html));
}

// ---------------------------------------------------------------------------
// Step 3: personalized draft generation
//
// CAN-SPAM (verified against the FTC's own compliance guide, not
// assumed): no prior consent is legally required to send commercial
// email, BUT every message needs (a) a valid physical postal address,
// (b) a clear opt-out mechanism honored within 10 business days, and
// (c) a non-deceptive subject line. All three are baked into every
// generated draft below, in BOTH dry-run and --send output -- so the
// files Omer reviews before sending show the actual final compliant
// copy, not a stripped preview.
//
// Every claim in these templates is either something this script
// actually verified for that specific store (multi-currency support,
// if hasCrossBorder is true) or a general/qualitative statement -- never
// a fabricated specific dollar figure for a store whose real financials
// this script has no access to.
// ---------------------------------------------------------------------------

// 2026-09-10 (per Gemini's "Outbound Email Polish" ticket): reworked the
// CTA into an arrow-led standalone line and added a named sign-off.
// Also omitted a specific "$400-$1,200/year in silent margin leaks" stat
// from that same ticket -- there is no real usage data behind that number
// for this store or any store this script has actually scanned, and
// inventing a precise dollar range to put in front of a real business
// owner is exactly the kind of fabricated stat this project has refused
// elsewhere (see the module docstring, point 4).
//
// 2026-09-10 (later same day): added the Founder Beta line
// (FOUNDER_BETA_CAP stores, 100% free lifetime access, in exchange for
// feedback + an App Store review) after Omer confirmed directly -- not
// just relayed via Gemini -- that this is an actual, decided policy with
// exactly those terms. `includeFounderBeta` is computed by the caller
// (see shouldIncludeFounderBeta()) so the claim stops being made once the
// approximate slot count is exhausted, rather than being unconditionally
// true forever.
// 2026-09-10 (later still): the footer hardcodes a "LeakAudit" brand line
// above the physical address, but Omer's actual SENDER_PHYSICAL_ADDRESS
// value ALSO starts with "LeakAudit," (he included the brand name in the
// address itself), so the footer was rendering "LeakAudit\nLeakAudit, P.O.
// Box ...", visibly duplicated. Rather than assume everyone will always
// set the env var one particular way, this strips a redundant leading
// "LeakAudit" from whatever's passed in before rendering -- so the footer
// is correct however the address happens to be formatted.
function stripRedundantBrandPrefix(address) {
  return String(address ?? "").replace(/^\s*leakaudit\s*[,:-]?\s*/i, "").trim();
}

// 2026-09-10 (per Gemini): first-name personalization from the contact
// email's local part. Deliberately conservative about what counts as "a
// name" -- a wrong guess here (misreading a role alias as a person, or
// mangling a firstname.lastname address) reads as sloppier and more
// obviously mass-scraped than just saying "team", which defeats the
// point.
//
// FIRST DRAFT of this (same day) used a blocklist approach -- exclude a
// known-generic list, then accept ANY single alphabetic word as a
// plausible name. Ran it against Omer's real 36-lead list before shipping
// and it immediately misfired: local parts like "curvyexchangedept",
// "fireflyjewelers", "swfhomesweethome", and "serviceweborders" are all a
// single alphabetic token with no separator, so they all "passed" and
// would have gone out as "Hi Curvyexchangedept," / "Hi Fireflyjewelers,"
// -- exactly the kind of guess that's worse than just saying "team".
// Blocking each bad pattern as it's found is whack-a-mole; there's no
// finite blocklist of "things that aren't names."
//
// Switched to the opposite approach: an ALLOWLIST of common first names.
// This only ever fires on a high-confidence match, so an uncommon-but-real
// name this list doesn't happen to cover just falls back to the safe
// "team" greeting (a missed personalization, never a wrong guess) -- the
// right tradeoff here, since the cost of a false positive (looking like a
// scraper that can't tell a business alias from a person) is much higher
// than the cost of a false negative (one less "Hi Heather," than possible).
const GENERIC_EMAIL_LOCAL_PARTS = new Set([
  "info", "support", "contact", "sales", "hello", "hi", "team", "help",
  "admin", "administrator", "orders", "order", "service", "customerservice",
  "care", "billing", "returns", "media", "press", "marketing", "office",
  "shop", "store", "noreply", "no-reply", "webmaster", "enquiries", "inquiries",
]);

// Deliberately not exhaustive -- common English first names likely to
// show up as a solo contact-email local part for a small US/UK boutique.
// Add to this list over time as real, genuinely-missed names turn up; do
// NOT loosen the matching logic itself (see the comment above) to catch
// more, since that's what caused the original false-positive bug.
const COMMON_FIRST_NAMES = new Set([
  "james", "john", "robert", "michael", "william", "david", "richard", "joseph", "thomas", "charles",
  "christopher", "daniel", "matthew", "anthony", "mark", "donald", "steven", "paul", "andrew", "joshua",
  "kenneth", "kevin", "brian", "george", "timothy", "ronald", "edward", "jason", "jeffrey", "ryan",
  "jacob", "gary", "nicholas", "eric", "jonathan", "stephen", "larry", "justin", "scott", "brandon",
  "benjamin", "samuel", "gregory", "alexander", "patrick", "jack", "dennis", "jerry", "tyler", "aaron",
  "jose", "adam", "henry", "nathan", "douglas", "zachary", "peter", "kyle", "walter", "ethan",
  "jeremy", "harold", "seth", "christian", "sean", "austin", "carl", "arthur", "noah", "lawrence",
  "jesse", "joe", "bryan", "billy", "jordan", "albert", "dylan", "bruce", "willie", "gabriel",
  "alan", "juan", "logan", "wayne", "roy", "ralph", "randy", "eugene", "vincent", "russell",
  "elijah", "louis", "bobby", "philip", "johnny", "mary", "patricia", "jennifer", "linda", "elizabeth",
  "barbara", "susan", "jessica", "sarah", "karen", "lisa", "nancy", "betty", "margaret", "sandra",
  "ashley", "kimberly", "emily", "donna", "michelle", "dorothy", "carol", "amanda", "melissa", "deborah",
  "stephanie", "rebecca", "sharon", "laura", "cynthia", "kathleen", "amy", "angela", "shirley", "anna",
  "brenda", "pamela", "emma", "nicole", "helen", "samantha", "katherine", "christine", "debra", "rachel",
  "catherine", "carolyn", "janet", "ruth", "maria", "heather", "diane", "virginia", "julie", "joyce",
  "victoria", "kelly", "christina", "lauren", "joan", "evelyn", "olivia", "judith", "megan", "cheryl",
  "martha", "andrea", "frances", "hannah", "jacqueline", "ann", "jean", "alice", "kathryn", "gloria",
  "teresa", "sara", "janice", "julia", "marie", "madison", "grace", "judy", "theresa", "beverly",
  "denise", "marilyn", "amber", "danielle", "abigail", "brittany", "rose", "diana", "natalie", "sophia",
  "alexis", "lori", "kayla", "jane", "courtney", "whitney", "holly", "stacy", "tracy", "erin",
  "allison", "monica", "tiffany", "renee", "valerie", "wendy", "alex", "jamie", "taylor", "morgan",
  "casey", "riley", "avery", "quinn", "cameron", "drew", "dana", "robin", "leslie", "shannon",
  "kelsey", "hayden", "catherine",
]);

function extractFirstNameFromEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return null;
  const localPart = email.split("@")[0].trim().toLowerCase();
  if (!localPart || GENERIC_EMAIL_LOCAL_PARTS.has(localPart)) return null;
  if (!/^[a-z]{2,20}$/.test(localPart)) return null; // no digits/dots/dashes/underscores -- too ambiguous to guess
  if (!COMMON_FIRST_NAMES.has(localPart)) return null; // allowlist, not a blocklist -- see comment above
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function buildPersonalizedDraft({
  storeName,
  domain,
  hasCrossBorder,
  physicalAddress,
  installLink,
  includeFounderBeta,
  contactEmail,
}) {
  let subject = hasCrossBorder
    ? `Quick question about ${storeName}'s international orders`
    : `Quick question about ${storeName}'s margins`;
  // Long store names push the subject past ~70 chars, where inboxes cut it off (and the
  // agent-hq Reviewer warns). Fall back to a shorter wording without the name.
  if (subject.length > 70) {
    subject = hasCrossBorder ? "Quick question about your international orders" : "Quick question about your store's margins";
  }

  const firstName = extractFirstNameFromEmail(contactEmail);
  const salutation = firstName ? `Hi ${firstName},` : `Hi there,`;

  const pitchParagraph = hasCrossBorder
    ? `I ran a quick, read-only scan of ${domain} and noticed you're set up to sell in more than one currency. Cross-border Shopify stores often lose 1-2% of every international order to currency-conversion markup buried in payment-gateway fees -- money that never shows up as its own line item, so most merchants never see it directly.\n\nDo you know how much of your international revenue goes to that markup?`
    : `A few of the most common blind spots we see on independent Shopify stores are negative-margin SKUs (products that quietly lose money once shipping is factored in) and leftover app scripts from tools that got uninstalled but never fully removed -- both invisible unless you go looking.\n\nDo you know which of your products lose money after shipping?`;

  // 2026-10-03: reworded away from "free, for life, IN EXCHANGE FOR ... a
  // review" after confirming Shopify's App Store Requirements 1.3 ("Always
  // use honest and transparent review practices", updated 2026-07-06,
  // enforcement applies to apps already published): offering any incentive
  // -- including free access -- in exchange for a review is forbidden,
  // through the app OR external channels like this email. The free-beta
  // offer and the review ask are now two separate, unconditional
  // sentences -- same substance (still free for life, still mentions a
  // review), no quid-pro-quo framing. Don't reintroduce "in exchange for"
  // here without re-checking current policy first.
  const founderBetaParagraph = includeFounderBeta
    ? `\n\nWe're currently opening a Founder Beta for the first ${FOUNDER_BETA_CAP} stores that install: 100% free, for life -- no strings attached. If you get a chance to try it, we'd genuinely love your honest feedback, and if it's useful to you, a quick App Store review helps other independent merchants find it.`
    : "";

  const body = `${salutation}

${pitchParagraph}

LeakAudit is a free, read-only Shopify app that scans a store in about 60 seconds and shows exactly where leaks like that might be hiding for your specific store -- no spreadsheets, no manual setup, nothing to configure. It only reads data Shopify already gives it.${founderBetaParagraph}

Run your store's 60-second audit: ${installLink}

Best,
Omer | Founder, LeakAudit

--
LeakAudit
${stripRedundantBrandPrefix(physicalAddress)}
Don't want emails like this from us? Reply STOP to this address -- opt-out requests are honored within 10 business days, per CAN-SPAM.`;

  return { subject, body };
}

// Follow-up draft for a lead that already received the initial email
// (2026-09-14, per Gemini) -- a single polite second touch, not a full
// drip sequence. `includeFounderBetaLine` is decided by the caller from
// whether THIS lead's original email actually included the Founder Beta
// offer (checking the stored personalizedBody), not by re-evaluating
// today's global sent count -- the cap may have since been reached by
// later leads, but it would be misleading to bring up a "spot" in a
// follow-up to someone who was never offered one, and dishonest to
// silently retract an offer already made to someone who was.
function buildFollowUpDraft({ storeName, contactEmail, installLink, physicalAddress, initialSubject, includeFounderBetaLine }) {
  const subject = `Re: ${initialSubject}`;

  const firstName = extractFirstNameFromEmail(contactEmail);
  const salutation = firstName ? `Hi ${firstName},` : `Hi there,`;

  const ctaIntro = includeFounderBetaLine
    ? `We're still holding a spot for ${storeName} in our Founder Beta (100% free, for life) if you'd like to run a 60-second audit on your store:`
    : `If you'd like to run a 60-second audit on your store:`;

  const body = `${salutation}

Just wanted to quickly follow up on my note from a few days ago, in case it got buried under new orders.

${ctaIntro}
${installLink}

Best,
Omer | Founder, LeakAudit

--
LeakAudit
${stripRedundantBrandPrefix(physicalAddress)}
Don't want emails like this from us? Reply STOP to this address -- opt-out requests are honored within 10 business days, per CAN-SPAM.`;

  return { subject, body };
}

// Approximates "Founder Beta slots remaining" from how many leads in the
// master list already show a "Sent ..." status -- see the comment above
// FOUNDER_BETA_CAP for the known limitation (counts emails promised, not
// seats actually claimed/installed).
function shouldIncludeFounderBeta(sentCountSoFar) {
  return sentCountSoFar < FOUNDER_BETA_CAP;
}

// Stored leads don't keep the raw hasCrossBorder boolean (buildFullLeads
// only persists the human-readable detectedLeaks label) -- this recovers
// it well enough to regenerate copy for a lead that was already
// qualified, without re-fetching its homepage. See --refresh-drafts.
function inferHasCrossBorderFromLabel(detectedLeaksLabelText) {
  return /FX/i.test(String(detectedLeaksLabelText ?? ""));
}

// Pulled out as its own pure function so it's unit-testable in
// runSelftest() -- guards against SENDER_PHYSICAL_ADDRESS being set to an
// email address instead of a real postal address (CAN-SPAM requires the
// latter; see the --send validation in main() for the full explanation).
function looksLikeEmailAddress(str) {
  return /\S+@\S+\.\S+/.test(String(str ?? ""));
}

function detectedLeaksLabel(hasCrossBorder) {
  return hasCrossBorder
    ? "FX / cross-border gateway markup (detected: multi-currency support)"
    : "Negative-margin SKUs, leftover app-script bloat (general -- not store-specific)";
}

// ---------------------------------------------------------------------------
// Suppression list (opt-outs, manually curated) and contacted list
// (auto-maintained, prevents re-emailing the same address on a later run)
// -- two different lists because they mean two different things: one is
// "this person asked to stop," the other is just "we already reached out
// once." Neither is in the original spec; both are the kind of thing a
// send-capable script needs before it's safe to run more than once.
// ---------------------------------------------------------------------------

async function loadEmailSet(path) {
  try {
    const text = await readFile(path, "utf-8");
    const arr = JSON.parse(text);
    return new Set(Array.isArray(arr) ? arr.map((e) => String(e).toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

async function saveEmailSet(path, set) {
  await writeFile(path, JSON.stringify([...set].sort(), null, 2) + "\n", "utf-8");
}

// Persistent negative-domain cache (2026-09-14, per Gemini/Omer) -- domains
// already confirmed NOT to qualify (wrong product-count range, not
// actually Shopify, agency/software site, homepage unreachable, or
// excluded by the domain/URL filter), keyed by domain with a human-
// readable reason. Checked in processCandidate() below BEFORE any HTTP
// request, alongside the existing alreadyKnownDomains check -- the whole
// point is skipping a domain that already cost a homepage fetch plus a
// /products.json fetch to disqualify, with zero new requests, as
// discovery scales toward 100+ candidates per run and broader search
// queries increasingly re-surface the same losing candidates.
async function loadRejectedDomains(path) {
  try {
    const text = await readFile(path, "utf-8");
    const arr = JSON.parse(text);
    const map = new Map();
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        if (entry && typeof entry.domain === "string") {
          map.set(entry.domain, typeof entry.reason === "string" ? entry.reason : "unknown");
        }
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function saveRejectedDomains(path, map) {
  const arr = [...map.entries()]
    .map(([domain, reason]) => ({ domain, reason }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
  await writeFile(path, JSON.stringify(arr, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Per-domain qualification pipeline
// ---------------------------------------------------------------------------

// `rejectedDomains` (optional Map<domain, reason>) is mutated in place --
// every disqualification path records itself there (2026-09-14, per
// Gemini/Omer) so a later discovery run can skip this exact domain
// without spending another homepage/products.json fetch on it. The one
// exception is the very first check: an unparseable domain has nothing
// valid to key the cache on, so it's just dropped, not cached.
// 2026-10-11: the first big discovery run (80 new leads) showed what a
// raw page scrape picks up as a "contact email": Sentry ingest addresses,
// "your@email.com" placeholders, URL-encoded non-breaking spaces
// ("%C2%A0info@..."), digit-glued postal codes ("98107info@..."), a Shopify
// agency's address, role mailboxes like payments@/orders@, and free-mail
// addresses on theme-demo *.myshopify.com stores. Emailing any of those
// wastes sends and hurts sender reputation (bounces/spam complaints), so
// every address passes through here before it can reach a lead. Returns
// the cleaned lower-case address, or null if it should not be emailed.
const BAD_EMAIL_DOMAIN_PATTERNS = [
  /sentry/i, /ingest\./i, /wixpress\.com$/i, /(^|\.)shopify\.com$/i, /(^|\.)myshopify\.com$/i,
  /^example\./i, /^email\.com$/i, /^domain\.com$/i, /^yourdomain\./i, /giftnote\.com$/i,
  /bsscommerce\.com$/i, /zipify\.com$/i,
];
const BAD_EMAIL_LOCAL_PARTS = new Set([
  "payments", "payment", "billing", "invoice", "invoices", "orders", "order", "noreply", "no-reply",
  "donotreply", "do-not-reply", "privacy", "legal", "abuse", "postmaster", "webmaster", "careers",
  "jobs", "recipient", "your", "you", "name", "yourname", "user", "test", "example", "email",
]);

function sanitizeContactEmail(raw, storeDomain) {
  if (!raw || typeof raw !== "string") return null;
  let e = raw;
  try {
    e = decodeURIComponent(e);
  } catch {
    // not URL-encoded -- keep as is
  }
  e = e.replace(/[\u00a0\u200b\s]+/g, "").toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e)) return null;
  const [local, domain] = e.split("@");
  if (/\.(png|jpe?g|gif|svg|webp)$/.test(domain)) return null;
  if (/^\d{3,}[a-z]/.test(local)) return null; // digit-glued prefix, e.g. 98107info@
  if (/^[0-9a-f]{20,}$/.test(local)) return null; // machine-generated id
  if (BAD_EMAIL_LOCAL_PARTS.has(local)) return null;
  if (BAD_EMAIL_DOMAIN_PATTERNS.some((re) => re.test(domain))) return null;
  // Theme-demo / dev stores on *.myshopify.com are not real merchants. (Real tiny shops on a
  // myshopify subdomain with a gmail address are exactly our target, so only the clear
  // demo/dev name patterns are dropped.)
  if (storeDomain && /^(theme|demo|test|dev)[a-z0-9-]*\.myshopify\.com$/i.test(storeDomain)) return null;
  return e;
}

async function qualifyDomain(urlOrDomain, delayMs, rejectedDomains) {
  const domain = urlOrDomain.includes("://") ? domainFromUrl(urlOrDomain) : urlOrDomain;
  if (!domain) return null;
  if (isExcludedByDomain(urlOrDomain.includes("://") ? urlOrDomain : `https://${domain}`, domain)) {
    console.log(`  [-] ${domain} -- excluded by domain/URL filter`);
    rejectedDomains?.set(domain, "excluded by domain/URL filter");
    return null;
  }

  let homepage;
  let homepageHtml;
  try {
    homepage = await fetchWithTimeout(`https://${domain}`);
    homepageHtml = homepage.ok || homepage.status < 400 ? await homepage.text() : "";
  } catch {
    await sleep(delayMs);
    console.log(`  [-] ${domain} -- homepage fetch failed, skipped`);
    // Deliberately NOT cached: a fetch failure can be transient (the site
    // was briefly down, a network blip) rather than a real, durable
    // disqualification -- caching it would risk permanently skipping a
    // domain that's actually fine on a later run.
    return null;
  }
  await sleep(delayMs);
  if (!homepage || homepage.status >= 400 || !looksLikeShopify(homepageHtml)) {
    console.log(`  [-] ${domain} -- not confirmed as a live Shopify store, skipped`);
    rejectedDomains?.set(domain, "not confirmed as a live Shopify store");
    return null;
  }

  const rawTitle = extractRawTitle(homepageHtml);
  const metaDescription = extractMetaDescription(homepageHtml);
  if (hasExcludedKeyword(rawTitle) || hasExcludedKeyword(metaDescription)) {
    console.log(`  [-] ${domain} -- title/meta reads as a software/app/agency site, skipped ("${rawTitle}")`);
    rejectedDomains?.set(domain, `title/meta reads as a software/app/agency site ("${rawTitle}")`);
    return null;
  }

  const productCount = await fetchProductCount(domain);
  await sleep(delayMs);
  if (!isQualifiedProductCount(productCount)) {
    if (productCount === null) {
      // Not cached: null here means the /products.json fetch itself
      // failed or returned something unparseable -- possibly transient
      // (same reasoning as the homepage-fetch-failure case above), not a
      // confirmed fact about the store's actual product count.
      console.log(`  [-] ${domain} -- product count unknown (couldn't fetch /products.json), skipped`);
      return null;
    }
    const reason = `product count ${productCount} outside the ${PRODUCT_COUNT_MIN}-${PRODUCT_COUNT_MAX} SMB range`;
    console.log(`  [-] ${domain} -- ${reason}, skipped`);
    rejectedDomains?.set(domain, reason);
    return null;
  }

  const hasCrossBorder = detectCrossBorder(homepageHtml);
  const storeName = extractStoreName(homepageHtml, domain);
  const email = sanitizeContactEmail(await findContactEmail(domain, delayMs), domain);

  console.log(`  [+] ${domain} -- qualified (${productCount} products, cross-border: ${hasCrossBorder}, email: ${email || "none"})`);

  return { storeName, domain, productCount, hasCrossBorder, contactEmail: email };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function discoverAndQualify({
  seedDomains,
  dorkQueries,
  serperApiKey,
  braveApiKey,
  limit,
  delayMs,
  suppressionSet,
  alreadyKnownDomains,
  rejectedDomains,
  pages = 1,
  requireEmail = false,
}) {
  // Seeded with domains already in the cumulative master list (2026-09-10)
  // so a repeat run doesn't waste real HTTP requests re-qualifying a
  // domain it already has -- processCandidate()'s existing seenDomains
  // check does the rest for free.
  const seenDomains = new Set(alreadyKnownDomains || []);
  const qualified = [];
  let skippedViaRejectedCache = 0;

  const candidateSources = [];
  if (seedDomains.length) {
    candidateSources.push(...seedDomains);
  }

  async function processCandidate(urlOrDomain) {
    if (qualified.length >= limit) return;
    const domain = urlOrDomain.includes("://") ? domainFromUrl(urlOrDomain) : urlOrDomain;
    if (!domain || seenDomains.has(domain)) return;
    // Persistent negative-domain cache (2026-09-14, per Gemini/Omer) --
    // checked here, before qualifyDomain ever runs, so a previously-
    // rejected domain costs zero new HTTP requests on this run.
    if (rejectedDomains && rejectedDomains.has(domain)) {
      seenDomains.add(domain);
      skippedViaRejectedCache++;
      return;
    }
    seenDomains.add(domain);

    const lead = await qualifyDomain(urlOrDomain, delayMs, rejectedDomains);
    if (!lead) return;

    if (lead.contactEmail && suppressionSet.has(lead.contactEmail.toLowerCase())) {
      console.log(`  [-] ${domain} -- ${lead.contactEmail} is on the suppression list, excluded entirely`);
      return;
    }

    // --require-email (2026-10-11): a lead with no contact email can't be
    // emailed, and made up 94 of the 110 leads so far. Don't count it
    // toward --limit; remember the domain so it isn't re-fetched next run.
    if (requireEmail && !lead.contactEmail) {
      console.log(`  [-] ${domain} -- no contact email found, skipped (--require-email)`);
      rejectedDomains?.set(domain, "no contact email found");
      return;
    }

    qualified.push(lead);
  }

  for (const domain of candidateSources) {
    if (qualified.length >= limit) break;
    await processCandidate(domain);
  }

  if (serperApiKey) {
    for (const query of dorkQueries) {
      if (qualified.length >= limit) break;
      for (let page = 1; page <= pages; page++) {
        if (qualified.length >= limit) break;
        let urls;
        try {
          urls = await searchSerper(query, serperApiKey, 10, page);
        } catch (exc) {
          console.error(`  [warn] Serper search failed for ${JSON.stringify(query)} (page ${page}): ${exc.message}`);
          break;
        }
        await sleep(delayMs);
        if (urls.length === 0) break; // no more results for this query
        for (const url of urls) {
          if (qualified.length >= limit) break;
          await processCandidate(url);
        }
      }
    }
  }

  if (braveApiKey) {
    for (const query of dorkQueries) {
      if (qualified.length >= limit) break;
      let urls;
      try {
        urls = await searchBrave(query, braveApiKey);
      } catch (exc) {
        console.error(`  [warn] Brave search failed for ${JSON.stringify(query)}: ${exc.message}`);
        continue;
      }
      await sleep(delayMs);
      for (const url of urls) {
        if (qualified.length >= limit) break;
        await processCandidate(url);
      }
    }
  }

  return { qualified, skippedViaRejectedCache };
}

function buildFullLeads(qualifiedLeads, physicalAddress, includeFounderBeta) {
  return qualifiedLeads.map((lead) => {
    const installLink = buildInstallLink(lead.domain);
    const { subject, body } = buildPersonalizedDraft({
      storeName: lead.storeName,
      domain: lead.domain,
      hasCrossBorder: lead.hasCrossBorder,
      physicalAddress,
      installLink,
      includeFounderBeta,
      contactEmail: lead.contactEmail,
    });
    return {
      shopUrl: `https://${lead.domain}`,
      status: "Pending",
      storeName: lead.storeName,
      domain: lead.domain,
      productCount: lead.productCount,
      detectedLeaks: detectedLeaksLabel(lead.hasCrossBorder),
      contactEmail: lead.contactEmail,
      personalizedSubject: subject,
      personalizedBody: body,
      installLink,
    };
  });
}

// Column order deliberately puts the things a human reviewer actually
// needs at a glance -- the store's real site (to sanity-check it by eye),
// who it'll be emailed to, whether it's already been sent, and the exact
// copy -- ahead of the supporting metadata (2026-09-10, per Omer:
// reviewing a CSV of store name/domain first made it harder to jump
// straight to "does this look like a real small store and does this
// email make sense"; Status added same day per Gemini, for cumulative
// mode).
function toCsvRows(fullLeads) {
  const header = [
    "Shop URL",
    "Email",
    "Status",
    "Personalized Subject",
    "Personalized Body",
    "Store Name",
    "Product Count",
    "Detected Leaks",
    "Install Link",
    "Follow-Up Subject",
    "Follow-Up Body",
  ];
  const rows = [
    header,
    ...fullLeads.map((l) => [
      l.shopUrl,
      l.contactEmail,
      l.status || "Pending",
      l.personalizedSubject,
      l.personalizedBody,
      l.storeName,
      l.productCount,
      l.detectedLeaks,
      l.installLink,
      l.followUpSubject || "",
      l.followUpBody || "",
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Cumulative master list (2026-09-10, per Gemini) -- load what's already
// on disk, merge in only genuinely new leads by domain. Deliberately not a
// literal file-append: a blind append can't dedupe, and would let the same
// domain reappear across runs if a later query rediscovers it.
// ---------------------------------------------------------------------------

async function loadExistingLeads(jsonPath) {
  try {
    const text = await readFile(jsonPath, "utf-8");
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function mergeLeads(existingLeads, newLeads) {
  const existingDomains = new Set(existingLeads.map((l) => l.domain));
  const toAdd = newLeads.filter((l) => !existingDomains.has(l.domain));
  return [...existingLeads, ...toAdd];
}

// ---------------------------------------------------------------------------
// Resend sending
// ---------------------------------------------------------------------------

// Pulled out as its own pure function so it's unit-testable in
// runSelftest() without a network call. Real send: one key per
// domain-per-calendar-day, so an accidental re-run can't double-email the
// same domain the same day. Test send: 2026-09-10 fix, per Gemini/Omer --
// a real send hit Resend's 409 "idempotency key already used with a
// different body" because a static per-domain-per-day key collided with
// itself once the template copy changed between two --test-email runs on
// the same day. Test sends aren't the "don't double-email a real
// merchant" case this key exists for in the first place, so they get a
// unique key per invocation (a testSalt, e.g. Date.now()) instead.
function buildIdempotencyKey(domain, { testSalt } = {}) {
  return testSalt
    ? `leakaudit-test-${domain}-${testSalt}`
    : `leakaudit-outbound-${domain}-${new Date().toISOString().slice(0, 10)}`;
}

// `subject`/`body` are optional overrides (2026-09-14, added for
// --follow-up) -- when omitted, falls back to the lead's own stored
// personalizedSubject/personalizedBody exactly as before, so every
// existing call site (--send, --test-email) is unaffected.
async function sendViaResend(lead, { apiKey, fromAddress, replyTo, testSalt, subject, body }) {
  const idempotencyKey = buildIdempotencyKey(lead.domain, { testSalt });
  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: lead.contactEmail,
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: subject ?? lead.personalizedSubject,
      text: body ?? lead.personalizedBody,
    }),
  });
  const json = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, body: json };
}

// ---------------------------------------------------------------------------
// Producer/Consumer split (2026-09-10, per Gemini/Omer) -- Omer ran
// `--send --limit 5` expecting it to dispatch from the 20+ already-
// qualified "Pending" leads already sitting in qualified_smb_leads.json,
// and instead it kicked off a brand new Serper search and re-scraped the
// web from scratch. Root cause: --send was never its own mode -- it was a
// flag bolted onto the end of the discovery pipeline, and that pipeline
// unconditionally required (and ran) discovery before it would even reach
// the send logic. Confirmed this by reading the code, not just taking the
// report at face value: `main()` always called discoverAndQualify()
// before checking `args.send` at all, and now that .env auto-loading
// (added earlier today) means SERPER_API_KEY/BRAVE_API_KEY are picked up
// silently even when nobody typed --serper-key, that accidental discovery
// pass got easier to trigger by accident, not harder.
//
// Fix: `--send` alone now means "dispatch-only" -- it reads the existing
// output file, does zero network discovery, and just sends to leads
// already marked Pending. Real discovery only runs when `--discover` is
// explicitly passed (or when neither --send nor --discover is given, to
// keep the old plain "discover as a dry run" behavior working for anyone
// already using it that way). `--discover --send` together still works
// as before: discover first, then dispatch from the updated pool.
//
// getSendableLeads() and promptAndSend() are pulled out as their own
// functions (rather than inlined twice) so both the dispatch-only path
// and the discover+send path share the exact same filtering and
// send/confirm logic instead of two copies that could drift apart.
// ---------------------------------------------------------------------------

// Pure and unit-testable: no I/O, no network. `limit` here is "how many
// to actually email this run," a real cap that didn't exist before this
// fix -- previously --send would attempt every sendable lead in the file
// in one run, with no batch-size control at all beyond the interactive
// confirmation prompt.
function getSendableLeads(fullLeads, { suppressionSet, contactedSet, limit }) {
  const eligible = fullLeads.filter((l) => {
    if (String(l.status || "").startsWith("Sent")) return false;
    if (!l.contactEmail) return false;
    const email = l.contactEmail.toLowerCase();
    if (suppressionSet && suppressionSet.has(email)) return false;
    if (contactedSet && contactedSet.has(email)) return false;
    return true;
  });
  return typeof limit === "number" && Number.isFinite(limit) ? eligible.slice(0, limit) : eligible;
}

// Parses a lead's status string back into the moment it was actually sent,
// or null if it isn't a "Sent <ISO>" status at all -- covers "Pending"
// (never sent) and "Followup Sent <ISO>" (already followed up) the same
// way, which is exactly the exclusion getFollowUpEligibleLeads() needs
// below without a second, separate check.
function parseSentTimestamp(status) {
  if (typeof status !== "string" || !status.startsWith("Sent ")) return null;
  const iso = status.slice("Sent ".length).trim();
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Pure filter behind --follow-up (2026-09-14, per Gemini): a lead
// qualifies for exactly one follow-up touch once its original "Sent ..."
// is at least FOLLOWUP_MIN_HOURS old, it isn't suppressed, and it hasn't
// already been followed up (status would read "Followup Sent ..." by
// then, which parseSentTimestamp() already treats as not-a-Sent-status,
// so no separate check is needed for that).
function getFollowUpEligibleLeads(fullLeads, { suppressionSet, minHours = FOLLOWUP_MIN_HOURS, limit, now = new Date() }) {
  const eligible = fullLeads.filter((l) => {
    const sentAt = parseSentTimestamp(l.status);
    if (!sentAt) return false;
    if (!l.contactEmail) return false;
    const hoursElapsed = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < minHours) return false;
    const email = l.contactEmail.toLowerCase();
    if (suppressionSet && suppressionSet.has(email)) return false;
    return true;
  });
  return typeof limit === "number" && Number.isFinite(limit) ? eligible.slice(0, limit) : eligible;
}

// Prints the exact leads about to be emailed, requires the interactive
// "type SEND" confirmation (same safety gate as before -- not removed by
// this refactor), then sends one at a time with the existing rate limit.
// `toSend` entries must be references into `fullLeads` (both
// getSendableLeads()'s filter and Array.filter in general preserve
// object references), so mutating `lead.status` here is what makes
// persisting `fullLeads` afterwards pick up the change.
async function promptAndSend(toSend, fullLeads, { apiKey, fromAddress, replyTo, contactedSet, contactedListPath, output }) {
  if (toSend.length === 0) {
    console.log("Nothing to dispatch -- no Pending leads with a contact email are eligible (checked status, suppression list, and already-contacted list).");
    return;
  }

  console.log(`\nAbout to dispatch ${toSend.length} real email(s):`);
  toSend.forEach((l, i) => {
    console.log(`  ${i + 1}. ${l.storeName} (${l.contactEmail})`);
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType SEND to dispatch these ${toSend.length} email(s) (anything else cancels): `);
  rl.close();
  if (answer.trim() !== "SEND") {
    console.log("Not confirmed -- nothing sent.");
    return;
  }

  for (let i = 0; i < toSend.length; i++) {
    const lead = toSend[i];
    try {
      const result = await sendViaResend(lead, { apiKey, fromAddress, replyTo });
      if (result.ok) {
        console.log(`  [sent] ${lead.contactEmail} (${lead.domain})`);
        lead.status = `Sent ${new Date().toISOString()}`;
        contactedSet.add(lead.contactEmail.toLowerCase());
        await saveEmailSet(contactedListPath, contactedSet);
        await writeFile(`${output}.json`, JSON.stringify(fullLeads, null, 2) + "\n", "utf-8");
        await writeFile(`${output}.csv`, toCsvRows(fullLeads), "utf-8");
      } else {
        console.error(`  [failed] ${lead.contactEmail} (${lead.domain}) -- HTTP ${result.status}: ${JSON.stringify(result.body)}`);
      }
    } catch (exc) {
      console.error(`  [failed] ${lead.contactEmail} (${lead.domain}) -- ${exc.message}`);
    }
    if (i < toSend.length - 1) await sleep(SEND_RATE_LIMIT_MS);
  }

  console.log("\nDone dispatching.");
}

// Follow-up counterpart to promptAndSend() above -- same "type SEND to
// confirm" gate, same one-at-a-time rate limit, but builds the follow-up
// draft per lead at send time (rather than ahead of time via
// --refresh-drafts) since a follow-up's eligibility -- and therefore its
// exact copy -- depends on real time having passed, not just on being
// regenerated whenever --refresh-drafts happens to run. The original
// personalizedSubject/personalizedBody are left untouched on the lead
// (that's the historical record of what email #1 actually said); the
// follow-up content is stored separately as followUpSubject/followUpBody
// for the same audit-trail visibility this file already gives every
// other stage of a lead.
async function promptAndSendFollowUps(toFollowUp, fullLeads, { apiKey, fromAddress, replyTo, physicalAddress, output }) {
  if (toFollowUp.length === 0) {
    console.log(
      `Nothing to follow up on -- no lead has crossed the ${FOLLOWUP_MIN_HOURS}-hour mark since its initial send without already being suppressed or already followed up.`
    );
    return;
  }

  console.log(`\nAbout to send ${toFollowUp.length} follow-up email(s):`);
  toFollowUp.forEach((l, i) => {
    console.log(`  ${i + 1}. ${l.storeName} (${l.contactEmail}) -- originally sent ${l.status}`);
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType SEND to dispatch these ${toFollowUp.length} follow-up email(s) (anything else cancels): `);
  rl.close();
  if (answer.trim() !== "SEND") {
    console.log("Not confirmed -- nothing sent.");
    return;
  }

  for (let i = 0; i < toFollowUp.length; i++) {
    const lead = toFollowUp[i];
    const includeFounderBetaLine = String(lead.personalizedBody || "").includes("Founder Beta");
    const { subject, body } = buildFollowUpDraft({
      storeName: lead.storeName,
      contactEmail: lead.contactEmail,
      installLink: lead.installLink,
      physicalAddress,
      initialSubject: lead.personalizedSubject,
      includeFounderBetaLine,
    });
    try {
      const result = await sendViaResend(lead, { apiKey, fromAddress, replyTo, subject, body });
      if (result.ok) {
        console.log(`  [sent] ${lead.contactEmail} (${lead.domain})`);
        lead.followUpSubject = subject;
        lead.followUpBody = body;
        lead.status = `Followup Sent ${new Date().toISOString()}`;
        await writeFile(`${output}.json`, JSON.stringify(fullLeads, null, 2) + "\n", "utf-8");
        await writeFile(`${output}.csv`, toCsvRows(fullLeads), "utf-8");
      } else {
        console.error(`  [failed] ${lead.contactEmail} (${lead.domain}) -- HTTP ${result.status}: ${JSON.stringify(result.body)}`);
      }
    } catch (exc) {
      console.error(`  [failed] ${lead.contactEmail} (${lead.domain}) -- ${exc.message}`);
    }
    if (i < toFollowUp.length - 1) await sleep(SEND_RATE_LIMIT_MS);
  }

  console.log("\nDone dispatching follow-ups.");
}

// ---------------------------------------------------------------------------
// Self-tests (no network required) -- run with --selftest
// ---------------------------------------------------------------------------

async function runSelftest() {
  let failures = 0;
  function check(name, condition) {
    const status = condition ? "ok" : "FAIL";
    if (!condition) failures++;
    console.log(`  [${status}] ${name}`);
  }

  check("isQualifiedProductCount accepts the lower bound", isQualifiedProductCount(8) === true);
  check("isQualifiedProductCount accepts the upper bound", isQualifiedProductCount(200) === true);
  check("isQualifiedProductCount rejects below the range", isQualifiedProductCount(7) === false);
  check("isQualifiedProductCount rejects above the range", isQualifiedProductCount(201) === false);
  check("isQualifiedProductCount rejects null (unknown count)", isQualifiedProductCount(null) === false);

  check(
    "detectCrossBorder finds a whole-word currency code",
    detectCrossBorder("<option>USD</option><option>EUR</option>") === true
  );
  check(
    "detectCrossBorder does not match a currency code as a substring of another word",
    detectCrossBorder("<p>Check out our EURO-inspired new collection</p>") === false
  );
  check(
    "detectCrossBorder returns false when no cross-border currency is present",
    detectCrossBorder("<option>USD</option>") === false
  );

  const crossBorderDraft = buildPersonalizedDraft({
    storeName: "Cool Threads",
    domain: "coolthreads.com",
    hasCrossBorder: true,
    physicalAddress: "123 Main St, Anytown, ST 00000",
    installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
    includeFounderBeta: false,
  });
  check("buildPersonalizedDraft (cross-border) mentions currency, not a fabricated dollar figure", crossBorderDraft.body.includes("currency"));
  check("buildPersonalizedDraft always includes the physical address (CAN-SPAM)", crossBorderDraft.body.includes("123 Main St, Anytown, ST 00000"));
  check("buildPersonalizedDraft always includes an opt-out instruction (CAN-SPAM)", /reply stop/i.test(crossBorderDraft.body));
  check("buildPersonalizedDraft subject is non-deceptive (names the store, no clickbait)", crossBorderDraft.subject.includes("Cool Threads"));

  const singleCurrencyDraft = buildPersonalizedDraft({
    storeName: "Cool Threads",
    domain: "coolthreads.com",
    hasCrossBorder: false,
    physicalAddress: "123 Main St, Anytown, ST 00000",
    installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
    includeFounderBeta: false,
  });
  check(
    "buildPersonalizedDraft (single-currency) pitches margin/bloat, not FX",
    singleCurrencyDraft.body.includes("negative-margin") && !singleCurrencyDraft.body.includes("more than one currency")
  );
  check("buildPersonalizedDraft (single-currency) still includes the physical address", singleCurrencyDraft.body.includes("123 Main St"));

  check(
    "detectedLeaksLabel distinguishes cross-border from general framing",
    detectedLeaksLabel(true).includes("FX") && detectedLeaksLabel(false).includes("general")
  );

  check(
    "buildPersonalizedDraft uses the arrow-CTA line with the real install link (2026-09-10 polish)",
    crossBorderDraft.body.includes("Run your store's 60-second audit: https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct")
  );
  check(
    "buildPersonalizedDraft includes the named founder sign-off (2026-09-10 polish)",
    crossBorderDraft.body.includes("Best,\nOmer | Founder, LeakAudit")
  );
  check(
    "buildPersonalizedDraft never invents a specific dollar-leak-range stat (no real usage data backs one)",
    !/\$\d[\d,]*\s*[-–]\s*\$?\d/.test(crossBorderDraft.body) && !/\$\d[\d,]*\s*[-–]\s*\$?\d/.test(singleCurrencyDraft.body)
  );
  check(
    "buildPersonalizedDraft omits the Founder Beta paragraph when includeFounderBeta is false",
    !/founder beta/i.test(crossBorderDraft.body) &&
      !/lifetime/i.test(crossBorderDraft.body) &&
      !/founder beta/i.test(singleCurrencyDraft.body) &&
      !/lifetime/i.test(singleCurrencyDraft.body)
  );

  const founderBetaDraft = buildPersonalizedDraft({
    storeName: "Cool Threads",
    domain: "coolthreads.com",
    hasCrossBorder: false,
    physicalAddress: "123 Main St, Anytown, ST 00000",
    installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
    includeFounderBeta: true,
  });
  check(
    "buildPersonalizedDraft includes the confirmed Founder Beta offer when includeFounderBeta is true",
    founderBetaDraft.body.includes(`first ${FOUNDER_BETA_CAP} stores`) &&
      founderBetaDraft.body.includes("100% free, for life") &&
      founderBetaDraft.body.includes("App Store review")
  );
  check(
    "buildPersonalizedDraft never invents a beta cap other than the confirmed FOUNDER_BETA_CAP",
    FOUNDER_BETA_CAP === 20
  );

  check("shouldIncludeFounderBeta is true below the cap", shouldIncludeFounderBeta(0) === true && shouldIncludeFounderBeta(19) === true);
  check("shouldIncludeFounderBeta is false once the cap is reached", shouldIncludeFounderBeta(20) === false && shouldIncludeFounderBeta(25) === false);

  const csv = toCsvRows([
    {
      shopUrl: "https://coolthreads.com",
      status: "Pending",
      storeName: "Cool Threads",
      domain: "coolthreads.com",
      productCount: 42,
      detectedLeaks: "FX / cross-border gateway markup (detected: multi-currency support)",
      contactEmail: "hello@coolthreads.com",
      personalizedSubject: "Quick question about Cool Threads's international orders",
      personalizedBody: "line one\nline two, with a comma",
      installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
    },
  ]);
  check("toCsvRows includes the exact 9-column header, Shop URL/Email/Status/Subject/Body first", csv.startsWith("Shop URL,Email,Status,Personalized Subject,Personalized Body,Store Name,Product Count,Detected Leaks,Install Link"));
  check("toCsvRows puts the shop URL and status in the first columns", csv.includes("https://coolthreads.com,hello@coolthreads.com,Pending"));
  check("toCsvRows quotes a body value containing a comma", csv.includes('"line one\nline two, with a comma"'));
  check(
    "toCsvRows defaults a missing status to Pending",
    toCsvRows([{ shopUrl: "https://x.com", contactEmail: "a@x.com", personalizedSubject: "s", personalizedBody: "b", storeName: "X", productCount: 1, detectedLeaks: "d", installLink: "i" }]).includes(",Pending,")
  );

  check(
    "mergeLeads adds a genuinely new lead",
    mergeLeads([{ domain: "a.com", status: "Pending" }], [{ domain: "b.com", status: "Pending" }]).length === 2
  );
  check(
    "mergeLeads skips a domain already present (dedup, not literal append)",
    mergeLeads([{ domain: "a.com", status: "Sent 2026-09-10" }], [{ domain: "a.com", status: "Pending" }]).length === 1
  );
  check(
    "mergeLeads carries forward the existing lead's status untouched, not the new run's",
    mergeLeads([{ domain: "a.com", status: "Sent 2026-09-10" }], [{ domain: "a.com", status: "Pending" }])[0].status ===
      "Sent 2026-09-10"
  );

  {
    // 2026-09-10 (per Gemini/Omer): getSendableLeads() is the pure filter
    // behind the new dispatch-only --send mode -- covers the real bug
    // report (leads sitting in the file weren't being picked up for
    // sending) plus the filtering rules that were previously inline and
    // untested as their own unit.
    const sampleLeads = [
      { domain: "pending-with-email.com", status: "Pending", contactEmail: "a@pending-with-email.com" },
      { domain: "already-sent.com", status: "Sent 2026-09-01T00:00:00.000Z", contactEmail: "b@already-sent.com" },
      { domain: "no-email.com", status: "Pending", contactEmail: null },
      { domain: "suppressed.com", status: "Pending", contactEmail: "c@suppressed.com" },
      { domain: "already-contacted.com", status: "Pending", contactEmail: "d@already-contacted.com" },
      { domain: "another-pending.com", status: "Pending", contactEmail: "e@another-pending.com" },
    ];
    const suppressionSet = new Set(["c@suppressed.com"]);
    const contactedSet = new Set(["d@already-contacted.com"]);
    const sendable = getSendableLeads(sampleLeads, { suppressionSet, contactedSet });
    check(
      "getSendableLeads picks up Pending leads with an email that are sitting in the file already (the actual bug reported)",
      sendable.some((l) => l.domain === "pending-with-email.com")
    );
    check("getSendableLeads excludes an already-Sent lead", !sendable.some((l) => l.domain === "already-sent.com"));
    check("getSendableLeads excludes a lead with no contact email", !sendable.some((l) => l.domain === "no-email.com"));
    check("getSendableLeads excludes a suppressed address", !sendable.some((l) => l.domain === "suppressed.com"));
    check("getSendableLeads excludes an already-contacted address", !sendable.some((l) => l.domain === "already-contacted.com"));
    check("getSendableLeads with no limit returns every eligible lead", sendable.length === 2);
    check(
      "getSendableLeads respects an explicit limit as a real send-batch cap",
      getSendableLeads(sampleLeads, { suppressionSet, contactedSet, limit: 1 }).length === 1
    );
  }

  check(
    "extractBraveUrls pulls the url field out of web.results[]",
    JSON.stringify(
      extractBraveUrls({ web: { results: [{ url: "https://a.com", title: "A" }, { url: "https://b.com" }] } })
    ) === JSON.stringify(["https://a.com", "https://b.com"])
  );
  check("extractBraveUrls returns [] when web.results is missing", extractBraveUrls({}).length === 0);
  check(
    "extractBraveUrls filters out non-string url values instead of throwing",
    JSON.stringify(extractBraveUrls({ web: { results: [{ url: 123 }, { url: "https://c.com" }, {}] } })) ===
      JSON.stringify(["https://c.com"])
  );

  check("looksLikeEmailAddress flags an email used as SENDER_PHYSICAL_ADDRESS", looksLikeEmailAddress("omerbussy1995@gmail.com") === true);
  check("looksLikeEmailAddress accepts a real postal address", looksLikeEmailAddress("123 Main St, Anytown, ST 00000") === false);
  check("looksLikeEmailAddress accepts a PO Box address", looksLikeEmailAddress("PO Box 4021, Nes Harim, Israel") === false);

  check(
    "inferHasCrossBorderFromLabel recovers true from the FX label",
    inferHasCrossBorderFromLabel(detectedLeaksLabel(true)) === true
  );
  check(
    "inferHasCrossBorderFromLabel recovers false from the general label",
    inferHasCrossBorderFromLabel(detectedLeaksLabel(false)) === false
  );

  check(
    "stripRedundantBrandPrefix removes a leading 'LeakAudit,' so the footer isn't duplicated",
    stripRedundantBrandPrefix("LeakAudit, P.O. Box 42, Nes Harim, Israel") === "P.O. Box 42, Nes Harim, Israel"
  );
  check(
    "stripRedundantBrandPrefix leaves an address with no brand prefix untouched",
    stripRedundantBrandPrefix("123 Main St, Anytown, ST 00000") === "123 Main St, Anytown, ST 00000"
  );
  check(
    "buildPersonalizedDraft never renders 'LeakAudit' twice in a row in the footer",
    !buildPersonalizedDraft({
      storeName: "Cool Threads",
      domain: "coolthreads.com",
      hasCrossBorder: false,
      physicalAddress: "LeakAudit, P.O. Box 42, Nes Harim, Israel",
      installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
      includeFounderBeta: false,
    }).body.includes("LeakAudit\nLeakAudit")
  );

  check(
    "buildIdempotencyKey gives a real send a stable per-domain-per-day key",
    buildIdempotencyKey("a.com") === buildIdempotencyKey("a.com")
  );
  check(
    "buildIdempotencyKey gives a test send a unique key per testSalt (fixes the 409 re-run conflict)",
    buildIdempotencyKey("a.com", { testSalt: 111 }) !== buildIdempotencyKey("a.com", { testSalt: 222 })
  );

  check("extractFirstNameFromEmail recovers a plausible first name", extractFirstNameFromEmail("heather@bijouxbycatherine.com") === "Heather");
  check("extractFirstNameFromEmail recovers another real name from real production data", extractFirstNameFromEmail("whitney@porchboutique.com") === "Whitney");
  check("extractFirstNameFromEmail rejects a generic role address", extractFirstNameFromEmail("info@store.com") === null);
  check("extractFirstNameFromEmail rejects a dotted firstname.lastname address (too ambiguous to guess)", extractFirstNameFromEmail("j.smith@store.com") === null);
  check("extractFirstNameFromEmail rejects a local part containing digits", extractFirstNameFromEmail("shop99@store.com") === null);
  check("extractFirstNameFromEmail rejects a non-email string", extractFirstNameFromEmail("not-an-email") === null);
  // Regression tests for real business-alias local parts caught in Omer's
  // actual 36-lead list before this shipped -- the first (blocklist-based)
  // version of this function wrongly treated all of these as first names.
  check("extractFirstNameFromEmail rejects a business alias, not a name (curvyexchangedept)", extractFirstNameFromEmail("curvyexchangedept@gmail.com") === null);
  check("extractFirstNameFromEmail rejects a business alias, not a name (fireflyjewelers)", extractFirstNameFromEmail("FireflyJewelers@gmail.com") === null);
  check("extractFirstNameFromEmail rejects a business alias, not a name (swfhomesweethome)", extractFirstNameFromEmail("swfhomesweethome@gmail.com") === null);
  check("extractFirstNameFromEmail rejects a business alias, not a name (serviceweborders)", extractFirstNameFromEmail("Serviceweborders@shopgreatpretenders.com") === null);
  check("extractFirstNameFromEmail rejects a business alias, not a name (whollowboutique)", extractFirstNameFromEmail("whollowboutique@gmail.com") === null);
  check(
    "buildPersonalizedDraft greets a real first name directly when the contact email resolves to one",
    buildPersonalizedDraft({
      storeName: "Cool Threads",
      domain: "coolthreads.com",
      hasCrossBorder: false,
      physicalAddress: "123 Main St, Anytown, ST 00000",
      installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
      includeFounderBeta: false,
      contactEmail: "heather@coolthreads.com",
    }).body.startsWith("Hi Heather,")
  );
  check(
    "buildPersonalizedDraft falls back to the team greeting for a generic/missing contact email",
    buildPersonalizedDraft({
      storeName: "Cool Threads",
      domain: "coolthreads.com",
      hasCrossBorder: false,
      physicalAddress: "123 Main St, Anytown, ST 00000",
      installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
      includeFounderBeta: false,
      contactEmail: "info@coolthreads.com",
    }).body.startsWith("Hi there,")
  );

  {
    const testEnvPath = join(tmpdir(), `smart-outbound-engine-selftest-${process.pid}.env`);
    try {
      writeFileSync(
        testEnvPath,
        'SMART_OUTBOUND_ENGINE_SELFTEST_VAR=hello world\n# a comment, and a blank line below\n\nSMART_OUTBOUND_ENGINE_SELFTEST_QUOTED="quoted value"\n',
        "utf-8"
      );
      delete process.env.SMART_OUTBOUND_ENGINE_SELFTEST_VAR;
      delete process.env.SMART_OUTBOUND_ENGINE_SELFTEST_QUOTED;
      loadEnvFile(testEnvPath);
      check("loadEnvFile sets a plain KEY=value line from a .env file", process.env.SMART_OUTBOUND_ENGINE_SELFTEST_VAR === "hello world");
      check("loadEnvFile strips matching surrounding quotes", process.env.SMART_OUTBOUND_ENGINE_SELFTEST_QUOTED === "quoted value");
      process.env.SMART_OUTBOUND_ENGINE_SELFTEST_VAR = "already-set-in-real-shell";
      loadEnvFile(testEnvPath);
      check(
        "loadEnvFile never overrides a variable already set in the real environment",
        process.env.SMART_OUTBOUND_ENGINE_SELFTEST_VAR === "already-set-in-real-shell"
      );
    } finally {
      try {
        unlinkSync(testEnvPath);
      } catch {
        // fine if it was never created
      }
      delete process.env.SMART_OUTBOUND_ENGINE_SELFTEST_VAR;
      delete process.env.SMART_OUTBOUND_ENGINE_SELFTEST_QUOTED;
    }
  }

  {
    // 2026-09-14 (per Gemini): getFollowUpEligibleLeads()/parseSentTimestamp()
    // back the new --follow-up mode.
    check("parseSentTimestamp parses a real 'Sent <ISO>' status", parseSentTimestamp("Sent 2026-09-10T14:35:17.780Z") instanceof Date);
    check("parseSentTimestamp returns null for Pending (never sent)", parseSentTimestamp("Pending") === null);
    check(
      "parseSentTimestamp returns null for Followup Sent (already followed up, not a fresh Sent)",
      parseSentTimestamp("Followup Sent 2026-09-12T00:00:00.000Z") === null
    );
    check("parseSentTimestamp returns null for a malformed date", parseSentTimestamp("Sent not-a-date") === null);
    check("parseSentTimestamp returns null for a missing/undefined status", parseSentTimestamp(undefined) === null);

    const now = new Date("2026-09-14T12:00:00.000Z");
    const followUpSample = [
      { domain: "too-recent.com", status: "Sent 2026-09-13T12:00:00.000Z", contactEmail: "a@too-recent.com" }, // 24h -- too soon
      { domain: "eligible.com", status: "Sent 2026-09-11T00:00:00.000Z", contactEmail: "b@eligible.com" }, // 84h -- eligible
      { domain: "still-pending.com", status: "Pending", contactEmail: "c@still-pending.com" },
      { domain: "already-followed-up.com", status: "Followup Sent 2026-09-12T00:00:00.000Z", contactEmail: "d@already-followed-up.com" },
      { domain: "suppressed.com", status: "Sent 2026-09-10T00:00:00.000Z", contactEmail: "e@suppressed.com" },
      { domain: "no-email.com", status: "Sent 2026-09-10T00:00:00.000Z", contactEmail: null },
    ];
    const suppressionSet = new Set(["e@suppressed.com"]);
    const followUpEligible = getFollowUpEligibleLeads(followUpSample, { suppressionSet, now });
    check("getFollowUpEligibleLeads excludes a lead sent less than FOLLOWUP_MIN_HOURS ago", !followUpEligible.some((l) => l.domain === "too-recent.com"));
    check("getFollowUpEligibleLeads includes a lead past FOLLOWUP_MIN_HOURS", followUpEligible.some((l) => l.domain === "eligible.com"));
    check("getFollowUpEligibleLeads excludes a Pending (never-sent) lead", !followUpEligible.some((l) => l.domain === "still-pending.com"));
    check("getFollowUpEligibleLeads excludes a lead already followed up", !followUpEligible.some((l) => l.domain === "already-followed-up.com"));
    check("getFollowUpEligibleLeads excludes a suppressed address even past the time threshold", !followUpEligible.some((l) => l.domain === "suppressed.com"));
    check("getFollowUpEligibleLeads excludes a lead with no contact email", !followUpEligible.some((l) => l.domain === "no-email.com"));
    check(
      "getFollowUpEligibleLeads respects an explicit limit",
      getFollowUpEligibleLeads(followUpSample, { suppressionSet, now, limit: 1 }).length === 1
    );
  }

  {
    const withBeta = buildFollowUpDraft({
      storeName: "Cool Threads",
      contactEmail: "heather@coolthreads.com",
      installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
      physicalAddress: "LeakAudit, P.O. Box 42, Nes Harim, Israel",
      initialSubject: "Quick question about Cool Threads's margins",
      includeFounderBetaLine: true,
    });
    check("buildFollowUpDraft subject is 'Re: ' plus the original subject, unchanged", withBeta.subject === "Re: Quick question about Cool Threads's margins");
    check("buildFollowUpDraft greets a real first name directly, same rule as the initial email", withBeta.body.startsWith("Hi Heather,"));
    check("buildFollowUpDraft mentions the Founder Beta spot when the original email included it", withBeta.body.includes("still holding a spot"));
    check(
      "buildFollowUpDraft always includes the physical address (CAN-SPAM applies to every email, not just the first)",
      withBeta.body.includes("P.O. Box 42, Nes Harim, Israel")
    );
    check("buildFollowUpDraft always includes an opt-out instruction (CAN-SPAM)", /reply stop/i.test(withBeta.body));
    check("buildFollowUpDraft includes the real install link", withBeta.body.includes("https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct"));

    const withoutBeta = buildFollowUpDraft({
      storeName: "Cool Threads",
      contactEmail: "info@coolthreads.com",
      installLink: "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct",
      physicalAddress: "123 Main St, Anytown, ST 00000",
      initialSubject: "Quick question about Cool Threads's margins",
      includeFounderBetaLine: false,
    });
    check("buildFollowUpDraft falls back to the team greeting for a generic contact email", withoutBeta.body.startsWith("Hi there,"));
    check(
      "buildFollowUpDraft never mentions a Founder Beta spot when the original email didn't include one (never retracts or invents an offer)",
      !/founder beta/i.test(withoutBeta.body)
    );
  }

  check(
    "toCsvRows header now also carries the follow-up columns, without breaking the original 9-column prefix",
    toCsvRows([]).startsWith(
      "Shop URL,Email,Status,Personalized Subject,Personalized Body,Store Name,Product Count,Detected Leaks,Install Link,Follow-Up Subject,Follow-Up Body"
    )
  );
  check(
    "toCsvRows defaults missing follow-up fields to empty strings rather than 'undefined'",
    !toCsvRows([
      {
        shopUrl: "https://x.com",
        contactEmail: "a@x.com",
        personalizedSubject: "s",
        personalizedBody: "b",
        storeName: "X",
        productCount: 1,
        detectedLeaks: "d",
        installLink: "i",
      },
    ]).includes("undefined")
  );

  check(
    "DEFAULT_DORK_QUERIES was expanded to 11 niches (2026-09-14) and hasn't silently shrunk back",
    DEFAULT_DORK_QUERIES.length === 11
  );
  check(
    "DEFAULT_DORK_QUERIES still excludes shopify.com in every query (a query without it would defeat its own purpose)",
    DEFAULT_DORK_QUERIES.every((q) => q.includes("-site:shopify.com"))
  );
  check(
    "ALL_DORK_QUERIES is 11 original + every extra niche, all excluding shopify.com, no duplicates",
    ALL_DORK_QUERIES.length === DEFAULT_DORK_QUERIES.length + EXTRA_NICHES.length &&
      ALL_DORK_QUERIES.every((q) => q.includes("-site:shopify.com")) &&
      new Set(ALL_DORK_QUERIES).size === ALL_DORK_QUERIES.length &&
      EXTRA_NICHES.length >= 60
  );
  check(
    "sanitizeContactEmail drops junk addresses seen in the 2026-10-11 discovery run",
    sanitizeContactEmail("your@email.com", "a.com") === null &&
      sanitizeContactEmail("aa4cacd33be28673d7e69be559ce7ad7@o4506196830715904.ingest.us.sentry.io", "a.com") === null &&
      sanitizeContactEmail("e7d54b729aaf49ea8b2f80dae22860aa@sentry.zipify.com", "a.com") === null &&
      sanitizeContactEmail("98107info@floodyoga.com", "a.com") === null &&
      sanitizeContactEmail("payments@bestforminc.com", "a.com") === null &&
      sanitizeContactEmail("orders@x.com", "x.com") === null &&
      sanitizeContactEmail("namdh@bsscommerce.com", "a.com") === null &&
      sanitizeContactEmail("recipient@giftnote.com", "a.com") === null &&
      sanitizeContactEmail("someone@gmail.com", "theme211-swimwear.myshopify.com") === null &&
      sanitizeContactEmail(null, "a.com") === null
  );
  check(
    "sanitizeContactEmail repairs URL-encoded nbsp and keeps good addresses",
    sanitizeContactEmail("%C2%A0info@morebeachwear.com", "morebeachwear.com") === "info@morebeachwear.com" &&
      sanitizeContactEmail("Info@WearOYA.com", "wearoya.com") === "info@wearoya.com" &&
      sanitizeContactEmail("itsjojewelry@gmail.com", "jojewelry.store") === "itsjojewelry@gmail.com" &&
      sanitizeContactEmail("hello@goldenfinchhomeandboutique.com", "goldenfinch-boutique.myshopify.com") === "hello@goldenfinchhomeandboutique.com"
  );
  check(
    "parseArgs reads --pages and --require-email",
    (() => {
      const a = parseArgs(["--discover", "--pages", "3", "--require-email"]);
      return a.pages === 3 && a.requireEmail === true && parseArgs([]).pages === 1 && parseArgs([]).requireEmail === false;
    })()
  );
  check(
    "DEFAULT_DORK_QUERIES includes a couple of the newly-added niches",
    DEFAULT_DORK_QUERIES.some((q) => q.includes("pet accessories")) &&
      DEFAULT_DORK_QUERIES.some((q) => q.includes("swimwear resortwear"))
  );

  {
    // 2026-09-14 (per Gemini/Omer): loadRejectedDomains()/saveRejectedDomains()
    // back the new persistent negative-domain cache used by --discover.
    const testPath = join(tmpdir(), `smart-outbound-engine-selftest-rejected-${process.pid}.json`);
    try {
      const emptyLoad = await loadRejectedDomains(testPath);
      check("loadRejectedDomains returns an empty Map when the file doesn't exist yet", emptyLoad instanceof Map && emptyLoad.size === 0);

      const map = new Map([
        ["badstore.com", "product count 3 outside the 8-200 SMB range"],
        ["agencyfront.com", 'title/meta reads as a software/app/agency site ("Shopify Experts")'],
      ]);
      await saveRejectedDomains(testPath, map);
      const reloaded = await loadRejectedDomains(testPath);
      check("saveRejectedDomains + loadRejectedDomains round-trips every domain", reloaded.size === 2 && reloaded.has("badstore.com") && reloaded.has("agencyfront.com"));
      check("loadRejectedDomains preserves the stored reason text", reloaded.get("badstore.com") === "product count 3 outside the 8-200 SMB range");

      writeFileSync(testPath, "not valid json{{{", "utf-8");
      const corruptLoad = await loadRejectedDomains(testPath);
      check("loadRejectedDomains tolerates a corrupt file by returning an empty Map instead of throwing", corruptLoad instanceof Map && corruptLoad.size === 0);
    } finally {
      try {
        unlinkSync(testPath);
      } catch {
        // fine if it was never created
      }
    }
  }

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
  process.exit(failures ? 1 : 0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP_TEXT = `smart_outbound_engine.mjs -- SMB Shopify lead discovery, qualification, and (optional) outreach

Two separate things this script does -- discovery (find/qualify new leads) and
dispatch (email leads already sitting in <output>.json). 2026-09-10: these used
to be silently coupled (--send always ran discovery first, whether you wanted
it to or not) -- fixed after a real run showed --send --limit 5 kicking off a
brand new Serper search instead of just sending the already-qualified Pending
leads sitting in the file. Now:
  --send alone           Dispatch-only. Zero discovery, zero Serper/Brave calls.
                          Reads <output>.json and emails up to --limit leads
                          that are Pending, have a contact email, aren't
                          suppressed, and weren't already contacted.
  --discover              Run discovery (see the Discovery section below) without
                          sending -- same as the old plain dry-run behavior.
  --discover --send       Discover first, then dispatch from the updated pool.
  (nothing / a discovery   Old default: running with a discovery source and no
   source, no --send)      --send flag still does a discovery-only dry run, for
                          anyone already using the script that way.
  --follow-up             Standalone follow-up dispatch (2026-09-14). Zero discovery. Reads
                          <output>.json and sends a single polite follow-up to leads whose
                          initial "Sent ..." is at least 48 hours old, aren't suppressed, and
                          haven't already been followed up.

Discovery (pick one or more -- processed in this order: seed domains, then Serper, then Brave):
  --seed-domains PATH   A text file of domains you curate (one per line, '#' comments allowed).
  --serper-key KEY      Serper.dev API key (or set SERPER_API_KEY). 2,500 free queries, no card required.
  --brave-key KEY       Brave Search API key (or set BRAVE_API_KEY). Free tier: ~$5/mo credit
                        (~1,000 queries) -- Brave DOES require a credit card on file for identity
                        verification, unlike Serper. Useful as a fallback if Serper signup/usage
                        is giving you trouble.

Options:
  --limit N             Discovery mode: max NEW qualified leads to collect this run (default: 20).
                        Dispatch mode (--send alone): max leads to actually email this run -- a
                        real cap that didn't exist before 2026-09-10 (previously --send with
                        discovery would attempt every sendable lead in the file in one go, with
                        the interactive confirmation as the only brake). --discover --send
                        together: governs the discovery step; the same number also caps how many
                        get dispatched afterward from the updated pool.
  --pages N             Discovery: Serper result pages to read per query (default 1; 3 is a good
                        value once the first page of every query has been exhausted).
  --require-email       Discovery: only keep stores where a contact email was found; the rest
                        don't count toward --limit and are cached as rejected.
  --delay SECONDS       Seconds to wait between HTTP requests (default: 2.0).
  --output BASENAME     Writes BASENAME.json and BASENAME.csv (default: qualified_smb_leads).
  --suppression-list P  Opt-out list path (default: suppression_list.json). Manually curated --
                        add an address with --suppress.
  --contacted-list P    Auto-maintained "already emailed" list (default: already_contacted.json),
                        checked before every send to avoid double-emailing across runs.
  --rejected-domains-list P
                        Auto-maintained negative-domain cache (default: rejected_domains.json,
                        2026-09-14) -- every domain discovery has disqualified (wrong product
                        count, not really Shopify, agency/software site, excluded by domain/URL
                        filter) is recorded here with a reason. Checked before ANY HTTP request on
                        a repeat discovery run, so a domain that already cost a homepage fetch and
                        a /products.json fetch to reject doesn't cost either one again. Deliberately
                        does NOT cache a transient fetch failure (site briefly down, network blip)
                        -- only a confirmed, durable disqualification.
  --suppress EMAIL      Add EMAIL to the suppression list and exit (no discovery/sending).
  --test-email ADDRESS  Send the FIRST lead currently in <output>.json to ADDRESS instead of its
                        real contact -- lets you check formatting/links on your own phone before
                        any merchant sees anything. Still requires RESEND_API_KEY, RESEND_FROM_EMAIL,
                        and a real SENDER_PHYSICAL_ADDRESS (so the preview matches a real send byte
                        for byte), but skips the "type SEND" prompt since no real recipient is
                        touched. Does not mark that lead as sent. Run a plain discovery pass first
                        so <output>.json has at least one lead.
  --send                Dispatch (see above). Requires RESEND_API_KEY, RESEND_FROM_EMAIL, and
                        SENDER_PHYSICAL_ADDRESS env vars, and an interactive "type SEND to
                        confirm" prompt -- nothing is emailed without that confirmation.
  --discover             Explicitly run discovery. See the summary above for how this combines
                        with --send.
  --refresh-drafts      Regenerate personalizedSubject/personalizedBody for every lead in
                        <output>.json whose status is NOT "Sent ..." (using the current
                        SENDER_PHYSICAL_ADDRESS, current copy template, and current Founder
                        Beta slot count), then exit -- no discovery, no sending. Use this after
                        any copy/template change (including this one, 2026-09-10) so cached
                        drafts that were written before the change -- which can otherwise still
                        contain stale copy or even a literal
                        "[SENDER_PHYSICAL_ADDRESS not set...]" placeholder if they were first
                        generated before you set that env var -- don't get sent as-is. Leads
                        already marked "Sent ..." are left untouched (their copy already went
                        out; rewriting it after the fact would misrepresent what the recipient
                        actually received).
  --follow-up            Send a single follow-up to every lead whose initial send is at least
                        48 hours old (FOLLOWUP_MIN_HOURS) -- deliberately just a floor, not a
                        48-72h window, so a lead isn't silently skipped forever if this isn't
                        run on the exact right day. Requires the same RESEND_API_KEY,
                        RESEND_FROM_EMAIL, and SENDER_PHYSICAL_ADDRESS env vars and "type SEND"
                        confirmation as --send. Subject is "Re: " + the original subject; the
                        Founder Beta mention is only included if that lead's original email
                        included it (checked per-lead, not against today's global sent count,
                        so a follow-up never retracts or invents an offer). Marks a followed-up
                        lead "Followup Sent <ISO date>" so it is never followed up twice.
  --selftest            Run offline self-tests and exit (no network needed).
  --help, -h             Show this help text.

Environment variables:
  SENDER_PHYSICAL_ADDRESS  Required for --send. Must be a real physical postal address (a street
                           address, a USPS-registered P.O. Box, or a private mailbox registered
                           with a commercial mail receiving agency) -- CAN-SPAM requires this, and
                           --send hard-refuses if this looks like an email address instead.
                           Deliberately has NO default baked into this script: a real address is a
                           deliberate per-sender choice, not something safe to silently fall back
                           to, and hardcoding one into source control isn't a great idea either.
  SENDER_REPLY_TO          Optional. If set, replies (including "Reply STOP" opt-outs) route to
                           this address instead of RESEND_FROM_EMAIL's default reply behavior.
                           Whoever this points to is responsible for actually monitoring it and
                           honoring opt-out requests within 10 business days, per CAN-SPAM.

Loading env vars from a file (2026-09-10): instead of re-\`export\`ing RESEND_API_KEY,
RESEND_FROM_EMAIL, SENDER_PHYSICAL_ADDRESS, SENDER_REPLY_TO, SERPER_API_KEY, and
BRAVE_API_KEY every new terminal session, put them in a \`.env\` (and/or \`.env.local\`,
which wins if both set the same key) file in this directory -- KEY=value per line,
'#' comments allowed, quotes around a value are stripped. Both files are read
automatically. A variable already \`export\`ed in your real shell always wins over
either file, so this is a convenience default, not a way around setting them.
IMPORTANT: add .env and .env.local to .gitignore before putting real secrets in
them (already done in this repo) -- never commit these files.

This script is cumulative (2026-09-10): every run loads whatever's already in
<output>.json, skips re-qualifying domains already present, and only adds
genuinely new leads -- so repeated runs grow one master list instead of
overwriting it. Existing leads' Status (e.g. already "Sent ...") is carried
forward untouched.
`;

function parseArgs(argv) {
  const args = {
    seedDomainsPath: null,
    serperKey: process.env.SERPER_API_KEY || null,
    braveKey: process.env.BRAVE_API_KEY || null,
    limit: 20,
    delay: 2.0,
    output: DEFAULT_OUTPUT_BASENAME,
    suppressionListPath: DEFAULT_SUPPRESSION_LIST_PATH,
    contactedListPath: DEFAULT_CONTACTED_LIST_PATH,
    rejectedDomainsPath: DEFAULT_REJECTED_DOMAINS_PATH,
    pages: 1,
    requireEmail: false,
    suppressEmail: null,
    testEmail: null,
    send: false,
    discover: false,
    followUp: false,
    refreshDrafts: false,
    selftest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed-domains") args.seedDomainsPath = argv[++i];
    else if (arg === "--serper-key") args.serperKey = argv[++i];
    else if (arg === "--brave-key") args.braveKey = argv[++i];
    else if (arg === "--limit") args.limit = parseInt(argv[++i], 10);
    else if (arg === "--delay") args.delay = parseFloat(argv[++i]);
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--suppression-list") args.suppressionListPath = argv[++i];
    else if (arg === "--contacted-list") args.contactedListPath = argv[++i];
    else if (arg === "--rejected-domains-list") args.rejectedDomainsPath = argv[++i];
    else if (arg === "--pages") args.pages = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (arg === "--require-email") args.requireEmail = true;
    else if (arg === "--suppress") args.suppressEmail = argv[++i];
    else if (arg === "--test-email") args.testEmail = argv[++i];
    else if (arg === "--send") args.send = true;
    else if (arg === "--discover") args.discover = true;
    else if (arg === "--follow-up") args.followUp = true;
    else if (arg === "--refresh-drafts") args.refreshDrafts = true;
    else if (arg === "--selftest") args.selftest = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }
  if (args.selftest) {
    console.log("Running offline self-tests (no network required)...");
    await runSelftest();
    return;
  }
  if (args.suppressEmail) {
    const set = await loadEmailSet(args.suppressionListPath);
    set.add(args.suppressEmail.toLowerCase());
    await saveEmailSet(args.suppressionListPath, set);
    console.log(`Added ${args.suppressEmail} to ${args.suppressionListPath}. It will be excluded from all future runs.`);
    return;
  }

  if (args.testEmail) {
    const existingLeads = await loadExistingLeads(`${args.output}.json`);
    if (existingLeads.length === 0) {
      console.error(
        `No leads found in ${args.output}.json -- run a plain discovery pass first (no --send) before using --test-email.`
      );
      process.exit(1);
    }
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL;
    const senderAddress = process.env.SENDER_PHYSICAL_ADDRESS;
    const missingEnv = [
      !apiKey && "RESEND_API_KEY",
      !fromAddress && "RESEND_FROM_EMAIL",
      !senderAddress &&
        "SENDER_PHYSICAL_ADDRESS (required even for a test send -- so the preview matches exactly what a real recipient would get)",
    ].filter(Boolean);
    if (missingEnv.length) {
      console.error(`Cannot --test-email: missing required environment variable(s):\n  ${missingEnv.join("\n  ")}`);
      process.exit(1);
    }
    if (looksLikeEmailAddress(senderAddress)) {
      console.error(
        `Cannot --test-email: SENDER_PHYSICAL_ADDRESS ("${senderAddress}") looks like an email address, not a postal address. Same rule as --send.`
      );
      process.exit(1);
    }
    const replyTo = process.env.SENDER_REPLY_TO || null;
    const lead = existingLeads[0];
    console.log(
      `Sending a test copy of the ${lead.domain} lead to ${args.testEmail} -- its real contact (${lead.contactEmail || "none found"}) is NOT touched by this.`
    );
    const result = await sendViaResend(
      { ...lead, contactEmail: args.testEmail },
      { apiKey, fromAddress, replyTo, testSalt: Date.now() }
    );
    if (result.ok) {
      console.log(
        `  [sent] Test copy delivered to ${args.testEmail}. This lead's status is unchanged ("${lead.status || "Pending"}") -- --test-email never marks a lead as sent.`
      );
    } else {
      console.error(`  [failed] HTTP ${result.status}: ${JSON.stringify(result.body)}`);
      process.exit(1);
    }
    return;
  }

  if (args.refreshDrafts) {
    const existingLeads = await loadExistingLeads(`${args.output}.json`);
    if (existingLeads.length === 0) {
      console.error(`No leads found in ${args.output}.json -- nothing to refresh.`);
      process.exit(1);
    }
    const physicalAddress =
      process.env.SENDER_PHYSICAL_ADDRESS || "[SENDER_PHYSICAL_ADDRESS not set -- required before --send]";
    if (looksLikeEmailAddress(physicalAddress)) {
      console.error(
        `Refusing --refresh-drafts: SENDER_PHYSICAL_ADDRESS ("${physicalAddress}") looks like an email address, not a postal address. Same rule as --send.`
      );
      process.exit(1);
    }
    const sentCountSoFar = existingLeads.filter((l) => String(l.status || "").startsWith("Sent")).length;
    const includeFounderBeta = shouldIncludeFounderBeta(sentCountSoFar);
    let refreshedCount = 0;
    let skippedSentCount = 0;
    let removedEmailCount = 0;
    for (const lead of existingLeads) {
      if (String(lead.status || "").startsWith("Sent")) {
        skippedSentCount++;
        continue; // never rewrite copy that's already gone out to a real person
      }
      // Re-validate the stored address (2026-10-11): leads discovered before
      // sanitizeContactEmail existed may carry junk addresses.
      if (lead.contactEmail) {
        const cleaned = sanitizeContactEmail(lead.contactEmail, lead.domain);
        if (cleaned !== lead.contactEmail) {
          if (!cleaned) {
            console.log(`  [clean] ${lead.domain}: dropped unusable email ${JSON.stringify(lead.contactEmail)}`);
            removedEmailCount++;
          }
          lead.contactEmail = cleaned;
        }
      }
      const installLink = buildInstallLink(lead.domain);
      const { subject, body } = buildPersonalizedDraft({
        storeName: lead.storeName,
        domain: lead.domain,
        hasCrossBorder: inferHasCrossBorderFromLabel(lead.detectedLeaks),
        physicalAddress,
        installLink,
        includeFounderBeta,
        contactEmail: lead.contactEmail,
      });
      lead.personalizedSubject = subject;
      lead.personalizedBody = body;
      lead.installLink = installLink;
      refreshedCount++;
    }
    await writeFile(`${args.output}.json`, JSON.stringify(existingLeads, null, 2) + "\n", "utf-8");
    await writeFile(`${args.output}.csv`, toCsvRows(existingLeads), "utf-8");
    console.log(
      `Refreshed ${refreshedCount} draft(s) with the current template and SENDER_PHYSICAL_ADDRESS (${skippedSentCount} already-"Sent" lead(s) left untouched; ${removedEmailCount} unusable email address(es) removed). Founder Beta offer ${
        includeFounderBeta ? "included" : "OMITTED (cap reached)"
      } in the refreshed drafts. Wrote ${args.output}.json and ${args.output}.csv -- review before --send.`
    );
    return;
  }

  // --follow-up: standalone follow-up dispatch (2026-09-14, per Gemini).
  // Zero discovery, zero interaction with Pending leads -- reads
  // <output>.json and follows up on leads whose initial "Sent ..." is at
  // least FOLLOWUP_MIN_HOURS old. Checked before --send/--discover below
  // since there's no scenario where combining flags is intentional.
  if (args.followUp) {
    const existingLeads = await loadExistingLeads(`${args.output}.json`);
    if (existingLeads.length === 0) {
      console.error(`No leads found in ${args.output}.json -- nothing to follow up on.`);
      process.exit(1);
    }
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL;
    const senderAddress = process.env.SENDER_PHYSICAL_ADDRESS;
    const replyTo = process.env.SENDER_REPLY_TO || null;
    const missingEnv = [
      !apiKey && "RESEND_API_KEY",
      !fromAddress && "RESEND_FROM_EMAIL",
      !senderAddress &&
        "SENDER_PHYSICAL_ADDRESS (CAN-SPAM requires a real physical postal address in every commercial email, follow-ups included)",
    ].filter(Boolean);
    if (missingEnv.length) {
      console.error(`Cannot --follow-up: missing required environment variable(s):\n  ${missingEnv.join("\n  ")}`);
      process.exit(1);
    }
    if (looksLikeEmailAddress(senderAddress)) {
      console.error(
        `Cannot --follow-up: SENDER_PHYSICAL_ADDRESS ("${senderAddress}") looks like an email address, not a postal address. Same rule as --send.`
      );
      process.exit(1);
    }

    const suppressionSet = await loadEmailSet(args.suppressionListPath);
    const toFollowUp = getFollowUpEligibleLeads(existingLeads, { suppressionSet, limit: args.limit });
    console.log(
      `Loaded ${existingLeads.length} lead(s) from ${args.output}.json -- ${toFollowUp.length} eligible for a follow-up ` +
        `(sent at least ${FOLLOWUP_MIN_HOURS}h ago, not suppressed, not already followed up), capped at --limit ${args.limit}.`
    );

    await promptAndSendFollowUps(toFollowUp, existingLeads, {
      apiKey,
      fromAddress,
      replyTo,
      physicalAddress: senderAddress,
      output: args.output,
    });
    return;
  }

  // --send WITHOUT --discover: standalone dispatch-only mode (2026-09-10,
  // see the Producer/Consumer comment block above getSendableLeads()).
  // Zero network discovery, zero Serper/Brave calls -- just reads
  // <output>.json and dispatches to leads already marked Pending.
  if (args.send && !args.discover) {
    const existingLeads = await loadExistingLeads(`${args.output}.json`);
    if (existingLeads.length === 0) {
      console.error(
        `No leads found in ${args.output}.json -- nothing to dispatch. Run a discovery pass first: add --discover to this command (or run without --send).`
      );
      process.exit(1);
    }
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL;
    const senderAddress = process.env.SENDER_PHYSICAL_ADDRESS;
    const replyTo = process.env.SENDER_REPLY_TO || null;
    const missingEnv = [
      !apiKey && "RESEND_API_KEY",
      !fromAddress && "RESEND_FROM_EMAIL",
      !senderAddress && "SENDER_PHYSICAL_ADDRESS (CAN-SPAM requires a real physical postal address in every commercial email)",
    ].filter(Boolean);
    if (missingEnv.length) {
      console.error(`Cannot --send: missing required environment variable(s):\n  ${missingEnv.join("\n  ")}`);
      process.exit(1);
    }
    if (looksLikeEmailAddress(senderAddress)) {
      console.error(
        `Cannot --send: SENDER_PHYSICAL_ADDRESS ("${senderAddress}") looks like an email address, not a postal address.\n` +
          "CAN-SPAM requires an actual physical mailing address -- your street address, a USPS-registered P.O. Box, " +
          "or a private mailbox registered with a commercial mail receiving agency (e.g. a UPS Store box under a USPS Form 1583). " +
          "An email address does not satisfy this, regardless of formatting."
      );
      process.exit(1);
    }

    const suppressionSet = await loadEmailSet(args.suppressionListPath);
    const contactedSet = await loadEmailSet(args.contactedListPath);
    const toSend = getSendableLeads(existingLeads, { suppressionSet, contactedSet, limit: args.limit });
    console.log(
      `Loaded ${existingLeads.length} lead(s) from ${args.output}.json -- ${toSend.length} eligible to dispatch this run (Pending status, has a contact email, not suppressed, not already contacted), capped at --limit ${args.limit}.`
    );

    await promptAndSend(toSend, existingLeads, {
      apiKey,
      fromAddress,
      replyTo,
      contactedSet,
      contactedListPath: args.contactedListPath,
      output: args.output,
    });
    return;
  }

  if (!args.seedDomainsPath && !args.serperKey && !args.braveKey) {
    console.error(
      "Need at least one discovery source: --seed-domains PATH, --serper-key KEY / SERPER_API_KEY env var, " +
        "or --brave-key KEY / BRAVE_API_KEY env var.\n" +
        "This script deliberately does not fall back to scraping DuckDuckGo's HTML endpoint -- see the module docstring."
    );
    process.exit(1);
  }

  let seedDomains = [];
  if (args.seedDomainsPath) {
    seedDomains = await loadSeedDomains(args.seedDomainsPath);
    console.log(`Loaded ${seedDomains.length} seed domain(s) from ${args.seedDomainsPath}.`);
  }

  const suppressionSet = await loadEmailSet(args.suppressionListPath);
  console.log(`Loaded ${suppressionSet.size} suppressed address(es) from ${args.suppressionListPath}.`);

  const rejectedDomains = await loadRejectedDomains(args.rejectedDomainsPath);
  console.log(`Loaded ${rejectedDomains.size} previously-rejected domain(s) from ${args.rejectedDomainsPath}.`);

  const existingLeads = await loadExistingLeads(`${args.output}.json`);
  console.log(
    `Loaded ${existingLeads.length} existing lead(s) from ${args.output}.json (cumulative mode -- this run adds new leads, it does not overwrite them).`
  );
  const alreadyKnownDomains = new Set(existingLeads.map((l) => l.domain));

  const { qualified, skippedViaRejectedCache } = await discoverAndQualify({
    seedDomains,
    dorkQueries: ALL_DORK_QUERIES,
    pages: args.pages,
    requireEmail: args.requireEmail,
    serperApiKey: args.serperKey,
    braveApiKey: args.braveKey,
    limit: args.limit,
    delayMs: args.delay * 1000,
    suppressionSet,
    alreadyKnownDomains,
    rejectedDomains,
  });

  // rejectedDomains was mutated in place by discoverAndQualify (both from
  // cache hits it already knew about and any newly-disqualified domains
  // this run) -- persist it now so the next run benefits too.
  await saveRejectedDomains(args.rejectedDomainsPath, rejectedDomains);

  console.log(
    `\nQualified ${qualified.length} new lead(s) this run` +
      (skippedViaRejectedCache
        ? ` (skipped ${skippedViaRejectedCache} previously-rejected domain(s) with zero new HTTP requests)`
        : "") +
      "."
  );

  // A placeholder is fine for dry-run output (so drafts are readable during
  // review) but --send refuses to fire without a real one -- see below.
  const physicalAddress =
    process.env.SENDER_PHYSICAL_ADDRESS || "[SENDER_PHYSICAL_ADDRESS not set -- required before --send]";
  const sentCountSoFar = existingLeads.filter((l) => String(l.status || "").startsWith("Sent")).length;
  const includeFounderBeta = shouldIncludeFounderBeta(sentCountSoFar);
  if (!includeFounderBeta) {
    console.log(
      `\n[note] Founder Beta cap (${FOUNDER_BETA_CAP}) appears reached (${sentCountSoFar} lead(s) already marked Sent) -- new drafts this run will NOT include the Founder Beta offer.`
    );
  }
  const newFullLeads = buildFullLeads(qualified, physicalAddress, includeFounderBeta);
  const fullLeads = mergeLeads(existingLeads, newFullLeads);

  await writeFile(`${args.output}.json`, JSON.stringify(fullLeads, null, 2) + "\n", "utf-8");
  await writeFile(`${args.output}.csv`, toCsvRows(fullLeads), "utf-8");
  console.log(
    `Master list now has ${fullLeads.length} lead(s) total (${newFullLeads.length} new this run) -- wrote ${args.output}.json and ${args.output}.csv.`
  );

  const sendableCount = fullLeads.filter((l) => l.contactEmail).length;
  console.log(`${sendableCount} of ${fullLeads.length} have a contact email and could be emailed; the rest have none found.`);

  if (!args.send) {
    console.log("\nDry run only -- nothing was sent. Re-run with --discover --send (or plain --send once you have Pending leads) once you've reviewed the output files.");
    return;
  }

  // -------------------------------------------------------------------
  // --discover --send together: discover first (above), then dispatch
  // from the freshly-updated pool. Everything below reuses the same
  // getSendableLeads()/promptAndSend() helpers as the dispatch-only path
  // above -- see the Producer/Consumer comment block near
  // getSendableLeads() for why --send alone no longer reaches this branch.
  // -------------------------------------------------------------------
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL;
  const senderAddress = process.env.SENDER_PHYSICAL_ADDRESS;
  const replyTo = process.env.SENDER_REPLY_TO || null;
  const missingEnv = [
    !apiKey && "RESEND_API_KEY",
    !fromAddress && "RESEND_FROM_EMAIL",
    !senderAddress && "SENDER_PHYSICAL_ADDRESS (CAN-SPAM requires a real physical postal address in every commercial email)",
  ].filter(Boolean);
  if (missingEnv.length) {
    console.error(`Cannot --send: missing required environment variable(s):\n  ${missingEnv.join("\n  ")}`);
    process.exit(1);
  }
  // SENDER_PHYSICAL_ADDRESS must be a physical postal address, not an
  // email -- CAN-SPAM requires a street address, a USPS-registered P.O.
  // Box, or a private mailbox registered with a commercial mail
  // receiving agency (verified against the FTC's own 2008 rule on this;
  // an email address does not satisfy the requirement no matter how it's
  // formatted). Added 2026-09-10 after being asked whether an email
  // address could be used here -- this is a hard block, not a warning,
  // since a non-compliant address is a real legal exposure, not a cosmetic
  // issue.
  if (looksLikeEmailAddress(senderAddress)) {
    console.error(
      `Cannot --send: SENDER_PHYSICAL_ADDRESS ("${senderAddress}") looks like an email address, not a postal address.\n` +
        "CAN-SPAM requires an actual physical mailing address -- your street address, a USPS-registered P.O. Box, " +
        "or a private mailbox registered with a commercial mail receiving agency (e.g. a UPS Store box under a USPS Form 1583). " +
        "An email address does not satisfy this, regardless of formatting."
    );
    process.exit(1);
  }

  const contactedSet = await loadEmailSet(args.contactedListPath);
  const toSend = getSendableLeads(fullLeads, { suppressionSet, contactedSet, limit: args.limit });
  await promptAndSend(toSend, fullLeads, {
    apiKey,
    fromAddress,
    replyTo,
    contactedSet,
    contactedListPath: args.contactedListPath,
    output: args.output,
  });
}

const isMainModule =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  // .env first (defaults), .env.local second so it can override .env --
  // same precedence convention as Next.js. Neither ever overrides a
  // variable already exported in the real shell (see loadEnvFile above).
  loadEnvFile(join(process.cwd(), ".env"));
  loadEnvFile(join(process.cwd(), ".env.local"));
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
