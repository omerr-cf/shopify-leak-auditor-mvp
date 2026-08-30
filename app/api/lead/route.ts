import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

type LeadPayload = {
  storeUrl: string;
  email: string;
  revenue: string;
};

function isValidLead(body: unknown): body is LeadPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.storeUrl === "string" &&
    b.storeUrl.trim().length > 0 &&
    typeof b.email === "string" &&
    /^\S+@\S+\.\S+$/.test(b.email) &&
    typeof b.revenue === "string" &&
    b.revenue.trim().length > 0
  );
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(params: {
  storeUrl: string;
  email: string;
  revenue: string;
  submittedAt: string;
  referrer: string;
  ip: string;
}) {
  const rows: Array<[string, string]> = [
    ["Store URL", params.storeUrl],
    ["Work Email", params.email],
    ["Monthly Revenue", params.revenue],
    ["Submitted", params.submittedAt],
    ["Referrer", params.referrer],
    ["IP", params.ip],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:9px 0;color:#8b94a3;font-size:13px;border-bottom:1px solid #1F2937;">${escapeHtml(
            label
          )}</td>
          <td style="padding:9px 0;text-align:right;font-weight:600;color:#ffffff;font-size:13px;border-bottom:1px solid #1F2937;word-break:break-all;">${escapeHtml(
            value
          )}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#07090E;padding:32px 16px;">
      <div style="max-width:480px;margin:0 auto;background:#0F141D;border:1px solid #1F2937;border-radius:16px;overflow:hidden;">
        <div style="background:#10B981;padding:16px 24px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#07090E;">
            🔥 New Wave 1 Lead — LeakAudit
          </p>
        </div>
        <div style="padding:20px 24px 24px;">
          <table style="width:100%;border-collapse:collapse;">
            ${rowsHtml}
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#4b5563;">
            Sent automatically from the LeakAudit smoke-test landing page.
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!isValidLead(body)) {
    return NextResponse.json(
      {
        success: false,
        error: "storeUrl, email, and revenue are all required.",
      },
      { status: 400 }
    );
  }

  const { storeUrl, email, revenue } = body;
  const submittedAt = new Date().toISOString();
  const referrer = req.headers.get("referer") ?? "unknown";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Slight randomization so every visitor doesn't see the identical number.
  const queuePosition = Math.floor(Math.random() * 37) + 8;

  const notifyEmail = process.env.LEAD_NOTIFICATION_EMAIL || "omerbussy1995@gmail.com";
  const fromEmail =
    process.env.LEAD_FROM_EMAIL || "LeakAudit Leads <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY;

  const leadRecord = { storeUrl, email, revenue, submittedAt, referrer, ip };

  // --- No Resend key configured yet: log to console, never break the UI. ---
  if (!apiKey) {
    console.log(
      "[api/lead] RESEND_API_KEY not set — logging lead instead of emailing:",
      leadRecord
    );
    return NextResponse.json({
      success: true,
      queuePosition,
      emailed: false,
    });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: notifyEmail,
      subject: `🔥 New Shopify Store Lead: ${storeUrl} (${revenue})`,
      html: buildEmailHtml(leadRecord),
      reply_to: email,
    });

    if (error) {
      // Resend returned a structured error (bad domain, invalid key, etc.)
      // — log it, but the merchant-facing submission still succeeds.
      console.error("[api/lead] Resend returned an error:", error);
      console.log("[api/lead] Lead payload (fallback log):", leadRecord);
      return NextResponse.json({
        success: true,
        queuePosition,
        emailed: false,
      });
    }

    return NextResponse.json({ success: true, queuePosition, emailed: true });
  } catch (err) {
    // Network/SDK-level failure — same rule: never break the client UI
    // over an email delivery problem.
    console.error("[api/lead] Resend send threw:", err);
    console.log("[api/lead] Lead payload (fallback log):", leadRecord);
    return NextResponse.json({ success: true, queuePosition, emailed: false });
  }
}
