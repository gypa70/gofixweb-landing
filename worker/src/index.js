/**
 * GoFixWeb — příjem lead formuláře a spuštění GitHub Actions (repository_dispatch).
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN       — PAT s repo scope pro gofixweb-scanner
 *   STRIPE_SECRET_KEY  — Stripe secret key pro GET /checkout (Checkout Session)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret pro /stripe-webhook
 *   TURNSTILE_SECRET   — Turnstile secret key (siteverify)
 *   WEBHOOK_SECRET     — volitelný shared secret z formuláře
 *
 * GET /checkout — Stripe Checkout Session (manual_fix 3 990 Kč / wp_autofix 4 990 Kč).
 * POST /wp-onboarding — handshake WordPress REST + uložení credentials (GHA).
 */

const ALLOWED_ORIGINS = new Set([
  "https://gofixweb.com",
  "https://www.gofixweb.com",
]);

const TURNSTILE_ACTION = "free-report";
const TURNSTILE_HOSTNAMES = new Set(["gofixweb.com", "www.gofixweb.com"]);
const COMPLETE_AUDIT_AMOUNT = 499000;
const MANUAL_FIX_AMOUNT = 399000;
const COMPLETE_AUDIT_CURRENCY = "czk";
const ONBOARDING_URL = "https://gofixweb.com/wordpress-autofix";

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

function paidAuditProduct(session) {
  const currency = String(session?.currency || "").trim().toLowerCase();
  if (currency && currency !== COMPLETE_AUDIT_CURRENCY) return null;
  const amountTotal = Number(session?.amount_total ?? NaN);
  const ref = String(
    session?.client_reference_id || session?.metadata?.product || "",
  ).trim();
  if (ref === "manual_fix" || amountTotal === MANUAL_FIX_AMOUNT) return "manual_fix";
  if (ref === "wp_autofix") return "wp_autofix";
  if (amountTotal === COMPLETE_AUDIT_AMOUNT || ref === "complete_audit") return "complete_audit";
  return null;
}

function isCompleteAuditCheckout(session) {
  return paidAuditProduct(session) != null;
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
  const product = paidAuditProduct(session);
  if (!product) {
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
      product,
    });
  } catch (err) {
    console.error("stripe_dispatch_failed", err);
    return new Response("dispatch_failed", { status: 502 });
  }

  return stripeOkResponse({ ok: true, queued: true });
}

const WP_STATUS_MESSAGES = {
  ok: "Připojení k WordPressu ověřeno (200 OK). Údaje ukládáme šifrovaně.",
  unauthorized:
    "Přihlášení selhalo (401 Unauthorized). Zkontrolujte uživatelské jméno a Application Password.",
  forbidden:
    "Přístup zamítnut (403 Forbidden). Application Passwords mohou být vypnuté, e-shop neběží na HTTPS, nebo účet nemá oprávnění Editor / Administrátor.",
  timeout: "E-shop neodpověděl včas (connection timeout). Zkontrolujte URL a dostupnost webu.",
  connection_error: "Nelze se připojit k WordPress REST API. Zkontrolujte URL e-shopu.",
  invalid_url: "URL e-shopu musí začínat na https://.",
  invalid_input: "Vyplňte URL e-shopu, e-mail zákazníka, uživatelské jméno i Application Password.",
  http_error: "WordPress REST API vrátilo neočekávanou odpověď.",
};

function basicAuthHeader(username, appPassword) {
  const stripped = String(appPassword || "").replace(/\s+/g, "");
  const raw = `${username}:${stripped}`;
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return `Basic ${btoa(bin)}`;
}

function shopOriginFromUrl(siteUrl) {
  const parsed = new URL(siteUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

async function handshakeWordpress(siteUrl, username, appPassword) {
  const raw = String(siteUrl || "").trim();
  if (!raw.toLowerCase().startsWith("https://")) {
    return {
      ok: false,
      status: "invalid_url",
      message: WP_STATUS_MESSAGES.invalid_url,
      site_url: raw,
    };
  }

  let origin;
  try {
    origin = shopOriginFromUrl(raw);
  } catch {
    return {
      ok: false,
      status: "invalid_url",
      message: WP_STATUS_MESSAGES.invalid_url,
      site_url: raw,
    };
  }

  const restUrl = `${origin}/wp-json/wp/v2/users/me?context=edit`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(restUrl, {
      method: "GET",
      headers: {
        Authorization: basicAuthHeader(username, appPassword),
        Accept: "application/json",
        "User-Agent": "GoFixWeb-WordPressClient/1.0",
      },
      signal: controller.signal,
    });
    if (response.status === 401) {
      return {
        ok: false,
        status: "unauthorized",
        status_code: 401,
        message: WP_STATUS_MESSAGES.unauthorized,
        site_url: origin,
      };
    }
    if (response.status === 403) {
      return {
        ok: false,
        status: "forbidden",
        status_code: 403,
        message: WP_STATUS_MESSAGES.forbidden,
        site_url: origin,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: "http_error",
        status_code: response.status,
        message: WP_STATUS_MESSAGES.http_error,
        site_url: origin,
      };
    }
    const data = await response.json();
    return {
      ok: true,
      status: "ok",
      status_code: 200,
      message: WP_STATUS_MESSAGES.ok,
      site_url: origin,
      user_name: data.name || data.slug || username,
      roles: Array.isArray(data.roles) ? data.roles : [],
      domain: origin.replace(/^https:\/\//, "").replace(/^www\./, ""),
    };
  } catch (err) {
    const aborted = err && (err.name === "AbortError" || String(err).includes("abort"));
    return {
      ok: false,
      status: aborted ? "timeout" : "connection_error",
      message: aborted ? WP_STATUS_MESSAGES.timeout : WP_STATUS_MESSAGES.connection_error,
      site_url: origin,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleWpOnboarding(request, env, origin) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, status: "invalid_input", message: WP_STATUS_MESSAGES.invalid_input }, 400, origin);
  }

  const siteUrl = String(body.site_url || "").trim();
  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const appPassword = String(body.app_password || "");

  if (!siteUrl || !username || !EMAIL_RE.test(email) || !appPassword.trim()) {
    return jsonResponse(
      {
        ok: false,
        handshake_ok: false,
        saved: false,
        status: "invalid_input",
        kind: "error",
        message: WP_STATUS_MESSAGES.invalid_input,
      },
      400,
      origin,
    );
  }

  const handshake = await handshakeWordpress(siteUrl, username, appPassword);
  if (!handshake.ok) {
    return jsonResponse(
      {
        ok: false,
        handshake_ok: false,
        saved: false,
        status: handshake.status,
        kind: "error",
        message: handshake.message,
        status_code: handshake.status_code || null,
        site_url: handshake.site_url,
      },
      200,
      origin,
    );
  }

  try {
    await dispatchGithubEvent(env, "wp-onboarding-save", {
      site_url: handshake.site_url,
      username,
      email,
      app_password: appPassword,
    });
  } catch (err) {
    console.error("wp_onboarding_dispatch_failed", err);
    return jsonResponse(
      {
        ok: false,
        handshake_ok: true,
        saved: false,
        status: "save_failed",
        kind: "warning",
        message:
          "Připojení k WordPressu funguje, ale údaje se nepodařilo uložit. Napište na info@gofixweb.com.",
        user_name: handshake.user_name,
        roles: handshake.roles,
        domain: handshake.domain,
      },
      502,
      origin,
    );
  }

  return jsonResponse(
    {
      ok: true,
      handshake_ok: true,
      saved: true,
      status: "ok",
      kind: "success",
      message: handshake.message,
      user_name: handshake.user_name,
      roles: handshake.roles,
      domain: handshake.domain,
    },
    200,
    origin,
  );
}

async function handleCheckout(request, env) {
  const url = new URL(request.url);
  const product = String(url.searchParams.get("product") || "").trim();
  const domain = String(url.searchParams.get("domain") || "").trim();
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const secret = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) {
    return new Response("Stripe Checkout není nakonfigurovaný (STRIPE_SECRET_KEY).", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (product !== "manual_fix" && product !== "wp_autofix") {
    return new Response("Neznámý produkt.", { status: 400 });
  }

  const amount = product === "manual_fix" ? MANUAL_FIX_AMOUNT : COMPLETE_AUDIT_AMOUNT;
  const name =
    product === "manual_fix"
      ? "GoFixWeb — manuální oprava e-shopu"
      : "GoFixWeb — automatická oprava WordPress";
  let successUrl = "https://gofixweb.com/";
  if (product === "wp_autofix") {
    const next = new URL(ONBOARDING_URL);
    if (email && EMAIL_RE.test(email)) next.searchParams.set("email", email);
    if (domain) {
      const shop = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
      next.searchParams.set("shop", shop);
    }
    successUrl = next.toString();
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", successUrl);
  body.set("cancel_url", "https://gofixweb.com/");
  body.set("client_reference_id", product);
  body.set("metadata[product]", product);
  if (domain) body.set("metadata[domain]", domain);
  if (email && EMAIL_RE.test(email)) body.set("customer_email", email);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", COMPLETE_AUDIT_CURRENCY);
  body.set("line_items[0][price_data][unit_amount]", String(amount));
  body.set("line_items[0][price_data][product_data][name]", name);
  body.set("line_items[0][price_data][product_data][tax_code]", "txcd_10000000");
  body.set("managed_payments[enabled]", "false");
  body.set("locale", "cs");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("stripe_checkout_create_failed", response.status, text);
    return new Response("Nepodařilo se otevřít platbu. Zkuste to znovu.", { status: 502 });
  }
  const session = await response.json();
  if (!session.url) {
    return new Response("Stripe Checkout nevrátil URL.", { status: 502 });
  }
  return Response.redirect(session.url, 303);
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

    if (url.pathname === "/checkout") {
      return handleCheckout(request, env);
    }

    if (url.pathname === "/wp-onboarding") {
      return handleWpOnboarding(request, env, origin);
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
