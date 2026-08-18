/**
 * GoFixWeb — příjem lead formuláře a spuštění GitHub Actions (repository_dispatch).
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN       — PAT s repo scope pro gofixweb-scanner
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret pro /stripe-webhook
 *   TURNSTILE_SECRET   — Turnstile secret key (siteverify)
 *   WEBHOOK_SECRET     — volitelný shared secret z formuláře
 */

const ALLOWED_ORIGINS = new Set([
  "https://gofixweb.com",
  "https://www.gofixweb.com",
]);

const TURNSTILE_ACTION = "free-report";
const TURNSTILE_HOSTNAMES = new Set(["gofixweb.com", "www.gofixweb.com"]);
const COMPLETE_AUDIT_AMOUNT = 499000;
const COMPLETE_AUDIT_CURRENCY = "czk";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRIPE_TIMESTAMP_TOLERANCE_SEC = 300;

/** E-maily, které obcházejí rate limit (1 report/den) — jen pro interní testování. */
const RATE_LIMIT_WHITELIST = new Set([
  "trueforexway@gmail.com",
]);

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://gofixweb.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body, status = 200, origin = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function normalizeUrl(raw) {
  let value = String(raw || "").trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  const url = new URL(value);
  if (!url.hostname) throw new Error("invalid_url");
  return url.toString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isRateLimitWhitelisted(email) {
  return RATE_LIMIT_WHITELIST.has(String(email || "").trim().toLowerCase());
}

async function isRateLimited(email, cache) {
  const key = `https://rate.gofixweb/r/${todayKey()}/${email.toLowerCase()}`;
  const hit = await cache.match(key);
  if (hit) return true;
  await cache.put(key, new Response("1"), { expirationTtl: 86400 });
  return false;
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
}

async function verifyTurnstile(env, token, remoteIp) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    return { ok: false, error: "turnstile_not_configured" };
  }

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, error: "turnstile_missing" };
  }

  let result;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: remoteIp,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: "turnstile_verify_failed" };
    }
    result = await response.json();
  } catch (err) {
    console.error("turnstile_siteverify_error", err);
    return { ok: false, error: "turnstile_verify_failed" };
  }

  if (
    !result.success ||
    result.action !== TURNSTILE_ACTION ||
    !TURNSTILE_HOSTNAMES.has(result.hostname)
  ) {
    return { ok: false, error: "turnstile_invalid" };
  }

  return { ok: true };
}

async function dispatchGithub(env, payload) {
  const repo = env.GITHUB_REPO || "gypa70/gofixweb-scanner";
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("missing_github_token");

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "gofixweb-report-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "free-report-request",
      client_payload: payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_dispatch_failed:${res.status}:${text}`);
  }
}

async function dispatchGithubEvent(env, eventType, payload) {
  const repo = env.GITHUB_REPO || "gypa70/gofixweb-scanner";
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("missing_github_token");

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "gofixweb-report-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_dispatch_failed:${res.status}:${text}`);
  }
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseStripeSignatureHeader(header) {
  const parsed = { t: null, v1: [] };
  for (const part of String(header || "").split(",")) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;
    if (key === "t") parsed.t = value;
    if (key === "v1") parsed.v1.push(value);
  }
  return parsed;
}

function isCompleteAuditCheckout(session) {
  const currency = String(session?.currency || "").trim().toLowerCase();
  const amountTotal = Number(session?.amount_total ?? NaN);
  return currency === COMPLETE_AUDIT_CURRENCY && amountTotal === COMPLETE_AUDIT_AMOUNT;
}

async function verifyStripeWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    return { ok: false, error: "stripe_not_configured" };
  }
  if (!signatureHeader) {
    return { ok: false, error: "stripe_signature_missing" };
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp) || parsed.v1.length === 0) {
    return { ok: false, error: "stripe_signature_invalid" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > STRIPE_TIMESTAMP_TOLERANCE_SEC) {
    return { ok: false, error: "stripe_signature_expired" };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  const matched = parsed.v1.some((sig) => timingSafeEqualHex(sig, expected));
  return matched ? { ok: true } : { ok: false, error: "stripe_signature_invalid" };
}

function stripeOkResponse(body = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleStripeWebhook(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = request.headers.get("Stripe-Signature") || "";
  const rawBody = await request.text();
  const verify = await verifyStripeWebhookSignature(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!verify.ok) {
    return new Response(verify.error, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  if (event?.type !== "checkout.session.completed") {
    return stripeOkResponse({ ok: true, ignored: true });
  }

  const session = event?.data?.object || {};
  if (!isCompleteAuditCheckout(session)) {
    return stripeOkResponse({ ok: true, ignored: true, reason: "not_complete_audit" });
  }
  const email = String(
    session.customer_email || session.customer_details?.email || "",
  ).trim().toLowerCase();
  const eventId = String(event?.id || "").trim();

  if (!email || !EMAIL_RE.test(email) || !eventId) {
    return new Response("missing_email_or_event_id", { status: 400 });
  }

  try {
    await dispatchGithubEvent(env, "paid-audit-payment", {
      email,
      event_id: eventId,
    });
  } catch (err) {
    console.error("stripe_dispatch_failed", err);
    return new Response("dispatch_failed", { status: 502 });
  }

  return stripeOkResponse({ ok: true, queued: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/stripe-webhook") {
      return handleStripeWebhook(request, env);
    }

    if (url.pathname !== "/submit" || request.method !== "POST") {
      return jsonResponse({ ok: false, error: "not_found" }, 404, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "invalid_json" }, 400, origin);
    }

    if (env.WEBHOOK_SECRET && body.secret !== env.WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401, origin);
    }

    const turnstileToken = String(
      body.turnstile_token || body["cf-turnstile-response"] || "",
    ).trim();
    const turnstileCheck = await verifyTurnstile(env, turnstileToken, clientIp(request));
    if (!turnstileCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          error: turnstileCheck.error,
          message: "Ověření proti robotům selhalo. Obnovte stránku a zkuste to znovu.",
        },
        403,
        origin,
      );
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const shopUrlRaw = String(body.shop_url || body.shopUrl || "").trim();

    if (!name || !EMAIL_RE.test(email) || !shopUrlRaw) {
      return jsonResponse({ ok: false, error: "validation_failed" }, 400, origin);
    }

    let shop_url;
    try {
      shop_url = normalizeUrl(shopUrlRaw);
    } catch {
      return jsonResponse({ ok: false, error: "invalid_url" }, 400, origin);
    }

    const testRequest = isRateLimitWhitelisted(email);
    const cache = caches.default;
    if (!testRequest && (await isRateLimited(email, cache))) {
      return jsonResponse(
        { ok: false, error: "rate_limited", message: "Pro tento e-mail už dnes byl report odeslán." },
        429,
        origin,
      );
    }

    try {
      await dispatchGithub(env, {
        name,
        email,
        shop_url,
        skip_rate_limit: testRequest,
        test_request: testRequest,
      });
    } catch (err) {
      console.error(err);
      return jsonResponse({ ok: false, error: "dispatch_failed" }, 502, origin);
    }

    return jsonResponse({ ok: true, message: "Report bude odeslán do 10 minut." }, 200, origin);
  },
};
