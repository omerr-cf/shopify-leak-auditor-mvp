import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

export const runtime = "nodejs";

/**
 * Read-only admin view of everything persisted by app/api/lead/route.ts.
 * Protected by a shared secret (ADMIN_SECRET env var) rather than a full
 * login system — proportionate for a solo-founder smoke test, not meant
 * to survive being a real product's admin panel.
 *
 * Usage: https://your-site.netlify.app/api/leads?secret=YOUR_ADMIN_SECRET
 *
 * Refuses to run at all if ADMIN_SECRET isn't set, so this endpoint can
 * never accidentally ship wide open.
 */
export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      {
        error:
          "ADMIN_SECRET is not configured on the server, so this endpoint is disabled.",
      },
      { status: 503 }
    );
  }

  const providedSecret = req.nextUrl.searchParams.get("secret");
  if (providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = getStore("leads");
    const { blobs } = await store.list();

    const leads = await Promise.all(
      blobs.map(async (blob) => {
        const data = await store.get(blob.key, { type: "json" });
        return data;
      })
    );

    // Newest first.
    leads.sort((a: any, b: any) => {
      const aTime = a?.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b?.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ count: leads.length, leads });
  } catch (err) {
    console.error("[api/leads] Failed to read from Netlify Blobs:", err);
    return NextResponse.json(
      {
        error:
          "Could not read the leads store. If you're running this locally, use `netlify dev` instead of `next dev` — Netlify Blobs needs Netlify's own environment.",
      },
      { status: 500 }
    );
  }
}
