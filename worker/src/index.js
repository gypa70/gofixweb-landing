/**
 * GoFixWeb Worker — Stripe Checkout, webhook a WordPress onboarding.
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN       — PAT s repo scope pro gofixweb-scanner
 *   STRIPE_SECRET_KEY  — Stripe secret key pro GET /checkout (Checkout Session)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret pro /stripe-webhook
 *   TURNSTILE_SECRET   — Turnstile secret key (siteverify)
 *
 * GET /checkout — Stripe Checkout Session (manual_fix 3 990 Kč ihned;
 *   wp_autofix 4 990 Kč až po povinném souhlasu s VOP).
 * POST /submit — formulář: whitelist e-mail spustí free scan, ostatní jen poptávku.
 * POST /wp-onboarding — handshake WordPress REST; uložení credentials běží v GHA.
 */

const ALLOWED_ORIGINS = new Set([
  "https://gofixweb.com",
  "https://www.gofixweb.com",
]);

const COMPLETE_AUDIT_AMOUNT = 499000;
const MANUAL_FIX_AMOUNT = 399000;
const COMPLETE_AUDIT_CURRENCY = "czk";
const MANUAL_FIX_NAME = "Manuální oprava e-shopu";
const AUTO_FIX_NAME = "Automatická oprava e-shopu";
const MANUAL_FIX_DESCRIPTION =
  "Přesný návod k opravě nálezů — zásahy provedete sami ve své administraci (jednorázová platba).";
const AUTO_FIX_DESCRIPTION =
  "Automatické zapsání SEO a rychlostních oprav přímo do vašeho WordPress webu (jednorázový zásah)";
const ONBOARDING_URL = "https://gofixweb.com/wordpress-autofix";
const VOP_VERSION = "2026-08-30";
const VOP_TERMS_URL = "https://gofixweb.com/terms.html";
const VOP_AUTOFIX_SECTION_URL = `${VOP_TERMS_URL}#vop-autofix-section`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRIPE_TIMESTAMP_TOLERANCE_SEC = 300;
const TURNSTILE_ACTION = "free-report";
const TURNSTILE_HOSTNAMES = new Set(["gofixweb.com", "www.gofixweb.com"]);

/** E-maily, které obcházejí rate limit a spouští plný scan — jen interní QC. */
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

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
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

async function handleLeadSubmit(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400, origin);
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
  const shopUrlRaw = String(body.shop_url || body.shopUrl || body.domain || "").trim();

  if (!name || !EMAIL_RE.test(email) || !shopUrlRaw) {
    return jsonResponse({ ok: false, error: "validation_failed" }, 400, origin);
  }

  let shop_url;
  try {
    shop_url = normalizeUrl(shopUrlRaw);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_url" }, 400, origin);
  }

  const domain = new URL(shop_url).hostname.replace(/^www\./i, "");
  const qcScan = isRateLimitWhitelisted(email);
  const cache = caches.default;
  if (!qcScan && (await isRateLimited(email, cache))) {
    return jsonResponse(
      {
        ok: false,
        error: "rate_limited",
        message: "Pro tento e-mail už dnes byl formulář odeslán.",
      },
      429,
      origin,
    );
  }

  try {
    if (qcScan) {
      await dispatchGithubEvent(env, "free-report-request", {
        name,
        email,
        shop_url,
        skip_rate_limit: true,
        test_request: true,
      });
      return jsonResponse(
        {
          ok: true,
          mode: "scan",
          message: "Report bude odeslán do 10 minut.",
        },
        200,
        origin,
      );
    }

    await dispatchGithubEvent(env, "landing-inquiry", {
      name,
      email,
      domain,
      shop_url,
      source: "landing_organic",
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: "dispatch_failed" }, 502, origin);
  }

  return jsonResponse(
    {
      ok: true,
      mode: "inquiry",
      message: "Děkujeme, brzy se vám ozveme.",
    },
    200,
    origin,
  );
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
      domain: String(session?.metadata?.domain || "").trim(),
    });
  } catch (err) {
    console.error("stripe_dispatch_failed", err);
    return new Response("dispatch_failed", { status: 502 });
  }

  return stripeOkResponse({ ok: true, queued: true });
}

const WP_COPY = {
  cz: {
    ok: "Připojení k WordPressu ověřeno. Údaje teď šifrujeme na serveru — potvrzení nebo výzvu k opakování pošleme e-mailem.",
    queued_meta: (domain) =>
      `Ověřeno pro ${domain}. Údaje se ukládají na serveru — výsledek pošleme e-mailem.`,
    unauthorized:
      "Přihlášení selhalo (401 Unauthorized). Zkontrolujte uživatelské jméno a Application Password.",
    forbidden:
      "Přístup zamítnut (403 Forbidden). Application Passwords mohou být vypnuté, e-shop neběží na HTTPS, nebo účet nemá oprávnění Editor / Administrátor.",
    timeout: "E-shop neodpověděl včas (connection timeout). Zkontrolujte URL a dostupnost webu.",
    connection_error: "Nelze se připojit k WordPress REST API. Zkontrolujte URL e-shopu.",
    invalid_url: "URL e-shopu musí začínat na https://.",
    invalid_input:
      "Vyplňte URL e-shopu, e-mail zákazníka, uživatelské jméno i Application Password a potvrďte souhlas s kroky automatické opravy.",
    http_error: "WordPress REST API vrátilo neočekávanou odpověď.",
    save_failed:
      "Připojení k WordPressu funguje, ale údaje se nepodařilo uložit. Napište na info@gofixweb.com.",
  },
  sk: {
    ok: "Pripojenie k WordPressu overené. Údaje teraz šifrujeme na serveri — potvrdenie alebo výzvu na opakovanie pošleme e-mailom.",
    queued_meta: (domain) =>
      `Overené pre ${domain}. Údaje sa ukladajú na serveri — výsledok pošleme e-mailom.`,
    unauthorized:
      "Prihlásenie zlyhalo (401 Unauthorized). Skontrolujte používateľské meno a Application Password.",
    forbidden:
      "Prístup zamietnutý (403 Forbidden). Application Passwords môžu byť vypnuté, e-shop nebeží na HTTPS, alebo účet nemá oprávnenie Editor / Administrátor.",
    timeout: "E-shop neodpovedal včas (connection timeout). Skontrolujte URL a dostupnosť webu.",
    connection_error: "Nedá sa pripojiť k WordPress REST API. Skontrolujte URL e-shopu.",
    invalid_url: "URL e-shopu musí začínať na https://.",
    invalid_input:
      "Vyplňte URL e-shopu, e-mail zákazníka, používateľské meno aj Application Password a potvrďte súhlas s krokmi automatickej opravy.",
    http_error: "WordPress REST API vrátilo neočakávanú odpoveď.",
    save_failed:
      "Pripojenie k WordPressu funguje, ale údaje sa nepodarilo uložiť. Napíšte na info@gofixweb.com.",
  },
};

function wpLocaleFromUrl(raw) {
  try {
    let value = String(raw || "").trim();
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    const host = new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
    return host.endsWith(".sk") ? "sk" : "cz";
  } catch {
    return "cz";
  }
}

function wpCopy(raw) {
  return WP_COPY[wpLocaleFromUrl(raw)] || WP_COPY.cz;
}

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
  const copy = wpCopy(raw);
  if (!raw.toLowerCase().startsWith("https://")) {
    return {
      ok: false,
      status: "invalid_url",
      message: copy.invalid_url,
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
      message: copy.invalid_url,
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
        message: copy.unauthorized,
        site_url: origin,
      };
    }
    if (response.status === 403) {
      return {
        ok: false,
        status: "forbidden",
        status_code: 403,
        message: copy.forbidden,
        site_url: origin,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: "http_error",
        status_code: response.status,
        message: copy.http_error,
        site_url: origin,
      };
    }
    const data = await response.json();
    return {
      ok: true,
      status: "ok",
      status_code: 200,
      message: copy.ok,
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
      message: aborted ? copy.timeout : copy.connection_error,
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
    return jsonResponse({ ok: false, status: "invalid_input", message: wpCopy("").invalid_input }, 400, origin);
  }

  const siteUrl = String(body.site_url || "").trim();
  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const appPassword = String(body.app_password || "");
  const consentSteps = body.consent_steps === true || body.consent_steps === "1" || body.consent_steps === "on";
  const consentInstall = body.consent_install_plugins === true || body.consent_install_plugins === "1" || body.consent_install_plugins === "on";
  const copy = wpCopy(siteUrl);

  if (!siteUrl || !username || !EMAIL_RE.test(email) || !appPassword.trim() || !consentSteps) {
    return jsonResponse(
      {
        ok: false,
        handshake_ok: false,
        saved: false,
        status: "invalid_input",
        kind: "error",
        locale: wpLocaleFromUrl(siteUrl),
        message: copy.invalid_input,
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
        locale: wpLocaleFromUrl(siteUrl),
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
      domain: handshake.domain,
      username,
      email,
      app_password: appPassword,
      consent_steps: true,
      consent_install_plugins: consentInstall,
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
          copy.save_failed,
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
      saved: false,
      queued: true,
      status: "queued",
      kind: "success",
      locale: wpLocaleFromUrl(handshake.site_url || siteUrl),
      queued_meta: copy.queued_meta(handshake.domain),
      message: handshake.message,
      user_name: handshake.user_name,
      roles: handshake.roles,
      domain: handshake.domain,
      consent_install_plugins: consentInstall,
    },
    200,
    origin,
  );
}

async function handleWpRollback(request, env) {
  const url = new URL(request.url);
  let token = String(url.searchParams.get("token") || "").trim();
  if (!token && request.method === "POST") {
    try {
      const body = await request.json();
      token = String((body && body.token) || "").trim();
    } catch {
      token = "";
    }
  }
  if (!token) {
    return new Response("Chybí token pro vrácení změny.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  try {
    await dispatchGithubEvent(env, "wp-rollback", { token });
  } catch (err) {
    console.error("wp_rollback_dispatch_failed", err);
    return new Response(
      "Požadavek na vrácení se nepodařilo odeslat. Napište na info@gofixweb.com.",
      { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  return new Response(
    "<!DOCTYPE html><html lang=\"cs\"><head><meta charset=\"utf-8\"><title>Vrácení opravy</title></head>" +
      "<body style=\"font-family:Segoe UI,sans-serif;max-width:560px;margin:40px auto;color:#1a2332;\">" +
      "<h1>Žádost o vrácení změny jsme přijali</h1>" +
      "<p>WordPress vrátíme do stavu před automatickou opravou. Pokud se to nepodaří, napište na info@gofixweb.com.</p>" +
      "</body></html>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isVopConsented(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "on" || raw === "true" || raw === "yes";
}

function autofixConsentPage({ domain = "", email = "", errorMessage = "" } = {}) {
  const err = errorMessage
    ? `<p class="err" id="vop-error">${escapeHtml(errorMessage)}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Souhlas s VOP — automatická oprava — GoFixWeb</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; background: #1a2332; color: #fff; line-height: 1.6; min-height: 100vh; }
    .wrap { width: min(560px, 92vw); margin: 0 auto; padding: 3rem 0 4rem; }
    h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.75rem; }
    p { color: #cbd5e1; margin-bottom: 1rem; }
    a { color: #16a34a; }
    .card { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; background: #243044; }
    label { display: flex; gap: 0.7rem; align-items: flex-start; color: #e2e8f0; font-size: 0.95rem; cursor: pointer; }
    input[type="checkbox"] { margin-top: 0.3rem; width: 1.1rem; height: 1.1rem; flex-shrink: 0; }
    button { margin-top: 1.25rem; width: 100%; border: 0; border-radius: 8px; padding: 0.85rem 1rem; font-weight: 700; font-size: 1rem; background: #16a34a; color: #fff; cursor: pointer; }
    button:disabled { background: #475569; color: #cbd5e1; cursor: not-allowed; }
    .err { color: #fca5a5; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Automatická oprava WordPress</h1>
    <p>Před platbou je potřeba souhlas s obchodními podmínkami a se zásahem do webu.</p>
    ${err}
    <form id="vop-consent-form" method="post" action="/checkout" class="card">
      <input type="hidden" name="product" value="wp_autofix">
      <input type="hidden" name="domain" value="${escapeHtml(domain)}">
      <input type="hidden" name="email" value="${escapeHtml(email)}">
      <label for="vop-consent">
        <input type="checkbox" id="vop-consent" name="vop_consent" value="1" required>
        <span>
          Souhlasím s
          <a href="${VOP_TERMS_URL}" target="_blank" rel="noopener">obchodními podmínkami</a>
          a s tím, že GoFixWeb provede automatické úpravy mého webu popsané v
          <a href="${VOP_AUTOFIX_SECTION_URL}" target="_blank" rel="noopener">čl. 8 VOP</a>
        </span>
      </label>
      <button type="submit" id="pay-btn" disabled>Pokračovat k platbě</button>
    </form>
  </div>
  <script>
    (function () {
      var cb = document.getElementById("vop-consent");
      var btn = document.getElementById("pay-btn");
      if (!cb || !btn) return;
      function sync() { btn.disabled = !cb.checked; }
      cb.addEventListener("change", sync);
      sync();
    })();
  </script>
</body>
</html>`;
  return new Response(html, {
    status: errorMessage ? 400 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleCheckout(request, env) {
  const url = new URL(request.url);
  let product = String(url.searchParams.get("product") || "").trim();
  let domain = String(url.searchParams.get("domain") || "").trim();
  let email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  let consent = "";

  if (request.method === "POST") {
    const form = await request.formData();
    product = String(form.get("product") || product).trim();
    domain = String(form.get("domain") || domain).trim();
    email = String(form.get("email") || email).trim().toLowerCase();
    consent = String(form.get("vop_consent") || "").trim();
  }

  if (product !== "manual_fix" && product !== "wp_autofix") {
    return new Response("Neznámý produkt.", { status: 400 });
  }

  if (product === "wp_autofix") {
    const consented = isVopConsented(consent);
    if (request.method !== "POST" || !consented) {
      return autofixConsentPage({
        domain,
        email,
        errorMessage:
          request.method === "POST" && !consented
            ? "Bez souhlasu s VOP nelze pokračovat k platbě."
            : "",
      });
    }
  }

  const secret = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) {
    return new Response("Stripe Checkout není nakonfigurovaný (STRIPE_SECRET_KEY).", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (product === "wp_autofix") {
    try {
      await dispatchGithubEvent(env, "wp-vop-consent", {
        email,
        domain,
        ip: clientIp(request),
        vop_version: VOP_VERSION,
        consent_at: new Date().toISOString(),
        product,
      });
    } catch (err) {
      console.error("vop_consent_dispatch_failed", err);
      return new Response("Souhlas se nepodařilo zaznamenat. Zkuste to znovu.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const amount = product === "manual_fix" ? MANUAL_FIX_AMOUNT : COMPLETE_AUDIT_AMOUNT;
  const name = product === "manual_fix" ? MANUAL_FIX_NAME : AUTO_FIX_NAME;
  const description = product === "manual_fix" ? MANUAL_FIX_DESCRIPTION : AUTO_FIX_DESCRIPTION;
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
  if (product === "wp_autofix") {
    body.set("metadata[vop_consent]", "1");
    body.set("metadata[vop_version]", VOP_VERSION);
  }
  if (domain) body.set("metadata[domain]", domain);
  if (email && EMAIL_RE.test(email)) body.set("customer_email", email);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", COMPLETE_AUDIT_CURRENCY);
  body.set("line_items[0][price_data][unit_amount]", String(amount));
  body.set("line_items[0][price_data][product_data][name]", name);
  body.set("line_items[0][price_data][product_data][description]", description);
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

    if (url.pathname === "/wp-rollback") {
      return handleWpRollback(request, env);
    }

    if (url.pathname === "/submit") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, origin);
      }
      return handleLeadSubmit(request, env, origin);
    }

    return jsonResponse({ ok: false, error: "not_found" }, 404, origin);
  },
};
