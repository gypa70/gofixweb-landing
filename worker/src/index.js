/**
 * GoFixWeb Worker — Stripe Checkout, webhook a WordPress onboarding.
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN       — PAT s repo scope pro gofixweb-scanner
 *   STRIPE_SECRET_KEY  — Stripe secret key pro GET /checkout (Checkout Session)
 *   STRIPE_SECRET_KEY_TEST — volitelně test-mode Stripe secret (GET u test eventů)
 *   STRIPE_WEBHOOK_SECRET — live webhook signing secret pro /stripe-webhook
 *   STRIPE_WEBHOOK_SECRET_TEST — test-mode webhook signing secret (stejná URL)
 *   TURNSTILE_SECRET   — Turnstile secret key (siteverify)
 *
 *   ADMIN_BASIC_PASSWORD — heslo Basic Auth pro GET /admin
 *   ADMIN_BASIC_USER     — volitelně (default gofixweb)
 *   UNSUBSCRIBE_SECRET   — HMAC pro /unsubscribe a /unsub-status
 *
 * GET /checkout — nabídka (manual_fix / wp_autofix jednorázově; basic/pro/premium
 *   měsíčně). POST spustí Stripe Checkout Session.
 * POST /stripe-webhook — checkout.session.completed (jednorázově) a invoice.paid
 *   / invoice.payment_failed / customer.subscription.deleted (předplatné).
 * POST /exit-intent — důvod odchodu z nabídky (price|trust|dismiss).
 * GET /survey/{id} — follow-up dotazník (price|trust|other) z 48h nebo 2h e-mailu.
 * POST /submit — formulář: whitelist e-mail spustí free scan, ostatní jen poptávku.
 * POST /wp-onboarding — handshake WordPress REST; uložení credentials běží v GHA.
 */

import { handleBlogRequest } from "./blog.js";

const ALLOWED_ORIGINS = new Set([
  "https://gofixweb.com",
  "https://www.gofixweb.com",
]);

const ALIAS_TLD_HOSTS = new Set([
  "gofixweb.cz",
  "www.gofixweb.cz",
  "gofixweb.eu",
  "www.gofixweb.eu",
  "gofixweb.de",
  "www.gofixweb.de",
  "gofixweb.ai",
  "www.gofixweb.ai",
]);

function aliasTldRedirect(request) {
  const url = new URL(request.url);
  if (!ALIAS_TLD_HOSTS.has(url.hostname.toLowerCase())) return null;
  const dest = new URL(request.url);
  dest.protocol = "https:";
  dest.hostname = "gofixweb.com";
  dest.port = "";
  dest.username = "";
  dest.password = "";
  return Response.redirect(dest.toString(), 301);
}

const ONE_TIME_FIX_AMOUNT = 199000;
const LEGACY_MANUAL_FIX_AMOUNT = 399000;
const LEGACY_AUTO_OR_AUDIT_AMOUNT = 499000;
const COMPLETE_AUDIT_AMOUNT = LEGACY_AUTO_OR_AUDIT_AMOUNT;
const MANUAL_FIX_AMOUNT = ONE_TIME_FIX_AMOUNT;
const COMPLETE_AUDIT_CURRENCY = "czk";
const STRIPE_COMPLETE_AUDIT_PAYMENT_LINK = "plink_1RUHIXFNuCwT88vQ2QjVj3Dz";
const STRIPE_MANUAL_FIX_PRICE_ID = "price_1UBU78Gx3oG33hb4pxNKgtEP";
const STRIPE_AUTO_FIX_PRICE_ID = "price_1UBU79Gx3oG33hb4lTT3JdEW";
const MANUAL_FIX_NAME = "Manuální oprava e-shopu";
const AUTO_FIX_NAME = "Automatická oprava e-shopu";
const MANUAL_FIX_DESCRIPTION =
  "Přesný návod k opravě nálezů — zásahy provedete sami ve své administraci (jednorázová platba).";
const AUTO_FIX_DESCRIPTION =
  "Automatické zapsání SEO a rychlostních oprav přímo do vašeho WordPress webu (jednorázový zásah)";
const ONBOARDING_URL = "https://gofixweb.com/wordpress-autofix";
const VOP_VERSION = "2026-09-04";
const VOP_TERMS_URL = "https://gofixweb.com/terms.html";
const VOP_AUTOFIX_SECTION_URL = `${VOP_TERMS_URL}#vop-autofix-section`;

const SUBSCRIPTION_PLANS = {
  basic: {
    amount: 149000,
    display: "Basic",
    priceEnv: "STRIPE_BASIC_PRICE_ID",
    priceLabel: "1 490 Kč / měsíc",
  },
  pro: {
    amount: 399000,
    display: "Pro",
    priceEnv: "STRIPE_PRO_PRICE_ID",
    priceLabel: "3 990 Kč / měsíc",
  },
  premium: {
    amount: 699000,
    display: "Premium",
    priceEnv: "STRIPE_PREMIUM_PRICE_ID",
    priceLabel: "6 990 Kč / měsíc",
  },
};

function isSubscriptionPlan(product) {
  return Boolean(SUBSCRIPTION_PLANS[String(product || "").trim().toLowerCase()]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRIPE_TIMESTAMP_TOLERANCE_SEC = 300;
const TURNSTILE_ACTION = "free-report";
const TURNSTILE_HOSTNAMES = new Set(["gofixweb.com", "www.gofixweb.com"]);

/** E-maily, které obcházejí rate limit a spouští plný scan — jen interní QC. */
const RATE_LIMIT_WHITELIST = new Set([
  "audit@gofixweb.com",
  "trueforexway@gmail.com",
  "trademaker@seznam.cz",
  "gofixweb@outlook.com",
  "test-i97m1naf4@srv1.mail-tester.com",
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

/** Interní / QC platby — mimo Objednávky a Tržby na /admin. */
const QC_ORDER_EMAILS = new Set([
  "trueforexway@gmail.com",
  "trademaker@seznam.cz",
  "gofixweb@outlook.com",
  "audit@gofixweb.com",
  "info@gofixweb.com",
]);

function isQcOrderEmail(email) {
  return QC_ORDER_EMAILS.has(String(email || "").trim().toLowerCase());
}

function stripeExpandedObject(value) {
  return value && typeof value === "object" ? value : null;
}

function isRefundedOrReversedSession(session) {
  const sessionStatus = String(session?.status || "").toLowerCase();
  if (sessionStatus === "expired" || sessionStatus === "open") return true;
  const paymentStatus = String(session?.payment_status || "").toLowerCase();
  if (paymentStatus && paymentStatus !== "paid") return true;
  const pi = stripeExpandedObject(session?.payment_intent);
  if (pi) {
    const piStatus = String(pi.status || "").toLowerCase();
    if (piStatus && piStatus !== "succeeded") return true;
    const charge = stripeExpandedObject(pi.latest_charge);
    if (charge) {
      if (charge.refunded) return true;
      if (Number(charge.amount_refunded || 0) > 0) return true;
      if (charge.disputed) return true;
      const chargeStatus = String(charge.status || "").toLowerCase();
      if (chargeStatus && chargeStatus !== "succeeded") return true;
    }
  }
  return false;
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
  if (ref === "manual_fix" || amountTotal === LEGACY_MANUAL_FIX_AMOUNT) return "manual_fix";
  if (ref === "wp_autofix") return "wp_autofix";
  if (amountTotal === LEGACY_AUTO_OR_AUDIT_AMOUNT || ref === "complete_audit") return "complete_audit";
  return null;
}

function isCompleteAuditCheckout(session) {
  return paidAuditProduct(session) != null;
}

function sessionCustomerEmail(session) {
  return String(
    session?.customer_email || session?.customer_details?.email || "",
  ).trim().toLowerCase();
}

function sessionDomain(session) {
  const meta = session?.metadata && typeof session.metadata === "object"
    ? session.metadata
    : {};
  const fromMeta = String(meta.domain || "").trim().toLowerCase().replace(/^www\./i, "");
  if (fromMeta) return fromMeta;
  const email = sessionCustomerEmail(session);
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).replace(/^www\./i, "") : "";
}

function sessionPaymentLinkId(session) {
  const raw = session?.payment_link;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return String(raw.id || "");
}

function classifyCheckoutProduct(session) {
  const currency = String(session?.currency || "").trim().toLowerCase();
  if (currency && currency !== COMPLETE_AUDIT_CURRENCY) return null;
  const paymentStatus = String(session?.payment_status || "").toLowerCase();
  if (paymentStatus && paymentStatus !== "paid") return null;
  const amountTotal = Number(session?.amount_total ?? NaN);
  const meta = session?.metadata && typeof session.metadata === "object"
    ? session.metadata
    : {};
  const ref = String(session?.client_reference_id || meta.product || "").trim();
  const paymentLink = sessionPaymentLinkId(session);

  if (ref === "manual_fix" || amountTotal === LEGACY_MANUAL_FIX_AMOUNT) {
    return { product: "manual_fix", ambiguous: false, amount: Number.isFinite(amountTotal) ? amountTotal : LEGACY_MANUAL_FIX_AMOUNT };
  }
  if (ref === "wp_autofix") {
    return { product: "wp_autofix", ambiguous: false, amount: Number.isFinite(amountTotal) ? amountTotal : ONE_TIME_FIX_AMOUNT };
  }
  if (ref === "complete_audit" || paymentLink === STRIPE_COMPLETE_AUDIT_PAYMENT_LINK) {
    return { product: "complete_audit", ambiguous: false, amount: Number.isFinite(amountTotal) ? amountTotal : LEGACY_AUTO_OR_AUDIT_AMOUNT };
  }
  if (amountTotal === LEGACY_AUTO_OR_AUDIT_AMOUNT) {
    return { product: "ambiguous_4990", ambiguous: true, amount: amountTotal };
  }
  return null;
}

function emptyStripeOrders() {
  return {
    count: 0,
    amount: 0,
    byProduct: {
      manual_fix: { count: 0, amount: 0 },
      wp_autofix: { count: 0, amount: 0 },
      complete_audit: { count: 0, amount: 0 },
      ambiguous_4990: { count: 0, amount: 0 },
    },
    bySeries: {},
    matched: 0,
    matchedEmail: 0,
    matchedDomain: 0,
    matchedClicked: 0,
    unmatched: 0,
    matchedNoSeries: 0,
    matches: [],
    liveMode: null,
    fetched: 0,
    qc: { count: 0, amount: 0 },
    excluded: 0,
  };
}

const GENERIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "seznam.cz",
  "email.cz",
  "post.cz",
  "outlook.com",
  "outlook.cz",
  "hotmail.com",
  "hotmail.cz",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.cz",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "centrum.cz",
  "atlas.cz",
  "volny.cz",
  "zoznam.sk",
  "azet.sk",
  "mail.com",
  "gmx.com",
  "gmx.de",
]);

function isGenericMailDomain(domain) {
  return GENERIC_MAIL_DOMAINS.has(String(domain || "").trim().toLowerCase());
}

function hasOrderTs(value) {
  return Boolean(value && String(value).trim());
}

function earlierOrderTs(left, right) {
  const a = hasOrderTs(left) ? String(left).trim() : "";
  const b = hasOrderTs(right) ? String(right).trim() : "";
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function contactRecord(raw) {
  const email = String(raw?.email || "").trim().toLowerCase();
  const domain = String(raw?.domain || "").trim().toLowerCase().replace(/^www\./i, "");
  return {
    email,
    domain,
    series_id: raw?.series_id || null,
    sent_at: raw?.sent_at || null,
    clicked_at: raw?.clicked_at || null,
  };
}

function mergeContactRecord(existing, incoming) {
  if (!existing) return incoming;
  return {
    email: existing.email || incoming.email,
    domain: existing.domain || incoming.domain,
    series_id: existing.series_id || incoming.series_id,
    sent_at: earlierOrderTs(existing.sent_at, incoming.sent_at) || null,
    clicked_at: earlierOrderTs(existing.clicked_at, incoming.clicked_at) || null,
  };
}

function betterDomainContact(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const existingClick = hasOrderTs(existing.clicked_at);
  const incomingClick = hasOrderTs(incoming.clicked_at);
  if (incomingClick !== existingClick) return incomingClick ? incoming : existing;
  const existingSent = String(existing.sent_at || "");
  const incomingSent = String(incoming.sent_at || "");
  if (incomingSent && (!existingSent || incomingSent < existingSent)) return incoming;
  if (incoming.series_id && !existing.series_id) return incoming;
  return existing;
}

function buildContactIndex(snapshot) {
  const byEmail = new Map();
  const byDomain = new Map();
  const add = (raw) => {
    const rec = contactRecord(raw);
    if (rec.email) {
      byEmail.set(rec.email, mergeContactRecord(byEmail.get(rec.email), rec));
    }
    if (rec.domain && !isGenericMailDomain(rec.domain)) {
      byDomain.set(rec.domain, betterDomainContact(byDomain.get(rec.domain), rec));
    }
  };
  for (const row of Array.isArray(snapshot?.contacts) ? snapshot.contacts : []) add(row);
  for (const row of Array.isArray(snapshot?.rows) ? snapshot.rows : []) add(row);
  return { byEmail, byDomain };
}

function matchOrderToCampaign(session, index) {
  const email = sessionCustomerEmail(session);
  const domain = sessionDomain(session);
  if (email && index.byEmail.has(email)) {
    const hit = index.byEmail.get(email);
    return {
      matched: true,
      how: "email",
      probable: false,
      series_id: hit.series_id || null,
      contact: hit,
    };
  }
  if (domain && !isGenericMailDomain(domain) && index.byDomain.has(domain)) {
    const hit = index.byDomain.get(domain);
    return {
      matched: true,
      how: "domain",
      probable: true,
      series_id: hit.series_id || null,
      contact: hit,
    };
  }
  return { matched: false, how: null, probable: false, series_id: null, contact: null };
}

function sessionPaidAtIso(session) {
  const created = Number(session?.created);
  if (Number.isFinite(created) && created > 0) {
    return new Date(created * 1000).toISOString();
  }
  return "";
}

function clickedBeforePayment(clickedAt, paidAtIso) {
  if (!hasOrderTs(clickedAt)) return false;
  if (!paidAtIso) return true;
  const clickMs = Date.parse(String(clickedAt));
  const paidMs = Date.parse(String(paidAtIso));
  if (Number.isNaN(clickMs) || Number.isNaN(paidMs)) return true;
  return clickMs <= paidMs;
}

function orderProductLabel(product) {
  if (product === "manual_fix") return "Manuál";
  if (product === "wp_autofix") return "Auto";
  if (product === "complete_audit") return "Kompletní audit";
  if (product === "ambiguous_4990") return "4 990 Kč (nerozlišené)";
  return product || "—";
}

function summarizeStripeOrders(sessions, snapshot) {
  const index = buildContactIndex(snapshot);
  const out = emptyStripeOrders();
  out.fetched = Array.isArray(sessions) ? sessions.length : 0;
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const classified = classifyCheckoutProduct(session);
    if (!classified) continue;
    if (out.liveMode === null && typeof session.livemode === "boolean") {
      out.liveMode = session.livemode;
    }
    if (isRefundedOrReversedSession(session)) {
      out.excluded += 1;
      continue;
    }
    const amount = Number(classified.amount) || 0;
    if (isQcOrderEmail(sessionCustomerEmail(session))) {
      out.qc.count += 1;
      out.qc.amount += amount;
      continue;
    }
    const bucket = out.byProduct[classified.product];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.amount += amount;
    out.count += 1;
    out.amount += amount;
    const match = matchOrderToCampaign(session, index);
    if (match.matched) {
      out.matched += 1;
      if (match.how === "email") out.matchedEmail += 1;
      if (match.how === "domain") out.matchedDomain += 1;
      const paidAt = sessionPaidAtIso(session);
      const clicked = clickedBeforePayment(match.contact?.clicked_at, paidAt);
      if (clicked) out.matchedClicked += 1;
      if (match.series_id) {
        if (!out.bySeries[match.series_id]) {
          out.bySeries[match.series_id] = { count: 0, amount: 0 };
        }
        out.bySeries[match.series_id].count += 1;
        out.bySeries[match.series_id].amount += amount;
      } else {
        out.matchedNoSeries += 1;
      }
      out.matches.push({
        domain: match.contact?.domain || sessionDomain(session) || "",
        contact_email: match.contact?.email || "",
        payer_email: sessionCustomerEmail(session),
        product: classified.product,
        amount,
        teaser_at: match.contact?.sent_at || "",
        paid_at: paidAt,
        how: match.how,
        probable: Boolean(match.probable),
        clicked,
        series_id: match.series_id || "",
      });
    } else {
      out.unmatched += 1;
    }
  }
  out.matches.sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")));
  return out;
}

function ordersFromSnapshot(snapshot) {
  const empty = emptyStripeOrders();
  const raw = snapshot && typeof snapshot.orders === "object" && snapshot.orders
    ? snapshot.orders
    : {};
  const byProduct = { ...empty.byProduct, ...(raw.byProduct || {}) };
  for (const key of Object.keys(empty.byProduct)) {
    byProduct[key] = {
      count: Number(byProduct[key]?.count || 0),
      amount: Number(byProduct[key]?.amount || 0),
    };
  }
  return {
    ...empty,
    ...raw,
    byProduct,
    bySeries: raw.bySeries && typeof raw.bySeries === "object" ? raw.bySeries : {},
    matches: Array.isArray(raw.matches) ? raw.matches : [],
    qc: {
      count: Number(raw.qc?.count || 0),
      amount: Number(raw.qc?.amount || 0),
    },
  };
}

const ADMIN_ORDERS_CACHE = "https://admin.gofixweb/orders-v1";
const ADMIN_ORDERS_TTL_SEC = 600;

async function putAdminOrdersCache(orders) {
  await caches.default.put(
    ADMIN_ORDERS_CACHE,
    new Response(JSON.stringify(orders), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `max-age=${ADMIN_ORDERS_TTL_SEC}`,
      },
    }),
    { expirationTtl: ADMIN_ORDERS_TTL_SEC },
  );
}

async function readAdminOrdersCache() {
  const hit = await caches.default.match(ADMIN_ORDERS_CACHE);
  if (!hit) return null;
  try {
    const raw = await hit.json();
    if (!raw || typeof raw !== "object") return null;
    return ordersFromSnapshot({ orders: raw });
  } catch {
    return null;
  }
}

async function refreshAdminOrdersCache(env) {
  const snapshot = await fetchCampaignSnapshot(env);
  const sessions = await fetchStripeCheckoutSessions(env);
  const orders = summarizeStripeOrders(sessions, snapshot);
  orders.source = "worker-cron";
  orders.computed_at = new Date().toISOString();
  await putAdminOrdersCache(orders);
  return orders;
}

async function resolveAdminOrders(snapshot) {
  const cached = await readAdminOrdersCache();
  if (cached && Number(cached.fetched || 0) > 0) return cached;
  return ordersFromSnapshot(snapshot);
}

async function fetchStripeCheckoutSessions(env) {
  /* Párování běží v GHA (refresh-admin-snapshot / persist), ne na /admin. */
  const secret = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("missing_stripe_secret");
  const sessions = [];
  let startingAfter = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("status", "complete");
    params.append("expand[]", "data.payment_intent");
    params.append("expand[]", "data.payment_intent.latest_charge");
    if (startingAfter) params.set("starting_after", startingAfter);
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`stripe_sessions_${res.status}:${text.slice(0, 300)}`);
    }
    const payload = await res.json();
    const batch = Array.isArray(payload.data) ? payload.data : [];
    sessions.push(...batch);
    if (!payload.has_more || batch.length === 0) break;
    startingAfter = String(batch[batch.length - 1].id || "");
    if (!startingAfter) break;
  }
  return sessions;
}

function formatCzkFromHalere(halere) {
  const czk = Math.round(Number(halere || 0) / 100);
  return `${czk.toLocaleString("cs-CZ")} Kč`;
}

function csvEscape(value) {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function matchedOrdersCsvHref(matches) {
  const header = [
    "shoda",
    "domena",
    "email_kontaktu",
    "email_platby",
    "produkt",
    "castka_kc",
    "teaser",
    "platba",
    "klik_pred_platbou",
  ];
  const lines = [header.join(",")];
  for (const row of matches) {
    lines.push([
      row.probable ? "pravdepodobna_domena" : "jista_email",
      csvEscape(row.domain),
      csvEscape(row.contact_email),
      csvEscape(row.payer_email),
      csvEscape(orderProductLabel(row.product)),
      csvEscape(Math.round(Number(row.amount || 0) / 100)),
      csvEscape(row.teaser_at),
      csvEscape(row.paid_at),
      row.clicked ? "ano" : "ne",
    ].join(","));
  }
  return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
}

function renderMatchedOrdersDetail(data) {
  const matches = Array.isArray(data.matches) ? data.matches : [];
  if (!matches.length) return "";
  const rows = matches.map((row) => {
    const trClass = row.clicked ? ' class="eng-clicked"' : "";
    const how = row.probable
      ? `<span class="probable-tag">pravděpodobná (doména)</span>`
      : `<span class="exact-tag">jistá (e-mail)</span>`;
    return `<tr${trClass}>
      <td>${escapeHtml(row.domain || "—")}</td>
      <td>${escapeHtml(row.contact_email || "—")}</td>
      <td>${escapeHtml(row.payer_email || "—")}</td>
      <td>${escapeHtml(orderProductLabel(row.product))}</td>
      <td>${escapeHtml(formatCzkFromHalere(row.amount))}</td>
      <td>${formatWhen(row.teaser_at)}</td>
      <td>${formatWhen(row.paid_at)}</td>
      <td>${how}</td>
    </tr>`;
  }).join("");
  return `<details class="orders-match-details">
    <summary>Spárované konverze — ${escapeHtml(matches.length)} k ruční kontrole</summary>
    <p class="hint">Zelený řádek = kontakt před platbou kliknul na CTA v teaseru.
    Pravděpodobná shoda = jiný e-mail na stejné doméně než v kampani (ne Gmail/Seznam a podobné schránky).</p>
    <p class="hint"><a href="${matchedOrdersCsvHref(matches)}" download="gofixweb-sparovane-konverze.csv">Stáhnout CSV</a></p>
    <div class="orders-match-table">
      <table>
        <thead>
          <tr>
            <th>Doména</th>
            <th>E-mail kontaktu</th>
            <th>E-mail platby</th>
            <th>Produkt</th>
            <th>Částka</th>
            <th>Teaser</th>
            <th>Platba</th>
            <th>Shoda</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </details>`;
}

function renderOrdersBox(orders, ordersError) {
  const data = orders || emptyStripeOrders();
  const qc = data.qc || { count: 0, amount: 0 };
  const excluded = Number(data.excluded || 0);
  const err = ordersError
    ? `<p class="banner-err">${escapeHtml(ordersError)}</p>`
    : "";
  const modeLabel = data.liveMode === false
    ? "Stripe test mode"
    : data.liveMode === true
      ? "Stripe live"
      : "Stripe";
  const seriesLines = OUTREACH_SERIES.map((def) => {
    const row = data.bySeries[def.id];
    if (!row) return "";
    return `<p class="hint">${escapeHtml(def.name)}: ${row.count} obj. · ${escapeHtml(formatCzkFromHalere(row.amount))}</p>`;
  }).join("");
  const ambiguous = data.byProduct.ambiguous_4990.count;
  const ambiguousNote = ambiguous
    ? `<p class="hint">Nerozlišené 4 990 Kč: ${ambiguous} — stejná cena Auto i Kompletní audit; bez metadata.product / client_reference_id je nejde spolehlivě oddělit.</p>`
    : "";
  const matchHint = data.matched
    ? `<p class="hint">Spárováno: ${escapeHtml(data.matchedEmail)} jistá shoda e-mailu · ${escapeHtml(data.matchedDomain)} pravděpodobná shoda domény · ${escapeHtml(data.matchedClicked)} s klikem na CTA před platbou.</p>`
    : "";
  return `<div class="orders-box">
    <h2>Objednávky</h2>
    <p class="hint">${escapeHtml(modeLabel)}. Ze snapshotu DB (GHA každých 5 min), ne živý Stripe při načtení stránky.
    Objednávky a tržby jsou jen succeeded platby bez refundu od zákazníků.
    Jistá shoda kampaně = stejný e-mail. Pravděpodobná = stejná e-shopová doména, jiný e-mail. Stripe vlnu/sérii neukládá.</p>
    ${err}
    <div class="cards">
      <div class="card"><div class="k">Objednávky</div><div class="v">${escapeHtml(data.count)}</div></div>
      <div class="card"><div class="k">Tržby</div><div class="v">${escapeHtml(formatCzkFromHalere(data.amount))}</div></div>
      <div class="card"><div class="k">Manuál</div><div class="v">${escapeHtml(data.byProduct.manual_fix.count)} · ${escapeHtml(formatCzkFromHalere(data.byProduct.manual_fix.amount))}</div></div>
      <div class="card"><div class="k">Auto</div><div class="v">${escapeHtml(data.byProduct.wp_autofix.count)} · ${escapeHtml(formatCzkFromHalere(data.byProduct.wp_autofix.amount))}</div></div>
      <div class="card"><div class="k">Kompletní audit</div><div class="v">${escapeHtml(data.byProduct.complete_audit.count)} · ${escapeHtml(formatCzkFromHalere(data.byProduct.complete_audit.amount))}</div></div>
      <div class="card"><div class="k">Spárováno s kampaní</div><div class="v ok">${escapeHtml(data.matched)}</div></div>
      <div class="card"><div class="k">Nespárované</div><div class="v warn">${escapeHtml(data.unmatched)}</div></div>
    </div>
    <p class="hint">QC transakce (mimo statistiku): ${escapeHtml(qc.count)} · ${escapeHtml(formatCzkFromHalere(qc.amount))} — interní testy (trueforexway@, trademaker@, gofixweb@, audit@).</p>
    ${excluded
      ? `<p class="hint">Vyřazeno (refund / reverse / storno): ${escapeHtml(excluded)}.</p>`
      : ""}
    ${matchHint}
    ${seriesLines}
    ${data.matchedNoSeries
      ? `<p class="hint">Spárováno s kontaktem, ale bez vlny: ${escapeHtml(data.matchedNoSeries)}.</p>`
      : ""}
    ${ambiguousNote}
    ${renderMatchedOrdersDetail(data)}
  </div>`;
}

function emptyWhyNotBuyStats() {
  return {
    price: 0,
    trust: 0,
    other: 0,
    dismiss: 0,
    pending: 0,
    answered: 0,
    sent_emails: 0,
    by_source: {
      exit_intent: { label: "Exit-intent popup", price: 0, trust: 0, other: 0, dismiss: 0, total: 0 },
      click_48h: { label: "48h e-mail po kliku", price: 0, trust: 0, other: 0, pending: 0, sent: 0 },
      open_2h: { label: "2h e-mail po otevření", price: 0, trust: 0, other: 0, pending: 0, sent: 0 },
    },
  };
}

function sourceLine(row, extras) {
  const data = row && typeof row === "object" ? row : {};
  const label = escapeHtml(data.label || "");
  const bits = extras
    .map(([key, name]) => `${name} ${escapeHtml(data[key] ?? 0)}`)
    .join(" · ");
  return `<p class="hint"><strong>${label}:</strong> ${bits}</p>`;
}

function renderWhyNotBuyBox(why) {
  const data = why && typeof why === "object" ? why : emptyWhyNotBuyStats();
  const src = data.by_source && typeof data.by_source === "object"
    ? data.by_source
    : emptyWhyNotBuyStats().by_source;
  return `<div class="orders-box">
    <h2>Proč nekoupili/neklikli</h2>
    <p class="hint">Sjednocené odpovědi z exit-intent popupu, 48h e-mailu po kliku bez platby a 2h e-mailu po otevření bez kliku. Max. jeden e-mail daného typu na kontakt, suppression list platí.</p>
    <div class="cards">
      <div class="card"><div class="k">Cena</div><div class="v">${escapeHtml(data.price ?? 0)}</div></div>
      <div class="card"><div class="k">Důvěra</div><div class="v">${escapeHtml(data.trust ?? 0)}</div></div>
      <div class="card"><div class="k">Jiné</div><div class="v">${escapeHtml(data.other ?? 0)}</div></div>
      <div class="card"><div class="k">Zavřeno bez odpovědi</div><div class="v warn">${escapeHtml(data.dismiss ?? 0)}</div></div>
      <div class="card"><div class="k">E-maily bez odpovědi</div><div class="v warn">${escapeHtml(data.pending ?? 0)}</div></div>
    </div>
    <p class="hint">Odpovědí celkem: ${escapeHtml(data.answered ?? 0)}. Odesláno e-mailů: ${escapeHtml(data.sent_emails ?? 0)}.</p>
    <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem;">Rozpad podle zdroje</h3>
    ${sourceLine(src.exit_intent, [["price", "Cena"], ["trust", "Důvěra"], ["dismiss", "Zavřeno"], ["total", "Celkem"]])}
    ${sourceLine(src.click_48h, [["price", "Cena"], ["trust", "Důvěra"], ["other", "Jiné"], ["pending", "Bez odpovědi"], ["sent", "Odesláno"]])}
    ${sourceLine(src.open_2h, [["price", "Cena"], ["trust", "Důvěra"], ["other", "Jiné"], ["pending", "Bez odpovědi"], ["sent", "Odesláno"]])}
  </div>`;
}

function renderSurveyBox(survey) {
  return renderWhyNotBuyBox(survey);
}

function renderExitIntentBox() {
  return "";
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

async function verifyStripeWebhook(rawBody, signatureHeader, env) {
  const live = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  const test = String(env.STRIPE_WEBHOOK_SECRET_TEST || "").trim();
  if (!live && !test) {
    return { ok: false, error: "stripe_not_configured" };
  }

  if (live) {
    const liveResult = await verifyStripeWebhookSignature(rawBody, signatureHeader, live);
    if (liveResult.ok) return { ok: true, mode: "live" };
    if (
      liveResult.error === "stripe_signature_missing" ||
      liveResult.error === "stripe_signature_expired"
    ) {
      return liveResult;
    }
  }

  if (test) {
    const testResult = await verifyStripeWebhookSignature(rawBody, signatureHeader, test);
    if (testResult.ok) return { ok: true, mode: "test" };
    return testResult;
  }

  return { ok: false, error: "stripe_signature_invalid" };
}

function stripeOkResponse(body = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function unixToIso(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString();
}

function stripeObjectId(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value.id || "").trim();
}

function invoiceSubscriptionId(invoice) {
  return (
    stripeObjectId(invoice?.subscription) ||
    stripeObjectId(invoice?.parent?.subscription_details?.subscription)
  );
}

function invoiceSubscriptionMetadata(invoice) {
  const fromDetails = invoice?.subscription_details?.metadata;
  if (fromDetails && typeof fromDetails === "object") return fromDetails;
  const fromParent = invoice?.parent?.subscription_details?.metadata;
  if (fromParent && typeof fromParent === "object") return fromParent;
  return {};
}

function invoicePriceId(invoice) {
  const lines = invoice?.lines?.data || [];
  const price = lines[0]?.price || {};
  const fromPrice = stripeObjectId(price.id || price);
  if (fromPrice) return fromPrice;
  return stripeObjectId(lines[0]?.pricing?.price_details?.price);
}

async function stripeGet(env, path, { testMode = false } = {}) {
  const secret = String(
    testMode
      ? env.STRIPE_SECRET_KEY_TEST || ""
      : env.STRIPE_SECRET_KEY || "",
  ).trim();
  if (!secret) return null;
  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function planFromPriceId(priceId, env) {
  const raw = String(priceId || "").trim();
  if (!raw) return "";
  for (const [plan, spec] of Object.entries(SUBSCRIPTION_PLANS)) {
    const envId = String(env?.[spec.priceEnv] || "").trim();
    if (envId && envId === raw) return plan;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("premium")) return "premium";
  if (lower.includes("pro")) return "pro";
  if (lower.includes("basic")) return "basic";
  return "";
}

function planFromAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const haleru = n < 1000 ? n * 100 : n;
  for (const [plan, spec] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (haleru === spec.amount) return plan;
  }
  return "";
}

function subscriptionLifecyclePayload({
  eventType,
  eventId,
  subscriptionId,
  email,
  domain,
  plan,
  billingReason,
  customerId,
  priceId,
  periodStart,
  periodEnd,
  amountHaleru,
  metadata,
  subscriptionMetadata,
  livemode,
}) {
  return {
    event_type: eventType,
    event_id: eventId,
    subscription_id: subscriptionId || "",
    email: email || "",
    domain: domain || "",
    plan: plan || "",
    billing_reason: billingReason || "",
    customer_id: customerId || "",
    price_id: priceId || "",
    amount_haleru: amountHaleru || 0,
  };
}

async function dispatchSubscriptionLifecycle(env, payload) {
  await dispatchGithubEvent(env, "subscription-lifecycle", payload);
}

async function handleStripeWebhook(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = request.headers.get("Stripe-Signature") || "";
  const rawBody = await request.text();
  const verify = await verifyStripeWebhook(rawBody, signature, env);
  if (!verify.ok) {
    return new Response(verify.error, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const type = String(event?.type || "");
  const eventId = String(event?.id || "").trim();
  console.log(
    "stripe_webhook_verified",
    JSON.stringify({
      mode: verify.mode || "",
      livemode: event?.livemode !== false,
      type,
      event_id: eventId,
    }),
  );

  if (type === "invoice.paid" || type === "invoice.payment_failed") {
    return handleSubscriptionInvoiceEvent(event, env, type);
  }
  if (type === "customer.subscription.deleted") {
    return handleSubscriptionDeletedEvent(event, env);
  }
  if (type !== "checkout.session.completed") {
    return stripeOkResponse({ ok: true, ignored: true });
  }

  const session = event?.data?.object || {};
  if (String(session.mode || "") === "subscription" || isSubscriptionPlan(session?.metadata?.plan || session?.metadata?.product)) {
    return handleSubscriptionCheckoutCompleted(event, env);
  }

  const product = paidAuditProduct(session);
  if (!product) {
    return stripeOkResponse({ ok: true, ignored: true, reason: "not_complete_audit" });
  }
  const email = String(
    session.customer_email || session.customer_details?.email || "",
  ).trim().toLowerCase();

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

async function resolveCustomerEmail(env, object, { testMode = false } = {}) {
  let email = String(
    object?.customer_email || object?.customer_details?.email || "",
  ).trim().toLowerCase();
  if (email && EMAIL_RE.test(email)) return email;
  const customerId = stripeObjectId(object?.customer);
  if (!customerId) return "";
  const customer = await stripeGet(env, `customers/${customerId}`, { testMode });
  email = String(customer?.email || "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

async function handleSubscriptionInvoiceEvent(event, env, type) {
  const invoice = event?.data?.object || {};
  const testMode = event?.livemode === false;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return stripeOkResponse({ ok: true, ignored: true, reason: "not_subscription_invoice" });
  }
  const eventId = String(event?.id || "").trim();
  const lines = invoice?.lines?.data || [];
  const priceId = invoicePriceId(invoice);
  const amount = Number(invoice.amount_paid ?? invoice.amount_due ?? lines[0]?.amount ?? 0);
  const subMeta = invoiceSubscriptionMetadata(invoice);
  const invMeta = invoice.metadata && typeof invoice.metadata === "object" ? invoice.metadata : {};
  let plan =
    String(subMeta.plan || invMeta.plan || invMeta.product || "").trim().toLowerCase();
  if (!isSubscriptionPlan(plan)) plan = planFromPriceId(priceId, env) || planFromAmount(amount);
  let domain = String(subMeta.domain || invMeta.domain || "").trim();
  let email = await resolveCustomerEmail(env, invoice, { testMode });
  if (!domain || !plan || !email) {
    const sub = await stripeGet(env, `subscriptions/${subscriptionId}`, { testMode });
    const sm = (sub && sub.metadata) || {};
    if (!domain) domain = String(sm.domain || "").trim();
    if (!isSubscriptionPlan(plan)) {
      plan = String(sm.plan || sm.product || "").trim().toLowerCase()
        || planFromPriceId(stripeObjectId(sub?.items?.data?.[0]?.price), env)
        || plan;
    }
    if (!email) email = String(sub?.customer_email || "").trim().toLowerCase();
    if (!email) email = await resolveCustomerEmail(env, sub || {}, { testMode });
  }
  const payload = subscriptionLifecyclePayload({
    eventType: type,
    eventId,
    subscriptionId,
    email,
    domain,
    plan,
    billingReason: String(invoice.billing_reason || ""),
    customerId: stripeObjectId(invoice.customer),
    priceId,
    periodStart: unixToIso(invoice.period_start),
    periodEnd: unixToIso(invoice.period_end),
    amountHaleru: amount,
    metadata: invMeta,
    subscriptionMetadata: subMeta,
    livemode: !testMode,
  });
  try {
    await dispatchSubscriptionLifecycle(env, payload);
  } catch (err) {
    console.error("subscription_dispatch_failed", err);
    return new Response("dispatch_failed", { status: 502 });
  }
  return stripeOkResponse({ ok: true, queued: true, type, plan });
}

async function handleSubscriptionDeletedEvent(event, env) {
  const sub = event?.data?.object || {};
  const testMode = event?.livemode === false;
  const subscriptionId = stripeObjectId(sub.id || sub);
  const meta = sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {};
  const email = await resolveCustomerEmail(env, sub, { testMode });
  const payload = subscriptionLifecyclePayload({
    eventType: "customer.subscription.deleted",
    eventId: String(event?.id || "").trim(),
    subscriptionId,
    email,
    domain: String(meta.domain || "").trim(),
    plan: String(meta.plan || meta.product || "").trim().toLowerCase(),
    customerId: stripeObjectId(sub.customer),
    metadata: meta,
    subscriptionMetadata: meta,
    livemode: !testMode,
  });
  try {
    await dispatchSubscriptionLifecycle(env, payload);
  } catch (err) {
    console.error("subscription_deleted_dispatch_failed", err);
    return new Response("dispatch_failed", { status: 502 });
  }
  return stripeOkResponse({ ok: true, queued: true, type: "customer.subscription.deleted" });
}

async function handleSubscriptionCheckoutCompleted(event, env) {
  const session = event?.data?.object || {};
  const testMode = event?.livemode === false;
  const meta = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const payload = subscriptionLifecyclePayload({
    eventType: "checkout.session.completed",
    eventId: String(event?.id || "").trim(),
    subscriptionId: stripeObjectId(session.subscription),
    email: await resolveCustomerEmail(env, session, { testMode }),
    domain: String(meta.domain || "").trim(),
    plan: String(meta.plan || meta.product || "").trim().toLowerCase(),
    billingReason: "checkout",
    customerId: stripeObjectId(session.customer),
    metadata: meta,
    subscriptionMetadata: meta,
    livemode: !testMode,
  });
  try {
    await dispatchSubscriptionLifecycle(env, payload);
  } catch (err) {
    console.error("subscription_checkout_dispatch_failed", err);
    return new Response("dispatch_failed", { status: 502 });
  }
  return stripeOkResponse({ ok: true, queued: true, type: "checkout.session.completed" });
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
  return String(value ?? "")
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

function exitIntentScript(trackingId, product) {
  const tidJson = JSON.stringify(String(trackingId || "").trim());
  const productJson = JSON.stringify(String(product || "manual_fix").trim() || "manual_fix");
  return `<script>
(function () {
  var tid = ${tidJson};
  var product = ${productJson};
  var KEY = "gfw-exit-intent:" + product;
  var PAY_KEY = "gfw-paying:" + product;
  var TIMER_MS = 35000;
  var ARM_MS = 1500;
  var LEAVE_MS = 400;
  var shown = false;
  var armed = false;
  var leaveTimer = 0;
  var modal = document.getElementById("gfw-exit-modal");
  if (!modal) return;
  function paying() {
    try { return sessionStorage.getItem(PAY_KEY) === "1"; } catch (e) { return false; }
  }
  function already() {
    try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  if (already() || paying()) return;
  function markShown() {
    shown = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
  }
  function hide() {
    modal.setAttribute("hidden", "");
    modal.setAttribute("aria-hidden", "true");
  }
  var sent = false;
  function send(reason) {
    if (sent) return;
    sent = true;
    try {
      fetch("/exit-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tid: tid, reason: reason }),
        keepalive: true
      });
    } catch (e) {}
  }
  function show() {
    if (shown || paying() || already()) return;
    markShown();
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
  function answer(reason) {
    send(reason);
    hide();
  }
  function dismissNow() {
    send("dismiss");
    hide();
  }
  function cancelLeave() {
    if (leaveTimer) {
      window.clearTimeout(leaveTimer);
      leaveTimer = 0;
    }
  }
  function isTopExit(e) {
    if (!e || e.relatedTarget) return false;
    return typeof e.clientY === "number" && e.clientY < 0;
  }
  function onViewportLeave(e) {
    if (!armed || shown) return;
    if (!isTopExit(e)) return;
    cancelLeave();
    leaveTimer = window.setTimeout(function () {
      leaveTimer = 0;
      show();
    }, LEAVE_MS);
  }
  window.setTimeout(function () { armed = true; }, ARM_MS);
  document.documentElement.addEventListener("mouseleave", onViewportLeave);
  document.documentElement.addEventListener("mouseenter", cancelLeave);
  var coarse = false;
  try {
    coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}
  if (coarse) {
    window.setTimeout(function () { show(); }, TIMER_MS);
    var lastY = window.scrollY || 0;
    var lastT = Date.now();
    window.addEventListener("scroll", function () {
      var y = window.scrollY || 0;
      var t = Date.now();
      var dt = t - lastT;
      var dy = lastY - y;
      if (lastY > 80 && y < 24 && dy > 60 && dt < 900) show();
      lastY = y;
      lastT = t;
    }, { passive: true });
  }
  var form = document.getElementById("gfw-pay-form") || document.getElementById("vop-consent-form");
  function markPaying() {
    try { sessionStorage.setItem(PAY_KEY, "1"); } catch (e) {}
    hide();
  }
  if (form) form.addEventListener("submit", markPaying);
  var payBtn = document.getElementById("pay-btn");
  if (payBtn) payBtn.addEventListener("click", markPaying);
  var price = document.getElementById("gfw-exit-price");
  var trust = document.getElementById("gfw-exit-trust");
  var dismiss = document.getElementById("gfw-exit-dismiss");
  var closeX = document.getElementById("gfw-exit-close");
  if (price) price.addEventListener("click", function () { answer("price"); });
  if (trust) trust.addEventListener("click", function () { answer("trust"); });
  if (dismiss) dismiss.addEventListener("click", dismissNow);
  if (closeX) closeX.addEventListener("click", dismissNow);
})();
</script>`;
}

/** Stejné pravidlo jako utils/translations.py get_locale: host .sk → sk, jinak cz. */
function localeFromDomain(raw) {
  let host = String(raw || "").trim().toLowerCase();
  if (!host) return "cz";
  try {
    if (host.includes("://")) host = new URL(host).hostname || host;
    else if (host.startsWith("//")) host = new URL(`https:${host}`).hostname || host;
  } catch {
    /* keep host */
  }
  host = host.split("@").pop().split("/")[0].split(":")[0];
  return host.endsWith(".sk") ? "sk" : "cz";
}

function checkoutLocale(domain, email) {
  const raw = String(domain || "").trim() || String(email || "").trim();
  return localeFromDomain(raw);
}

const CHECKOUT_COPY = {
  cz: {
    lang: "cs",
    stripeLocale: "cs",
    manualName: MANUAL_FIX_NAME,
    autoName: AUTO_FIX_NAME,
    manualBlurb: MANUAL_FIX_DESCRIPTION,
    autoBlurb: AUTO_FIX_DESCRIPTION,
    manualIntro: "Jednorázová platba. Po zaplacení dostanete přesný návod k opravě nálezů.",
    autoIntro: "Před platbou je potřeba souhlas s obchodními podmínkami a se zásahem do webu.",
    pay: "Pokračovat k platbě",
    vopBefore: "Souhlasím s",
    vopTerms: "obchodními podmínkami",
    vopMid: "a s tím, že GoFixWeb provede automatické úpravy mého webu popsané v",
    vopArticle: "čl. 8 VOP",
    exitTitle: "Než odejdete — můžete nám prosím říct proč?",
    exitPrice: "Cena mi nesedí",
    exitTrust: "Nevím, jestli vám můžu důvěřovat",
    exitDismiss: "Zavřít bez odpovědi",
    vopError: "Bez souhlasu s VOP nelze pokračovat k platbě.",
    unknownProduct: "Neznámý produkt.",
    stripeMissing: "Stripe Checkout není nakonfigurovaný (STRIPE_SECRET_KEY).",
    vopRecordFailed: "Souhlas se nepodařilo zaznamenat. Zkuste to znovu.",
    payFailed: "Nepodařilo se otevřít platbu. Zkuste to znovu.",
    stripeNoUrl: "Stripe Checkout nevrátil URL.",
    domainLabel: "URL e-shopu",
    domainPlaceholder: "example.cz",
    domainError: "Zadejte URL e-shopu — bez ní nelze spustit pravidelné scany.",
    emailLabel: "E-mail",
    subIntro: "Měsíční předplatné. Po zaplacení připojíte WordPress (Application Password) a spustíme pravidelné scany a opravy.",
    subBlurbBasic: "Měsíční sken, 1 oprava, 1 sloučený e-mail s nálezy i provedenými opravami.",
    subBlurbPro: "Týdenní sken, až 4 opravy měsíčně, 1 sloučený e-mail týdně.",
    subBlurbPremium: "Denní sken a optimalizace, 1 sloučený e-mail denně.",
  },
  sk: {
    lang: "sk",
    stripeLocale: "sk",
    manualName: "Manuálna oprava e-shopu",
    autoName: "Automatická oprava e-shopu",
    manualBlurb:
      "Presný návod na opravu zistení — zásahy vykonáte sami vo svojej administrácii (jednorazová platba).",
    autoBlurb:
      "Automatický zápis SEO a rýchlostných opráv priamo do vášho WordPress webu (jednorazový zásah)",
    manualIntro: "Jednorazová platba. Po zaplatení dostanete presný návod na opravu zistení.",
    autoIntro: "Pred platbou je potrebný súhlas s obchodnými podmienkami a so zásahom do webu.",
    pay: "Pokračovať k platbe",
    vopBefore: "Súhlasím s",
    vopTerms: "obchodnými podmienkami",
    vopMid: "a s tým, že GoFixWeb vykoná automatické úpravy môjho webu popísané v",
    vopArticle: "čl. 8 VOP",
    exitTitle: "Kým odídete — môžete nám prosím povedať prečo?",
    exitPrice: "Cena mi nesedí",
    exitTrust: "Neviem, či vám môžem dôverovať",
    exitDismiss: "Zavrieť bez odpovede",
    vopError: "Bez súhlasu s VOP nie je možné pokračovať k platbe.",
    unknownProduct: "Neznámy produkt.",
    stripeMissing: "Stripe Checkout nie je nakonfigurovaný (STRIPE_SECRET_KEY).",
    vopRecordFailed: "Súhlas sa nepodarilo zaznamenať. Skúste to znova.",
    payFailed: "Nepodarilo sa otvoriť platbu. Skúste to znova.",
    stripeNoUrl: "Stripe Checkout nevrátil URL.",
    domainLabel: "URL e-shopu",
    domainPlaceholder: "example.sk",
    domainError: "Zadajte URL e-shopu — bez nej nie je možné spustiť pravidelné skeny.",
    emailLabel: "E-mail",
    subIntro: "Mesačné predplatné. Po zaplatení pripojíte WordPress (Application Password) a spustíme pravidelné skeny a opravy.",
    subBlurbBasic: "Mesačný sken, 1 oprava, 1 zlúčený e-mail s nálezmi aj vykonanými opravami.",
    subBlurbPro: "Týždenný sken, až 4 opravy mesačne, 1 zlúčený e-mail týždenne.",
    subBlurbPremium: "Denný sken a optimalizácia, 1 zlúčený e-mail denne.",
  },
};

function checkoutCopy(domain, email) {
  return CHECKOUT_COPY[checkoutLocale(domain, email)] || CHECKOUT_COPY.cz;
}

function checkoutOfferPage({
  product = "manual_fix",
  domain = "",
  email = "",
  trackingId = "",
  errorMessage = "",
} = {}) {
  const isAuto = product === "wp_autofix";
  const copy = checkoutCopy(domain, email);
  const title = isAuto ? copy.autoName : copy.manualName;
  const priceLabel = "1 990 Kč";
  const blurb = isAuto ? copy.autoBlurb : copy.manualBlurb;
  const intro = isAuto ? copy.autoIntro : copy.manualIntro;
  const err = errorMessage
    ? `<p class="err" id="vop-error">${escapeHtml(errorMessage)}</p>`
    : "";
  const vopBlock = isAuto
    ? `<label for="vop-consent">
        <input type="checkbox" id="vop-consent" name="vop_consent" value="1" required>
        <span>
          ${escapeHtml(copy.vopBefore)}
          <a href="${VOP_TERMS_URL}" target="_blank" rel="noopener">${escapeHtml(copy.vopTerms)}</a>
          ${escapeHtml(copy.vopMid)}
          <a href="${VOP_AUTOFIX_SECTION_URL}" target="_blank" rel="noopener">${escapeHtml(copy.vopArticle)}</a>
        </span>
      </label>`
    : "";
  const payDisabled = isAuto ? " disabled" : "";
  const payScript = isAuto
    ? `<script>
    (function () {
      var cb = document.getElementById("vop-consent");
      var btn = document.getElementById("pay-btn");
      if (!cb || !btn) return;
      function sync() { btn.disabled = !cb.checked; }
      cb.addEventListener("change", sync);
      sync();
    })();
  </script>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(copy.lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — GoFixWeb</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; background: #1a2332; color: #fff; line-height: 1.6; min-height: calc(100vh + 140px); }
    .wrap { width: min(560px, 92vw); margin: 0 auto; padding: 3rem 0 4rem; }
    h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.75rem; }
    p { color: #cbd5e1; margin-bottom: 1rem; }
    a { color: #16a34a; }
    .price { font-size: 1.35rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; }
    .card { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; background: #243044; }
    label { display: flex; gap: 0.7rem; align-items: flex-start; color: #e2e8f0; font-size: 0.95rem; cursor: pointer; }
    input[type="checkbox"] { margin-top: 0.3rem; width: 1.1rem; height: 1.1rem; flex-shrink: 0; }
    button { margin-top: 1.25rem; width: 100%; border: 0; border-radius: 8px; padding: 0.85rem 1rem; font-weight: 700; font-size: 1rem; background: #16a34a; color: #fff; cursor: pointer; }
    button:disabled { background: #475569; color: #cbd5e1; cursor: not-allowed; }
    .err { color: #fca5a5; margin-bottom: 1rem; }
    .gfw-exit { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .gfw-exit[hidden] { display: none !important; }
    .gfw-exit-card { position: relative; width: min(420px, 100%); background: #243044; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 1.5rem 1.25rem 1.15rem; }
    .gfw-exit-card p { color: #fff; font-weight: 700; font-size: 1.05rem; margin-bottom: 1rem; }
    .gfw-exit-actions { display: flex; flex-direction: column; gap: 0.55rem; }
    .gfw-exit-actions button { margin-top: 0; }
    .gfw-exit-x { position: absolute; top: 0.45rem; right: 0.45rem; width: 2rem; height: 2rem; margin: 0; padding: 0; background: transparent; color: #cbd5e1; font-size: 1.4rem; line-height: 1; font-weight: 500; }
    .gfw-exit-skip { margin-top: 0.85rem; background: transparent; color: #94a3b8; font-weight: 600; font-size: 0.9rem; padding: 0.4rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p class="price">${priceLabel}</p>
    <p>${escapeHtml(blurb)}</p>
    <p>${escapeHtml(intro)}</p>
    ${err}
    <form id="gfw-pay-form" method="post" action="/checkout" class="card">
      <input type="hidden" name="product" value="${escapeHtml(product)}">
      <input type="hidden" name="domain" value="${escapeHtml(domain)}">
      <input type="hidden" name="email" value="${escapeHtml(email)}">
      <input type="hidden" name="tid" value="${escapeHtml(trackingId)}">
      ${vopBlock}
      <button type="submit" id="pay-btn"${payDisabled}>${escapeHtml(copy.pay)}</button>
    </form>
  </div>
  <div id="gfw-exit-modal" class="gfw-exit" hidden aria-hidden="true" role="dialog" aria-labelledby="gfw-exit-title" aria-modal="true">
    <div class="gfw-exit-card">
      <button type="button" id="gfw-exit-close" class="gfw-exit-x" aria-label="${escapeHtml(copy.exitDismiss)}">&times;</button>
      <p id="gfw-exit-title">${escapeHtml(copy.exitTitle)}</p>
      <div class="gfw-exit-actions">
        <button type="button" id="gfw-exit-price">${escapeHtml(copy.exitPrice)}</button>
        <button type="button" id="gfw-exit-trust">${escapeHtml(copy.exitTrust)}</button>
      </div>
      <button type="button" id="gfw-exit-dismiss" class="gfw-exit-skip">${escapeHtml(copy.exitDismiss)}</button>
    </div>
  </div>
  ${payScript}
  ${exitIntentScript(trackingId, product)}
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

function autofixConsentPage({ domain = "", email = "", trackingId = "", errorMessage = "" } = {}) {
  return checkoutOfferPage({
    product: "wp_autofix",
    domain,
    email,
    trackingId,
    errorMessage,
  });
}

function subscriptionOfferPage({
  product = "basic",
  domain = "",
  email = "",
  trackingId = "",
  errorMessage = "",
} = {}) {
  const plan = String(product || "").trim().toLowerCase();
  const spec = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.basic;
  const copy = checkoutCopy(domain, email);
  const blurbs = {
    basic: copy.subBlurbBasic,
    pro: copy.subBlurbPro,
    premium: copy.subBlurbPremium,
  };
  const title = `GoFixWeb ${spec.display}`;
  const err = errorMessage
    ? `<p class="err" id="vop-error">${escapeHtml(errorMessage)}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(copy.lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — GoFixWeb</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; background: #1a2332; color: #fff; line-height: 1.6; min-height: 100vh; }
    .wrap { width: min(560px, 92vw); margin: 0 auto; padding: 3rem 0 4rem; }
    h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.75rem; }
    p { color: #cbd5e1; margin-bottom: 1rem; }
    a { color: #16a34a; }
    .price { font-size: 1.35rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; }
    .card { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; background: #243044; }
    label { display: flex; gap: 0.7rem; align-items: flex-start; color: #e2e8f0; font-size: 0.95rem; cursor: pointer; }
    label.field { flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem; cursor: default; }
    input[type="checkbox"] { margin-top: 0.3rem; width: 1.1rem; height: 1.1rem; flex-shrink: 0; }
    input[type="text"], input[type="email"] { width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 0.65rem 0.75rem; background: #1a2332; color: #fff; font-size: 1rem; }
    button { margin-top: 1.25rem; width: 100%; border: 0; border-radius: 8px; padding: 0.85rem 1rem; font-weight: 700; font-size: 1rem; background: #16a34a; color: #fff; cursor: pointer; }
    button:disabled { background: #475569; color: #cbd5e1; cursor: not-allowed; }
    .err { color: #fca5a5; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p class="price">${escapeHtml(spec.priceLabel)}</p>
    <p>${escapeHtml(blurbs[plan] || copy.subBlurbBasic)}</p>
    <p>${escapeHtml(copy.subIntro)}</p>
    ${err}
    <form id="gfw-pay-form" method="post" action="/checkout" class="card">
      <input type="hidden" name="product" value="${escapeHtml(plan)}">
      <input type="hidden" name="tid" value="${escapeHtml(trackingId)}">
      <label class="field" for="sub-domain">${escapeHtml(copy.domainLabel)}
        <input type="text" id="sub-domain" name="domain" value="${escapeHtml(domain)}" required placeholder="${escapeHtml(copy.domainPlaceholder)}">
      </label>
      <label class="field" for="sub-email">${escapeHtml(copy.emailLabel)}
        <input type="email" id="sub-email" name="email" value="${escapeHtml(email)}" required placeholder="jan@eshop.cz">
      </label>
      <label for="vop-consent">
        <input type="checkbox" id="vop-consent" name="vop_consent" value="1" required>
        <span>
          ${escapeHtml(copy.vopBefore)}
          <a href="${VOP_TERMS_URL}" target="_blank" rel="noopener">${escapeHtml(copy.vopTerms)}</a>
          ${escapeHtml(copy.vopMid)}
          <a href="${VOP_AUTOFIX_SECTION_URL}" target="_blank" rel="noopener">${escapeHtml(copy.vopArticle)}</a>
        </span>
      </label>
      <button type="submit" id="pay-btn" disabled>${escapeHtml(copy.pay)}</button>
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

async function handleSubscriptionCheckout(request, env, { plan, domain, email, consent, tid }) {
  const copy = checkoutCopy(domain, email);
  const spec = SUBSCRIPTION_PLANS[plan];
  const consented = isVopConsented(consent);
  const domainOk = Boolean(String(domain || "").trim());
  const emailOk = Boolean(email && EMAIL_RE.test(email));
  if (request.method !== "POST" || !consented || !domainOk || !emailOk) {
    let errorMessage = "";
    if (request.method === "POST" && !consented) errorMessage = copy.vopError;
    else if (request.method === "POST" && !domainOk) errorMessage = copy.domainError;
    return subscriptionOfferPage({
      product: plan,
      domain,
      email,
      trackingId: tid,
      errorMessage,
    });
  }

  const secret = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) {
    return new Response(copy.stripeMissing, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    await dispatchGithubEvent(env, "wp-vop-consent", {
      email,
      domain,
      ip: clientIp(request),
      vop_version: VOP_VERSION,
      consent_at: new Date().toISOString(),
      product: plan,
    });
  } catch (err) {
    console.error("vop_consent_dispatch_failed", err);
    return new Response(copy.vopRecordFailed, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const next = new URL(ONBOARDING_URL);
  next.searchParams.set("email", email);
  const shop = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  next.searchParams.set("shop", shop);

  const priceId = String(env[spec.priceEnv] || "").trim();
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", next.toString());
  body.set("cancel_url", "https://gofixweb.com/#tarify");
  body.set("client_reference_id", plan);
  body.set("metadata[product]", plan);
  body.set("metadata[plan]", plan);
  body.set("metadata[domain]", domain);
  body.set("metadata[vop_consent]", "1");
  body.set("metadata[vop_version]", VOP_VERSION);
  body.set("subscription_data[metadata][product]", plan);
  body.set("subscription_data[metadata][plan]", plan);
  body.set("subscription_data[metadata][domain]", domain);
  body.set("customer_email", email);
  body.set("line_items[0][quantity]", "1");
  if (priceId) {
    body.set("line_items[0][price]", priceId);
  } else {
    body.set("line_items[0][price_data][currency]", COMPLETE_AUDIT_CURRENCY);
    body.set("line_items[0][price_data][unit_amount]", String(spec.amount));
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", `GoFixWeb ${spec.display}`);
    body.set("line_items[0][price_data][product_data][description]", copy[`subBlurb${spec.display}`] || "");
    body.set("line_items[0][price_data][product_data][tax_code]", "txcd_10000000");
  }
  body.set("managed_payments[enabled]", "false");
  body.set("locale", copy.stripeLocale);

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
    console.error("stripe_subscription_checkout_failed", response.status, text);
    return new Response(copy.payFailed, { status: 502 });
  }
  const session = await response.json();
  if (!session.url) {
    return new Response(copy.stripeNoUrl, { status: 502 });
  }
  return Response.redirect(session.url, 303);
}

async function handleCheckout(request, env) {
  const url = new URL(request.url);
  let product = String(url.searchParams.get("product") || "").trim();
  let domain = String(url.searchParams.get("domain") || "").trim();
  let email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  let consent = "";
  let tid = String(url.searchParams.get("tid") || "").trim();

  if (request.method === "POST") {
    const form = await request.formData();
    product = String(form.get("product") || product).trim();
    domain = String(form.get("domain") || domain).trim();
    email = String(form.get("email") || email).trim().toLowerCase();
    consent = String(form.get("vop_consent") || "").trim();
    tid = String(form.get("tid") || tid).trim();
  }
  if (tid && !TRACKING_ID_RE.test(tid)) tid = "";
  product = String(product || "").trim();
  const planKey = product.toLowerCase();
  const copy = checkoutCopy(domain, email);

  if (isSubscriptionPlan(planKey)) {
    return handleSubscriptionCheckout(request, env, {
      plan: planKey,
      domain,
      email,
      consent,
      tid,
    });
  }

  if (product !== "manual_fix" && product !== "wp_autofix") {
    return new Response(copy.unknownProduct, { status: 400 });
  }

  if (product === "wp_autofix") {
    const consented = isVopConsented(consent);
    if (request.method !== "POST" || !consented) {
      return checkoutOfferPage({
        product,
        domain,
        email,
        trackingId: tid,
        errorMessage:
          request.method === "POST" && !consented
            ? copy.vopError
            : "",
      });
    }
  } else if (request.method !== "POST") {
    return checkoutOfferPage({
      product,
      domain,
      email,
      trackingId: tid,
    });
  }

  const secret = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) {
    return new Response(copy.stripeMissing, {
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
      return new Response(copy.vopRecordFailed, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const amount = ONE_TIME_FIX_AMOUNT;
  const name = product === "manual_fix" ? copy.manualName : copy.autoName;
  const description = product === "manual_fix" ? copy.manualBlurb : copy.autoBlurb;
  const priceId = String(
    product === "manual_fix"
      ? env.STRIPE_MANUAL_FIX_PRICE_ID || STRIPE_MANUAL_FIX_PRICE_ID
      : env.STRIPE_AUTO_FIX_PRICE_ID || STRIPE_AUTO_FIX_PRICE_ID,
  ).trim();
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
  if (priceId) {
    body.set("line_items[0][price]", priceId);
  } else {
    body.set("line_items[0][price_data][currency]", COMPLETE_AUDIT_CURRENCY);
    body.set("line_items[0][price_data][unit_amount]", String(amount));
    body.set("line_items[0][price_data][product_data][name]", name);
    body.set("line_items[0][price_data][product_data][description]", description);
    body.set("line_items[0][price_data][product_data][tax_code]", "txcd_10000000");
  }
  body.set("managed_payments[enabled]", "false");
  body.set("locale", copy.stripeLocale);

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
    return new Response(copy.payFailed, { status: 502 });
  }
  const session = await response.json();
  if (!session.url) {
    return new Response(copy.stripeNoUrl, { status: 502 });
  }
  return Response.redirect(session.url, 303);
}

const GMAIL_BOUNCE_SEARCH_URL =
  "https://mail.google.com/mail/u/0/#search/" +
  "from%3A(mailer-daemon%20OR%20mail-delivery-subsystem)%20" +
  "OR%20subject%3A(undeliverable%20OR%20%22delivery%20status%22%20OR%20failure)";

const ADMIN_LINKS = {
  scans: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/free-report.yml",
  bounce: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-bounce-monitor.yml",
  resume: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-campaign-resume.yml",
  outreach: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/outreach-batch.yml",
  auto: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/outreach-auto.yml",
  unsub: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-unsubscribe.yml",
  engagement: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-engagement.yml",
  survey: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-click-survey.yml",
  openSurvey: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-open-survey.yml",
  exitIntent: "https://github.com/gypa70/gofixweb-scanner/actions/workflows/email-exit-intent.yml",
  actions: "https://github.com/gypa70/gofixweb-scanner/actions",
};

const OUTREACH_SERIES = [
  { id: "nulte-kolo", name: "Nulté kolo" },
  { id: "vlna-1", name: "Vlna 1" },
  { id: "vlna-2", name: "Vlna 2" },
];
const MAX_BATCH = 20;
const DEFAULT_BATCH = 5;
const AUTO_INTERVAL_MIN = 30;
const COOLDOWN_MS = 5 * 60 * 1000;
const HALT_BLOCK_TEXT = "Kampaň je zastavená (bounce rate). Nejdřív odemkni halt výše.";
const RUNNING_BLOCK_TEXT = "Právě běží jiná dávka, počkej na dokončení.";
const WAVE_LOCK_TEXT = "Odemkne se po úspěšném dokončení nultého kola.";
const ADMIN_TZ = "Europe/Prague";

async function sha256Hex(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unauthorizedAdmin() {
  return new Response("Vyžadováno přihlášení.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GoFixWeb kampan", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

async function requireAdminAuth(request, env) {
  const expectedPass = String(env.ADMIN_BASIC_PASSWORD || "").trim();
  if (!expectedPass) {
    return new Response("Admin není nakonfigurovaný (ADMIN_BASIC_PASSWORD).", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const expectedUser = String(env.ADMIN_BASIC_USER || "gofixweb").trim() || "gofixweb";
  const header = request.headers.get("Authorization") || "";
  const match = /^Basic\s+(\S+)/i.exec(header);
  if (!match) return unauthorizedAdmin();
  let decoded = "";
  try {
    decoded = atob(match[1]);
  } catch {
    return unauthorizedAdmin();
  }
  const idx = decoded.indexOf(":");
  const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
  const pass = idx >= 0 ? decoded.slice(idx + 1) : "";
  const left = await sha256Hex(`${user}\0${pass}`);
  const right = await sha256Hex(`${expectedUser}\0${expectedPass}`);
  if (!timingSafeEqualHex(left, right)) return unauthorizedAdmin();
  return null;
}

async function fetchCampaignSnapshot(env) {
  const repo = env.GITHUB_REPO || "gypa70/gofixweb-scanner";
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("missing_github_token");
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/data/email_campaign_admin.json?ref=main`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw",
        "User-Agent": "gofixweb-report-worker",
        "Cache-Control": "no-cache",
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_snapshot_${res.status}:${text.slice(0, 300)}`);
  }
  return res.json();
}

async function githubApi(env, path) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("missing_github_token");
  const res = await fetch(`https://api.github.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "gofixweb-report-worker",
      "X-GitHub-Api-Version": "2022-11-28",
      "Cache-Control": "no-cache",
    },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_api_${res.status}:${text.slice(0, 300)}`);
  }
  return res.json();
}

function parseSeriesFromRunName(name) {
  const raw = String(name || "");
  const match = raw.match(/\b(nulte-kolo|vlna-1|vlna-2)\b/i);
  return match ? match[1].toLowerCase() : "";
}

function isDryRunRun(run) {
  return /\bdry-run\b/i.test(String(run?.name || run?.display_title || ""));
}

function isActiveRun(run) {
  const status = String(run?.status || "").toLowerCase();
  return status === "in_progress" || status === "queued" || status === "waiting" || status === "pending" || status === "requested";
}

function isFailedConclusion(value) {
  const conclusion = String(value || "").toLowerCase();
  return (
    conclusion === "failure"
    || conclusion === "timed_out"
    || conclusion === "cancelled"
    || conclusion === "startup_failure"
  );
}

function emptyOutreachRunState() {
  return {
    running: false,
    runningCount: 0,
    lastBySeries: {},
    active: [],
    recent: [],
    lastSuccessBySeries: {},
    lastFailedBySeries: {},
    lastSuccess: null,
    lastFailed: null,
  };
}

function newerStamp(left, right) {
  return String(left || "") > String(right || "");
}

function seriesDisplayName(id) {
  const found = OUTREACH_SERIES.find((item) => item.id === id);
  return found ? found.name : (id || "");
}

function normalizeOutreachRun(run, repo) {
  const name = run?.name || run?.display_title || "";
  const id = run?.id;
  return {
    id,
    series: parseSeriesFromRunName(name),
    dry_run: isDryRunRun(run),
    name,
    status: String(run?.status || "").toLowerCase(),
    conclusion: String(run?.conclusion || "").toLowerCase(),
    html_url: run?.html_url || (id ? `https://github.com/${repo}/actions/runs/${id}` : ADMIN_LINKS.outreach),
    created_at: run?.created_at || "",
    completed_at: run?.updated_at || run?.created_at || "",
  };
}

function summarizeOutreachRuns(runs, repo) {
  const list = Array.isArray(runs) ? runs : [];
  const normalized = list.map((run) => normalizeOutreachRun(run, repo));
  const active = normalized.filter((run) => isActiveRun(run));
  const lastBySeries = {};
  const lastSuccessBySeries = {};
  const lastFailedBySeries = {};
  for (const run of normalized) {
    if (run.dry_run || !run.series) continue;
    if (run.created_at && (!lastBySeries[run.series] || newerStamp(run.created_at, lastBySeries[run.series]))) {
      lastBySeries[run.series] = run.created_at;
    }
    if (isActiveRun(run)) continue;
    if (run.conclusion === "success") {
      const prev = lastSuccessBySeries[run.series];
      if (!prev || newerStamp(run.completed_at, prev.completed_at)) {
        lastSuccessBySeries[run.series] = run;
      }
    } else if (isFailedConclusion(run.conclusion)) {
      const prev = lastFailedBySeries[run.series];
      if (!prev || newerStamp(run.completed_at, prev.completed_at)) {
        lastFailedBySeries[run.series] = run;
      }
    }
  }
  const byCompleted = (left, right) => String(right.completed_at || "").localeCompare(String(left.completed_at || ""));
  return {
    running: active.length > 0,
    runningCount: active.length,
    active,
    recent: normalized,
    lastBySeries,
    lastSuccessBySeries,
    lastFailedBySeries,
    lastSuccess: Object.values(lastSuccessBySeries).sort(byCompleted)[0] || null,
    lastFailed: Object.values(lastFailedBySeries).sort(byCompleted)[0] || null,
  };
}

function findRunById(runState, runId) {
  const id = String(runId || "");
  if (!id) return null;
  return (runState?.recent || []).find((run) => String(run.id) === id) || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOutreachRunState(env, extraRunId = "") {
  const repo = env.GITHUB_REPO || "gypa70/gofixweb-scanner";
  const data = await githubApi(
    env,
    `/repos/${repo}/actions/workflows/outreach-batch.yml/runs?per_page=20`,
  );
  let runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
  const wanted = String(extraRunId || "");
  if (wanted && !runs.some((run) => String(run.id) === wanted)) {
    try {
      const one = await githubApi(env, `/repos/${repo}/actions/runs/${wanted}`);
      if (one && one.id) runs = [one, ...runs];
    } catch (err) {
      console.error("admin_extra_run_failed", err);
    }
  }
  return summarizeOutreachRuns(runs, repo);
}

async function findRecentOutreachRun(env, { series, sinceIso, timeoutMs = 8000 } = {}) {
  const repo = env.GITHUB_REPO || "gypa70/gofixweb-scanner";
  const sinceMs = Date.parse(sinceIso || "") - 15000;
  const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 8000);
  while (Date.now() < deadline) {
    try {
      const data = await githubApi(
        env,
        `/repos/${repo}/actions/workflows/outreach-batch.yml/runs?per_page=15`,
      );
      const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
      const match = runs.find((run) => {
        if (isDryRunRun(run)) return false;
        const runSeries = parseSeriesFromRunName(run.name || run.display_title || "");
        if (series && runSeries !== series) return false;
        const created = Date.parse(run.created_at || 0);
        return Number.isFinite(created) && Number.isFinite(sinceMs) && created >= sinceMs;
      });
      if (match) return match;
    } catch (err) {
      console.error("find_outreach_run_failed", err);
    }
    await sleep(1000);
  }
  return null;
}

function clampBatchSize(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_BATCH;
  return Math.min(MAX_BATCH, Math.max(1, n));
}

function cooldownUntilIso(lastLaunchedAt) {
  if (!lastLaunchedAt) return "";
  const started = new Date(lastLaunchedAt);
  if (Number.isNaN(started.getTime())) return "";
  return new Date(started.getTime() + COOLDOWN_MS).toISOString();
}

function seriesView(snapshot, runState, seriesDef) {
  const fromSnap = snapshot?.series?.[seriesDef.id] || {};
  const lastGithub = runState?.lastBySeries?.[seriesDef.id] || "";
  const lastSnap = fromSnap.last_launched_at || "";
  const last = !lastGithub ? lastSnap : !lastSnap ? lastGithub : lastGithub > lastSnap ? lastGithub : lastSnap;
  const until = fromSnap.cooldown_until || cooldownUntilIso(last);
  const untilMs = until ? new Date(until).getTime() : 0;
  const cooldownActive = Boolean(untilMs && untilMs > Date.now());
  const halted = Boolean(snapshot?.halt?.halted || snapshot?.stats?.halted || fromSnap.halted);
  const nulte = snapshot?.series?.["nulte-kolo"] || {};
  const nulteDone =
    Number(nulte.contacted || 0) >= Number(nulte.total || 20) &&
    Number(nulte.total || 0) > 0 &&
    !nulte.halt_during &&
    !halted;
  const waveLocked = seriesDef.id !== "nulte-kolo" && !nulteDone;
  const lastSuccess = runState?.lastSuccessBySeries?.[seriesDef.id] || null;
  const lastFailed = runState?.lastFailedBySeries?.[seriesDef.id] || null;
  return {
    id: seriesDef.id,
    name: fromSnap.name || seriesDef.name,
    total: Number(fromSnap.total ?? 0),
    expected: Number(fromSnap.expected ?? 0),
    contacted: Number(fromSnap.contacted ?? 0),
    remaining: Number(fromSnap.remaining ?? 0),
    last_launched_at: last || "",
    last_success_at: lastSuccess?.completed_at || "",
    last_success_url: lastSuccess?.html_url || "",
    last_failed_at: lastFailed?.completed_at || "",
    last_failed_url: lastFailed?.html_url || "",
    last_failed_conclusion: lastFailed?.conclusion || "",
    cooldown_until: until,
    cooldown_active: cooldownActive,
    locked: waveLocked || Boolean(fromSnap.locked),
    halt_during: Boolean(fromSnap.halt_during),
    auto_enabled: Boolean(fromSnap.auto_enabled),
    auto_batch_size: clampAutoBatch(fromSnap.auto_batch_size),
    auto_available: !waveLocked && !Boolean(fromSnap.locked),
    halted,
  };
}

function clampAutoBatch(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_BATCH;
  return Math.max(1, Math.min(MAX_BATCH, Math.round(n)));
}

function launchBlockReason(view, runState) {
  if (view.halted) return HALT_BLOCK_TEXT;
  if (runState?.running) return RUNNING_BLOCK_TEXT;
  if (view.locked) return WAVE_LOCK_TEXT;
  if (view.cooldown_active && view.cooldown_until) {
    return `Další dávka této série až po ${formatWhenPlain(view.cooldown_until)}.`;
  }
  if (view.remaining <= 0 && view.total > 0) {
    return "V této sérii už není koho kontaktovat.";
  }
  return "";
}

function validateLaunchServer(snapshot, runState, seriesId, limit) {
  if (!OUTREACH_SERIES.some((item) => item.id === seriesId)) {
    return { ok: false, error: "Neznámá série." };
  }
  if (limit < 1 || limit > MAX_BATCH) {
    return { ok: false, error: `Velikost dávky musí být 1–${MAX_BATCH}.` };
  }
  const def = OUTREACH_SERIES.find((item) => item.id === seriesId);
  const view = seriesView(snapshot, runState, def);
  if (view.halted) return { ok: false, error: HALT_BLOCK_TEXT };
  if (runState?.running) return { ok: false, error: RUNNING_BLOCK_TEXT };
  if (view.locked) return { ok: false, error: WAVE_LOCK_TEXT };
  if (view.cooldown_active) {
    return { ok: false, error: `Další dávka této série až po ${formatWhenPlain(view.cooldown_until)}.` };
  }
  if (view.remaining <= 0 && view.total > 0) {
    return { ok: false, error: "V této sérii už není koho kontaktovat." };
  }
  if (runState?.runningCount && runState.runningCount + limit > MAX_BATCH) {
    return { ok: false, error: "Dávka by překročila strop 20 souběžných GHA jobů." };
  }
  return { ok: true, view };
}

function parseAdminDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let iso = raw;
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw)
    && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
  ) {
    iso = `${raw.replace(" ", "T")}Z`;
  }
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function pragueZoneAbbr(date) {
  try {
    const longName = new Intl.DateTimeFormat("en-US", {
      timeZone: ADMIN_TZ,
      timeZoneName: "long",
    }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "";
    if (/summer/i.test(longName) || /CEST/i.test(longName)) return "CEST";
    if (/standard/i.test(longName) || /\bCET\b/.test(longName)) return "CET";
    if (/Central European/i.test(longName)) {
      return /summer/i.test(longName) ? "CEST" : "CET";
    }
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: ADMIN_TZ,
      timeZoneName: "shortOffset",
    }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "";
    if (/\+0?2/.test(offset)) return "CEST";
    if (/\+0?1/.test(offset)) return "CET";
  } catch {
    /* Intl offset labels se liší podle runtime — CET je zimní fallback. */
  }
  return "CET";
}

function formatWhenPlain(value) {
  if (!value) return "—";
  const date = parseAdminDate(value);
  if (!date) return String(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ADMIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${pragueZoneAbbr(date)}`;
}

function formatWhen(value) {
  return escapeHtml(formatWhenPlain(value));
}

function statusClass(kind, value) {
  const v = String(value || "").toLowerCase();
  if (kind === "smtp") {
    if (v === "accepted") return "ok";
    if (v === "scan_failed" || v === "already_customer") return "warn";
    return "bad";
  }
  if (v === "bounced" || v === "rejected") return "bad";
  if (v === "uncertain") return "warn";
  if (v === "pending" || v === "skipped") return "muted";
  return "";
}

function hasEngagementTs(value) {
  return Boolean(value && String(value).trim());
}

function engagementRank(row) {
  if (hasEngagementTs(row?.replied_at)) return 3;
  if (hasEngagementTs(row?.clicked_at)) return 2;
  if (hasEngagementTs(row?.opened_at)) return 1;
  return 0;
}

function sortAdminDeliveryRows(rows) {
  return [...rows].sort((a, b) => {
    const rankDiff = engagementRank(b) - engagementRank(a);
    if (rankDiff) return rankDiff;
    return String(b?.sent_at || "").localeCompare(String(a?.sent_at || ""));
  });
}

function engagementRowClass(row) {
  if (hasEngagementTs(row?.replied_at)) return "eng-replied";
  if (hasEngagementTs(row?.clicked_at)) return "eng-clicked";
  if (hasEngagementTs(row?.opened_at)) return "eng-opened";
  return "";
}

function renderBatchFailedBanner(run) {
  const series = seriesDisplayName(run?.series);
  const conclusion = run?.conclusion || "failure";
  const url = run?.html_url || ADMIN_LINKS.outreach;
  return `<div class="banner-err" role="alert">
    <strong>Poslední dávka selhala, zkontroluj GitHub Actions.</strong>
    ${series ? ` Série: ${escapeHtml(series)}.` : ""}
    Stav: ${escapeHtml(conclusion)}.
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Otevřít běh</a>
  </div>`;
}

function renderBatchStatusBanner({ runState, launched, launchedSeries, launchedRunId }) {
  const selected = findRunById(runState, launchedRunId);
  const live = (runState?.active || []).filter((run) => !run.dry_run);
  const liveDry = (runState?.active || []).filter((run) => run.dry_run);
  const sending = selected && isActiveRun(selected)
    ? selected
    : (live[0] || liveDry[0] || null);

  if (sending) {
    const title = sending.dry_run ? "Testovací dávka (dry-run) běží…" : "Dávka odesílána…";
    const series = seriesDisplayName(sending.series || launchedSeries);
    return `<div class="banner-wait" role="status">
      <span class="pulse-dot" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        ${series ? ` Série: ${escapeHtml(series)}.` : ""}
        Stav se v DB projeví po persistu.
        <a href="${escapeHtml(sending.html_url)}" target="_blank" rel="noopener">Otevřít běh v GitHub Actions</a>
      </div>
    </div>`;
  }

  if (selected && selected.status === "completed" && isFailedConclusion(selected.conclusion)) {
    return renderBatchFailedBanner(selected);
  }
  if (selected && selected.status === "completed" && selected.conclusion === "success" && !selected.dry_run) {
    return `<div class="banner-ok" role="status">
      Dávka doběhla úspěšně (${formatWhen(selected.completed_at)}).
      <a href="${escapeHtml(selected.html_url)}" target="_blank" rel="noopener">GitHub Actions</a>
    </div>`;
  }

  if (launched && !selected) {
    const series = seriesDisplayName(launchedSeries);
    return `<div class="banner-wait" role="status">
      <span class="pulse-dot" aria-hidden="true"></span>
      <div>
        <strong>Dávka se spouští…</strong>
        ${series ? ` Série: ${escapeHtml(series)}.` : ""}
        Čekám, až GitHub Actions založí běh.
        <a href="${ADMIN_LINKS.outreach}" target="_blank" rel="noopener">Otevřít workflow outreach-batch</a>
      </div>
    </div>`;
  }

  const failed = runState?.lastFailed;
  const success = runState?.lastSuccess;
  if (failed && (!success || newerStamp(failed.completed_at, success.completed_at))) {
    return renderBatchFailedBanner(failed);
  }
  return "";
}

function renderAdminHtml(snapshot, {
  error = "",
  queued = false,
  launched = false,
  launchedSeries = "",
  launchedRunId = "",
  autoQueued = false,
  autoSizeQueued = false,
  suppressed = false,
  suppressedAlready = false,
  suppressedEmail = "",
  launchError = "",
  runState = {},
  orders = null,
  ordersError = "",
} = {}) {
  const stats = snapshot?.stats || {};
  const halt = snapshot?.halt || {};
  const rows = sortAdminDeliveryRows(Array.isArray(snapshot?.rows) ? snapshot.rows : []);
  const halted = Boolean(halt.halted || stats.halted);
  const haltClass = halted ? "halt-on" : "halt-off";
  const haltLabel = halted ? "ZAPNUTO" : "VYPNUTO";
  const lastSuccess = runState?.lastSuccess;
  const launchedRun = findRunById(runState, launchedRunId);
  const batchBusy = Boolean((runState?.active || []).length)
    || (launched && (!launchedRun || isActiveRun(launchedRun)));
  const refreshSec = batchBusy ? 8 : 30;
  const generated = snapshot?.generated_at
    ? formatWhen(snapshot.generated_at)
    : "—";
  const err = error
    ? `<p class="banner-err">${escapeHtml(error)}</p>`
    : "";
  const queuedNote = queued
    ? `<p class="banner-ok">Požadavek na vypnutí halt je ve frontě. Obnovení DB trvá obvykle do minuty — stránka se sama obnoví.</p>`
    : "";
  const launchedNote = renderBatchStatusBanner({
    runState,
    launched,
    launchedSeries,
    launchedRunId,
  });
  const autoNote = autoQueued
    ? `<p class="banner-ok">Přepínač automatiky je ve frontě. Stav na kartě série se obnoví po persistu DB (obvykle do minuty).</p>`
    : autoSizeQueued
    ? `<p class="banner-ok">Velikost automatické dávky je ve frontě. Platí od další naplánované dávky této série (obvykle do minuty po persistu).</p>`
    : "";
  const suppressedNote = suppressed
    ? `<p class="banner-ok">${
        suppressedAlready
          ? `E-mail ${escapeHtml(suppressedEmail || "")} už v suppression listu je. Další kampaňové dávky ho přeskočí.`
          : `E-mail ${escapeHtml(suppressedEmail || "")} je odhlášený. Zápis do DB je ve frontě GitHub Actions (obvykle do minuty). Další kampaňové dávky ho přeskočí.`
      }</p>`
    : "";
  const launchErr = launchError
    ? `<p class="banner-err">${escapeHtml(launchError)}</p>`
    : "";
  const seriesCards = OUTREACH_SERIES.map((def) => {
    const view = seriesView(snapshot, runState, def);
    const block = launchBlockReason(view, runState);
    const disabled = Boolean(block);
    const progress = view.total
      ? `${view.contacted} / ${view.total} kontaktováno, zbývá ${view.remaining}`
      : "Seznam série se ještě nenačetl ze snapshotu.";
    const expectedNote = view.expected && view.total && view.expected !== view.total
      ? `<p class="hint">V CSV je ${view.total} e-mailů (původní odhad ${view.expected}).</p>`
      : "";
    const cooldown = view.cooldown_active && view.cooldown_until
      ? `<p class="hint">Další dávka této série až po ${formatWhen(view.cooldown_until)}</p>`
      : "";
    const autoOn = Boolean(view.auto_enabled);
    const autoLabel = autoOn ? "ZAPNUTO" : "VYPNUTO";
    const autoClass = autoOn ? "auto-on" : "auto-off";
    const nextEnabled = autoOn ? "0" : "1";
    const batchVal = clampAutoBatch(view.auto_batch_size);
    const sizeRow = `<div class="auto-form-row">
          <label>E-mailů na automatickou dávku
            <input type="number" name="auto_batch" min="1" max="${MAX_BATCH}" value="${batchVal}">
          </label>
          <button class="auto-save-btn" type="submit" name="intent" value="save">Uložit velikost</button>`;
    const formOpen = `<form class="auto-form" method="post" action="/admin/auto" data-series-name="${escapeHtml(view.name)}" data-enable="${nextEnabled}">
        <input type="hidden" name="series" value="${escapeHtml(view.id)}">
        <input type="hidden" name="enabled" value="${nextEnabled}">`;
    let autoBlock = "";
    if (!view.auto_available) {
      autoBlock = `${formOpen}
        <p class="hint">Automatické odesílání: nedostupné, dokud je série zamčená.</p>
        ${sizeRow}
        </div></form>`;
    } else if (view.remaining <= 0 && view.total > 0) {
      autoBlock = `${formOpen}
        <p class="hint">Automatické odesílání: <strong class="auto-off">VYPNUTO</strong> — v sérii už není koho kontaktovat. Velikost dávky platí, až se objeví noví adresáti.</p>
        ${sizeRow}
        </div></form>`;
    } else {
      const btnLabel = autoOn ? "Vypnout automatiku" : "Zapnout automatiku";
      const btnClass = autoOn ? "auto-off-btn" : "auto-on-btn";
      autoBlock = `${formOpen}
        <p class="hint">Automatické odesílání: <strong class="${autoClass}">${autoLabel}</strong>
        — každých ${AUTO_INTERVAL_MIN} min, Po–Pá 8:00–18:00 (Praha). Změna velikosti platí od další naplánované dávky.</p>
        ${sizeRow}
          <button class="${btnClass}" type="submit" name="intent" value="toggle">${btnLabel}</button>
        </div>
      </form>`;
    }
    const lastSuccessNote = view.last_success_at
      ? `<p class="hint">Poslední úspěšná dávka: ${formatWhen(view.last_success_at)}${
          view.last_success_url
            ? ` · <a href="${escapeHtml(view.last_success_url)}" target="_blank" rel="noopener">GHA</a>`
            : ""
        }</p>`
      : `<p class="hint">Poslední úspěšná dávka: zatím žádná</p>`;
    const seriesFailed = Boolean(
      view.last_failed_at
      && (!view.last_success_at || newerStamp(view.last_failed_at, view.last_success_at)),
    );
    const failNote = seriesFailed
      ? `<p class="block-reason">Poslední dávka této série selhala${
          view.last_failed_url
            ? ` — <a href="${escapeHtml(view.last_failed_url)}" target="_blank" rel="noopener">otevřít běh</a>`
            : ""
        }.</p>`
      : "";
    return `<div class="series-card">
      <h3>${escapeHtml(view.name)}</h3>
      <p class="hint">${escapeHtml(progress)}</p>
      ${expectedNote}
      <form class="launch-form" method="post" action="/admin/launch" data-series-name="${escapeHtml(view.name)}">
        <input type="hidden" name="series" value="${escapeHtml(view.id)}">
        <label>Velikost dávky
          <input type="number" name="limit" min="1" max="${MAX_BATCH}" value="${DEFAULT_BATCH}" ${disabled ? "disabled" : ""}>
        </label>
        <button class="launch" type="submit" ${disabled ? "disabled" : ""}>Spustit dávku</button>
      </form>
      ${block ? `<p class="block-reason">${escapeHtml(block)}</p>` : ""}
      ${cooldown}
      ${lastSuccessNote}
      ${failNote}
      ${autoBlock}
    </div>`;
  }).join("");
  const haltBox = halted
    ? `<div class="halt-box">
        <p><strong>Odesílání outreach kampaně je zastavené.</strong>
        ${halt.halt_reason ? ` Důvod: ${escapeHtml(halt.halt_reason)}` : ""}</p>
        <form method="post" action="/admin/resume">
          <button type="submit">Vypnout halt a obnovit odesílání</button>
        </form>
        <p class="hint">Tlačítko spustí GitHub Action, která v DB nastaví halted=0 a persistne ji.
        Pokud bounce rate pořád &gt; 3 % a je odesláno ≥ 10 mailů, další send halt znovu zapne.</p>
      </div>`
    : `<p class="hint">Halt je vypnutý. Další outreach dávka se může odeslat.</p>`;
  const suppressBox = `<div class="suppress-box">
        <h2>Přidat e-mail do suppression listu</h2>
        <p class="hint">Ruční odhlášení, když zákazník odpoví na e-mail nebo napíše přímo (ne přes odkaz v patičce). Použije stejný seznam jako odhlašovací odkaz.</p>
        <form class="suppress-form" method="post" action="/admin/suppress">
          <label>E-mail
            <input type="email" name="email" required placeholder="zakaznik@eshop.cz" autocomplete="off">
          </label>
          <label>Poznámka / důvod (volitelné)
            <input type="text" name="note" maxlength="500" placeholder="odpověděl na e-mail, telefonicky…">
          </label>
          <button class="launch" type="submit">Přidat do suppression listu</button>
        </form>
      </div>`;

  const tableRows = rows.length
    ? rows
        .map((row) => {
          const reason = row.bounce_reason
            ? escapeHtml(String(row.bounce_reason).slice(0, 280))
            : "—";
          const engClass = engagementRowClass(row);
          const trClass = engClass ? ` class="${engClass}"` : "";
          return `<tr${trClass}>
            <td>${escapeHtml(row.email)}</td>
            <td>${escapeHtml(row.domain || "—")}</td>
            <td>${formatWhen(row.sent_at)}</td>
            <td class="${statusClass("smtp", row.smtp_status)}">${escapeHtml(row.smtp_status || "—")}</td>
            <td class="${statusClass("bounce", row.bounce_status)}">${escapeHtml(row.bounce_status || "—")}</td>
            <td class="reason">${reason}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="muted">Zatím žádné outreach odeslání.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <meta http-equiv="refresh" content="${refreshSec}">
  <title>Kampan — GoFixWeb admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #1a2332; --navy-light: #243044; --text-light: #cbd5e1;
      --text-muted: #94a3b8; --green: #16a34a; --red: #f87171; --warn: #fbbf24;
      --border: rgba(255,255,255,0.08);
    }
    body { font-family: Inter, system-ui, sans-serif; background: var(--navy); color: #fff; line-height: 1.5; }
    .wrap { width: min(1100px, 94vw); margin: 0 auto; padding: 1.5rem 0 3rem; }
    h1 { font-size: 1.35rem; font-weight: 800; margin-bottom: 0.35rem; }
    h1 span { color: var(--green); }
    .sub { color: var(--text-muted); margin-bottom: 1.25rem; font-size: 0.9rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .card { background: var(--navy-light); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; }
    .card .k { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .card .v { font-size: 1.45rem; font-weight: 800; margin-top: 0.15rem; }
    .halt-on { color: var(--red); }
    .halt-off { color: var(--green); }
    .ok { color: #4ade80; }
    .bad { color: var(--red); }
    .warn { color: var(--warn); }
    .muted { color: var(--text-muted); }
    .halt-box, .banner-err, .banner-ok, .banner-wait, .links, table { margin-bottom: 1.15rem; }
    .halt-box, .banner-err { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); border-radius: 10px; padding: 1rem; }
    .banner-ok { background: rgba(22,163,74,0.12); border: 1px solid rgba(22,163,74,0.35); border-radius: 10px; padding: 0.85rem 1rem; }
    .banner-wait { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.4); border-radius: 10px; padding: 0.85rem 1rem; display: flex; gap: 0.75rem; align-items: flex-start; }
    .pulse-dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--warn); margin-top: 0.35rem; flex: 0 0 auto; animation: gfw-pulse 1.1s ease-in-out infinite; }
    @keyframes gfw-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.82); } }
    button { margin-top: 0.75rem; border: 0; border-radius: 8px; padding: 0.8rem 1.1rem; font-weight: 700; background: var(--red); color: #fff; cursor: pointer; }
    button.launch { background: var(--green); margin-top: 0; }
    button.auto-on-btn { background: var(--green); margin-top: 0; }
    button.auto-off-btn { background: #64748b; margin-top: 0; }
    button.auto-save-btn { background: #334155; margin-top: 0; }
    .auto-on { color: var(--green); }
    .auto-off { color: var(--text-muted); }
    button:disabled { opacity: 0.45; cursor: not-allowed; background: #64748b; }
    .series-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .series-card { background: var(--navy-light); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
    .series-card h3 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    .launch-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.55rem; margin-top: 0.7rem; }
    .launch-form label { color: var(--text-muted); font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .launch-form input[type=number] { width: 5.5rem; padding: 0.45rem 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: #0f172a; color: #fff; }
    .auto-form-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.55rem; margin-top: 0.55rem; }
    .auto-form-row label { color: var(--text-muted); font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .auto-form-row input[type=number] { width: 5.5rem; padding: 0.45rem 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: #0f172a; color: #fff; }
    .suppress-box { background: var(--navy-light); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; margin-bottom: 1.15rem; }
    .suppress-box h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    .orders-box { background: var(--navy-light); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; margin-bottom: 1.15rem; }
    .orders-box h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    .orders-box .cards { margin-top: 0.75rem; }
    .orders-box .card .v { font-size: 1.05rem; font-weight: 700; }
    .orders-match-details { margin-top: 0.85rem; }
    .orders-match-details > summary { cursor: pointer; color: var(--green); font-weight: 600; }
    .orders-match-table { overflow-x: auto; margin-top: 0.55rem; }
    .orders-match-table table { min-width: 760px; }
    .probable-tag { color: var(--warn); font-size: 0.75rem; font-weight: 600; }
    .exact-tag { color: #4ade80; font-size: 0.75rem; font-weight: 600; }
    .suppress-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.55rem; margin-top: 0.7rem; }
    .suppress-form label { color: var(--text-muted); font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; flex: 1 1 180px; }
    .suppress-form input[type=email],
    .suppress-form input[type=text] { width: 100%; min-width: 12rem; padding: 0.45rem 0.5rem; border-radius: 6px; border: 1px solid var(--border); background: #0f172a; color: #fff; }
    .block-reason { color: var(--red); font-size: 0.85rem; margin-top: 0.55rem; }
    .hint { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.6rem; }
    a { color: var(--green); }
    .links a { margin-right: 1rem; display: inline-block; margin-bottom: 0.35rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
    td.reason { color: var(--text-light); max-width: 280px; word-break: break-word; }
    tr.eng-opened td { background: rgba(14, 165, 233, 0.72); }
    tr.eng-clicked td { background: rgba(34, 197, 94, 0.74); }
    tr.eng-replied td { background: rgba(249, 115, 22, 0.76); }
    tr.eng-opened td:first-child { box-shadow: inset 4px 0 0 #38bdf8; }
    tr.eng-clicked td:first-child { box-shadow: inset 4px 0 0 #4ade80; }
    tr.eng-replied td:first-child { box-shadow: inset 4px 0 0 #fb923c; }
    .eng-legend { color: var(--text-muted); font-size: 0.8rem; margin: 0 0 0.55rem; display: flex; flex-wrap: wrap; gap: 0.75rem 1.1rem; }
    .eng-legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
    .eng-swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
    .eng-swatch.opened { background: #38bdf8; }
    .eng-swatch.clicked { background: #4ade80; }
    .eng-swatch.replied { background: #fb923c; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>GoFix<span>Web</span> — stav kampaně</h1>
    <p class="sub">Interní přehled. Snapshot z DB: ${generated}. Obnova každých ${refreshSec} s.</p>
    ${err}${queuedNote}${launchedNote}${autoNote}${suppressedNote}${launchErr}
    <div class="cards">
      <div class="card"><div class="k">Odesláno</div><div class="v">${escapeHtml(stats.sent ?? 0)}</div></div>
      <div class="card"><div class="k">Accepted</div><div class="v ok">${escapeHtml(stats.accepted ?? 0)}</div></div>
      <div class="card"><div class="k">Scan selhal</div><div class="v warn">${escapeHtml(stats.scan_failed ?? 0)}</div></div>
      <div class="card"><div class="k">Už zákazník</div><div class="v warn">${escapeHtml(stats.already_customer ?? 0)}</div></div>
      <div class="card"><div class="k">Bounced</div><div class="v bad">${escapeHtml(stats.bounced ?? 0)}</div></div>
      <div class="card"><div class="k">Uncertain</div><div class="v warn">${escapeHtml(stats.uncertain ?? 0)}</div></div>
      <div class="card"><div class="k">Pending</div><div class="v">${escapeHtml(stats.pending ?? 0)}</div></div>
      <div class="card"><div class="k">Bounce rate</div><div class="v">${escapeHtml(Number(stats.bounce_rate ?? 0).toFixed(2))} %</div></div>
      <div class="card"><div class="k">Otevřeno</div><div class="v">${escapeHtml(stats.opened ?? 0)} / ${escapeHtml(stats.sent ?? 0)}</div></div>
      <div class="card"><div class="k">Open rate</div><div class="v">${escapeHtml(Number(stats.open_rate ?? 0).toFixed(2))} %</div></div>
      <div class="card"><div class="k">Kliknutí</div><div class="v">${escapeHtml(stats.clicked ?? 0)} / ${escapeHtml(stats.sent ?? 0)}</div></div>
      <div class="card"><div class="k">Click rate</div><div class="v">${escapeHtml(Number(stats.click_rate ?? 0).toFixed(2))} %</div></div>
      <div class="card"><div class="k">Odpovědi</div><div class="v">${escapeHtml(stats.replied ?? 0)} / ${escapeHtml(stats.sent ?? 0)}</div></div>
      <div class="card"><div class="k">Halt</div><div class="v ${haltClass}">${haltLabel}</div></div>
      <div class="card"><div class="k">Poslední úspěšná dávka</div><div class="v" style="font-size:1.05rem;font-weight:700">${lastSuccess ? formatWhen(lastSuccess.completed_at) : "—"}</div></div>
    </div>
    ${haltBox}
    ${suppressBox}
    <h2 style="font-size:1.05rem;margin:0 0 0.65rem;">E-mailové série</h2>
    <div class="series-grid">${seriesCards}</div>
    ${renderOrdersBox(orders, ordersError)}
    ${renderWhyNotBuyBox(snapshot?.why_not_buy)}
    <div class="links">
      <a href="${ADMIN_LINKS.scans}" target="_blank" rel="noopener">GHA scan jobs</a>
      <a href="${ADMIN_LINKS.bounce}" target="_blank" rel="noopener">GHA bounce monitor</a>
      <a href="${ADMIN_LINKS.resume}" target="_blank" rel="noopener">GHA resume halt</a>
      <a href="${ADMIN_LINKS.outreach}" target="_blank" rel="noopener">GHA outreach dávky</a>
      <a href="${ADMIN_LINKS.auto}" target="_blank" rel="noopener">GHA automatika</a>
      <a href="${ADMIN_LINKS.unsub}" target="_blank" rel="noopener">GHA unsubscribe</a>
      <a href="${ADMIN_LINKS.engagement}" target="_blank" rel="noopener">GHA engagement</a>
      <a href="${ADMIN_LINKS.survey}" target="_blank" rel="noopener">GHA 48h survey</a>
      <a href="${ADMIN_LINKS.openSurvey}" target="_blank" rel="noopener">GHA 2h survey</a>
      <a href="${ADMIN_LINKS.exitIntent}" target="_blank" rel="noopener">GHA exit-intent</a>
      <a href="${ADMIN_LINKS.actions}" target="_blank" rel="noopener">Všechny Actions</a>
      <a href="${GMAIL_BOUNCE_SEARCH_URL}" target="_blank" rel="noopener">Gmail bounce search</a>
    </div>
    <p class="eng-legend">
      <span><i class="eng-swatch opened"></i> otevřeno</span>
      <span><i class="eng-swatch clicked"></i> klik na CTA</span>
      <span><i class="eng-swatch replied"></i> odpověď — zkontrolovat v Gmailu</span>
    </p>
    <table>
      <thead>
        <tr>
          <th>E-mail</th><th>Doména</th><th>Odesláno</th>
          <th>SMTP</th><th>Bounce</th><th>Důvod</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <script>
    document.querySelectorAll("form.launch-form").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        var input = form.querySelector('input[name="limit"]');
        var n = Number(input && input.value);
        var name = form.getAttribute("data-series-name") || "";
        if (n > 10 && !window.confirm("Opravdu odeslat " + n + " e-mailů ze série " + name + "?")) {
          event.preventDefault();
          return;
        }
        var btn = form.querySelector("button.launch");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Odesílám…";
        }
      });
    });
    document.querySelectorAll("form.auto-form").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        var submitter = event.submitter;
        var intent = (submitter && submitter.getAttribute("value")) || "toggle";
        if (intent === "save") return;
        if (form.getAttribute("data-enable") !== "1") return;
        var name = form.getAttribute("data-series-name") || "";
        var input = form.querySelector('input[name="auto_batch"]');
        var n = Number(input && input.value);
        if (!Number.isFinite(n) || n < 1) n = ${DEFAULT_BATCH};
        var msg = "Zapnout automatické odesílání série " + name + "? Dávky po " + n + " e-mailech každých 30 min, pracovní dny 8:00–18:00 (Praha).";
        if (!window.confirm(msg)) event.preventDefault();
      });
    });
    setTimeout(function () { location.reload(); }, ${refreshSec}000);
  </script>
</body>
</html>`;
}

function adminHtmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function handleAdminPage(request, env) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const denied = await requireAdminAuth(request, env);
  if (denied) return denied;
  const url = new URL(request.url);
  const queued = url.searchParams.get("queued") === "1";
  const launched = url.searchParams.get("launched") === "1";
  const launchedSeries = String(url.searchParams.get("series") || "").trim();
  const launchedRunId = String(url.searchParams.get("run") || "").trim();
  const autoQueued = url.searchParams.get("auto") === "1";
  const autoSizeQueued = url.searchParams.get("auto_size") === "1";
  const suppressed = url.searchParams.get("suppressed") === "1";
  const suppressedAlready = url.searchParams.get("already") === "1";
  const suppressedEmail = String(url.searchParams.get("email") || "").trim().toLowerCase();
  let snapshot = { stats: {}, halt: {}, rows: [], series: {} };
  let error = "";
  let runState = emptyOutreachRunState();
  const [snapResult, runResult] = await Promise.allSettled([
    fetchCampaignSnapshot(env),
    fetchOutreachRunState(env, launchedRunId),
  ]);
  if (snapResult.status === "fulfilled") {
    snapshot = snapResult.value;
  } else {
    const err = snapResult.reason;
    error = "Snapshot z DB se nepodařilo načíst: " + String(err && err.message ? err.message : err);
    snapshot = { stats: {}, halt: {}, rows: [], series: {} };
  }
  if (runResult.status === "fulfilled") {
    runState = runResult.value;
  } else {
    console.error("admin_run_state_failed", runResult.reason);
  }
  const orders = await resolveAdminOrders(snapshot);
  const ordersError = String(snapshot?.orders?.error || snapshot?.orders_error || "");
  return adminHtmlResponse(renderAdminHtml(snapshot, {
    error, queued, launched, launchedSeries, launchedRunId, autoQueued, autoSizeQueued, suppressed, suppressedAlready, suppressedEmail, runState,
    orders, ordersError,
  }));
}

async function handleAdminResume(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const denied = await requireAdminAuth(request, env);
  if (denied) return denied;
  try {
    await dispatchGithubEvent(env, "email-campaign-resume", {
      source: "admin",
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("admin_resume_dispatch_failed", err);
    const deniedPage = renderAdminHtml(
      { stats: {}, halt: { halted: true }, rows: [] },
      { error: "Resume GHA se nepodařilo spustit. Zkuste workflow ručně." },
    );
    return adminHtmlResponse(deniedPage, 502);
  }
  return Response.redirect(new URL("/admin?queued=1", request.url).toString(), 303);
}

async function handleAdminLaunch(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const denied = await requireAdminAuth(request, env);
  if (denied) return denied;

  const fail = async (message, status = 400) => {
    let snapshot = { stats: {}, halt: {}, rows: [], series: {} };
    let runState = emptyOutreachRunState();
    try {
      snapshot = await fetchCampaignSnapshot(env);
    } catch {}
    try {
      runState = await fetchOutreachRunState(env);
    } catch {}
    return adminHtmlResponse(
      renderAdminHtml(snapshot, { launchError: message, runState }),
      status,
    );
  };

  let series = "";
  let limit = DEFAULT_BATCH;
  try {
    const form = await request.formData();
    series = String(form.get("series") || "").trim();
    limit = clampBatchSize(form.get("limit"));
  } catch {
    return fail("Neplatný formulář.");
  }

  let snapshot = { stats: {}, halt: {}, rows: [], series: {} };
  let runState = emptyOutreachRunState();
  try {
    snapshot = await fetchCampaignSnapshot(env);
  } catch (err) {
    return fail("Snapshot z DB se nepodařilo načíst: " + String(err && err.message ? err.message : err), 502);
  }
  try {
    runState = await fetchOutreachRunState(env);
  } catch (err) {
    console.error("admin_run_state_failed", err);
  }

  const verdict = validateLaunchServer(snapshot, runState, series, limit);
  if (!verdict.ok) return fail(verdict.error);

  const dispatchedAt = new Date().toISOString();
  try {
    await dispatchGithubEvent(env, "outreach-batch", {
      source: "admin",
      series,
      limit: String(limit),
      at: dispatchedAt,
    });
  } catch (err) {
    console.error("admin_launch_dispatch_failed", err);
    return fail("Outreach GHA se nepodařilo spustit. Zkuste workflow ručně.", 502);
  }
  let runId = "";
  try {
    const found = await findRecentOutreachRun(env, { series, sinceIso: dispatchedAt });
    if (found && found.id) runId = String(found.id);
  } catch (err) {
    console.error("admin_launch_find_run_failed", err);
  }
  const next = new URL("/admin", request.url);
  next.searchParams.set("launched", "1");
  next.searchParams.set("series", series);
  if (runId) next.searchParams.set("run", runId);
  return Response.redirect(next.toString(), 303);
}

function truthyEnabled(raw) {
  return ["1", "true", "yes", "on"].includes(String(raw || "").trim().toLowerCase());
}

async function handleAdminAuto(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const denied = await requireAdminAuth(request, env);
  if (denied) return denied;

  const fail = async (message, status = 400) => {
    let snapshot = { stats: {}, halt: {}, rows: [], series: {} };
    let runState = emptyOutreachRunState();
    try {
      snapshot = await fetchCampaignSnapshot(env);
    } catch {}
    try {
      runState = await fetchOutreachRunState(env);
    } catch {}
    return adminHtmlResponse(
      renderAdminHtml(snapshot, { launchError: message, runState }),
      status,
    );
  };

  let series = "";
  let enabled = false;
  let intent = "toggle";
  let autoBatch = DEFAULT_BATCH;
  try {
    const form = await request.formData();
    series = String(form.get("series") || "").trim();
    intent = String(form.get("intent") || "toggle").trim().toLowerCase() || "toggle";
    autoBatch = clampAutoBatch(form.get("auto_batch"));
    enabled = truthyEnabled(form.get("enabled"));
  } catch {
    return fail("Neplatný formulář.");
  }

  if (!OUTREACH_SERIES.some((item) => item.id === series)) {
    return fail("Neznámá série.");
  }
  if (autoBatch < 1 || autoBatch > MAX_BATCH) {
    return fail(`Velikost automatické dávky musí být 1–${MAX_BATCH}.`);
  }

  let snapshot = { stats: {}, halt: {}, rows: [], series: {} };
  let runState = emptyOutreachRunState();
  try {
    snapshot = await fetchCampaignSnapshot(env);
  } catch (err) {
    return fail("Snapshot z DB se nepodařilo načíst: " + String(err && err.message ? err.message : err), 502);
  }
  try {
    runState = await fetchOutreachRunState(env);
  } catch (err) {
    console.error("admin_run_state_failed", err);
  }

  const def = OUTREACH_SERIES.find((item) => item.id === series);
  const view = seriesView(snapshot, runState, def);
  if (intent === "save") {
    enabled = Boolean(view.auto_enabled);
  }
  if (enabled) {
    if (!view.auto_available || view.locked) {
      return fail(WAVE_LOCK_TEXT);
    }
    if (view.remaining <= 0 && view.total > 0) {
      return fail("V této sérii už není koho kontaktovat.");
    }
  }

  try {
    await dispatchGithubEvent(env, "outreach-auto-toggle", {
      source: "admin",
      series,
      enabled: enabled ? "true" : "false",
      auto_batch: String(autoBatch),
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("admin_auto_dispatch_failed", err);
    return fail("Přepnutí automatiky se nepodařilo spustit. Zkuste workflow ručně.", 502);
  }
  if (intent === "save") {
    return Response.redirect(new URL("/admin?auto_size=1", request.url).toString(), 303);
  }
  return Response.redirect(new URL("/admin?auto=1", request.url).toString(), 303);
}

function parseAdminUser(request) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Basic\s+(\S+)/i.exec(header);
  if (!match) return "";
  try {
    const decoded = atob(match[1]);
    const idx = decoded.indexOf(":");
    return (idx >= 0 ? decoded.slice(0, idx) : decoded).trim();
  } catch {
    return "";
  }
}

async function fetchSuppressedEmails(env) {
  const repo = env.GITHUB_REPO || "gypa70/gofixweb-scanner";
  const token = env.GITHUB_TOKEN;
  if (!token) return new Set();
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/data/email_suppression.json?ref=main`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw",
        "User-Agent": "gofixweb-report-worker",
        "Cache-Control": "no-cache",
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    },
  );
  if (!res.ok) return new Set();
  const payload = await res.json();
  const emails = payload && typeof payload === "object" ? payload.emails : null;
  if (!emails || typeof emails !== "object") return new Set();
  return new Set(
    Object.keys(emails)
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item) => EMAIL_RE.test(item)),
  );
}

async function handleAdminSuppress(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const denied = await requireAdminAuth(request, env);
  if (denied) return denied;

  const fail = async (message, status = 400) => {
    let snapshot = { stats: {}, halt: {}, rows: [], series: {} };
    let runState = emptyOutreachRunState();
    try {
      snapshot = await fetchCampaignSnapshot(env);
    } catch {}
    try {
      runState = await fetchOutreachRunState(env);
    } catch {}
    return adminHtmlResponse(
      renderAdminHtml(snapshot, { launchError: message, runState }),
      status,
    );
  };

  let email = "";
  let note = "";
  try {
    const form = await request.formData();
    email = String(form.get("email") || "").trim().toLowerCase();
    note = String(form.get("note") || "").trim().slice(0, 500);
  } catch {
    return fail("Neplatný formulář.");
  }
  if (!EMAIL_RE.test(email)) {
    return fail("Zadejte platnou e-mailovou adresu.");
  }

  const addedBy = parseAdminUser(request) || String(env.ADMIN_BASIC_USER || "gofixweb").trim() || "admin";
  let already = await cacheHasUnsub(email);
  try {
    const listed = await fetchSuppressedEmails(env);
    already = already || listed.has(email);
  } catch (err) {
    console.error("admin_suppress_list_failed", err);
  }

  await caches.default.put(unsubCacheKey(email), new Response("1"), { expirationTtl: UNSUB_CACHE_TTL });
  try {
    await dispatchGithubEvent(env, "email-unsubscribe", {
      source: "admin",
      email,
      note,
      added_by: addedBy,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("admin_suppress_dispatch_failed", err);
    return fail("Odhlášení se nepodařilo zapsat do GHA. Zkuste workflow ručně.", 502);
  }
  const next = new URL("/admin", request.url);
  next.searchParams.set("suppressed", "1");
  next.searchParams.set("email", email);
  if (already) next.searchParams.set("already", "1");
  return Response.redirect(next.toString(), 303);
}

const UNSUB_CACHE_TTL = 31536000;

function unsubCacheKey(email) {
  return `https://unsub.gofixweb/e/${String(email || "").trim().toLowerCase()}`;
}

function unsubscribeHtml(title, message) {
  const safeTitle = String(title || "");
  const safeMessage = String(message || "");
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} — GoFixWeb</title>
</head>
<body style="margin:0;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#1a2332;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:0 auto;">
    <tr><td style="padding:0 0 16px 0;font-size:22px;font-weight:700;">GoFix<span style="color:#16a34a;">Web</span></td></tr>
    <tr><td style="padding:0 0 12px 0;font-size:20px;font-weight:700;">${safeTitle}</td></tr>
    <tr><td style="padding:0;font-size:16px;line-height:1.5;">${safeMessage}</td></tr>
  </table>
</body>
</html>`;
}

async function tokenMatchesUnsubscribe(env, email, token) {
  const secret = String(env.UNSUBSCRIBE_SECRET || "").trim();
  if (!secret) return false;
  const expected = await hmacSha256Hex(secret, String(email || "").trim().toLowerCase());
  return timingSafeEqualHex(expected, String(token || "").trim().toLowerCase());
}

async function markUnsubscribed(env, email) {
  const cache = caches.default;
  await cache.put(unsubCacheKey(email), new Response("1"), { expirationTtl: UNSUB_CACHE_TTL });
  try {
    await dispatchGithubEvent(env, "email-unsubscribe", {
      email,
      source: "link",
    });
  } catch (err) {
    console.error("unsubscribe_dispatch_failed", err);
  }
}

async function cacheHasUnsub(email) {
  const hit = await caches.default.match(unsubCacheKey(email));
  return Boolean(hit);
}

const ENG_CACHE_TTL = 31536000;
const TRACKING_ID_RE = /^[A-Za-z0-9]{8,64}$/;
const CLICK_PRODUCTS = new Set(["manual_fix", "wp_autofix"]);
const SURVEY_REASONS = new Set(["price", "trust", "other"]);
const SURVEY_SOURCES = new Set(["click_48h", "open_2h"]);
const EXIT_INTENT_REASONS = new Set(["price", "trust", "dismiss"]);
const PIXEL_GIF = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255,
  33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

function trackingCacheKey(kind, trackingId) {
  return `https://eng.gofixweb/${kind}/${String(trackingId || "").trim()}`;
}

async function tokenMatchesTracking(env, payload, token) {
  const secret = String(env.UNSUBSCRIBE_SECRET || "").trim();
  if (!secret) return false;
  const expected = await hmacSha256Hex(secret, payload);
  return timingSafeEqualHex(expected, String(token || "").trim().toLowerCase());
}

async function recordEngagementOnce(env, kind, trackingId) {
  const cache = caches.default;
  const key = trackingCacheKey(kind, trackingId);
  const hit = await cache.match(key);
  if (hit) return false;
  await cache.put(key, new Response("1"), { expirationTtl: ENG_CACHE_TTL });
  try {
    await dispatchGithubEvent(env, "email-engagement", {
      message_id: `${trackingId}@gofixweb.com`,
      kind,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("engagement_dispatch_failed", err);
  }
  return true;
}

function pixelGifResponse() {
  return new Response(PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function handleTrackOpen(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/o\/([A-Za-z0-9]{8,64})$/);
  if (!match) return new Response("Not Found", { status: 404 });
  const id = match[1];
  if (!TRACKING_ID_RE.test(id)) return pixelGifResponse();
  const token = String(url.searchParams.get("t") || "").trim();
  if (!(await tokenMatchesTracking(env, `open\n${id}`, token))) {
    return pixelGifResponse();
  }
  await recordEngagementOnce(env, "open", id);
  return pixelGifResponse();
}

async function handleTrackClick(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/r\/([A-Za-z0-9]{8,64})$/);
  if (!match) return new Response("Not Found", { status: 404 });
  const id = match[1];
  const product = String(url.searchParams.get("p") || "").trim();
  const domain = String(url.searchParams.get("d") || "").trim();
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("t") || "").trim();
  if (!CLICK_PRODUCTS.has(product) || !TRACKING_ID_RE.test(id)) {
    return new Response("Invalid link", { status: 400 });
  }
  const payload = `click\n${id}\n${product}\n${domain}\n${email}`;
  if (!(await tokenMatchesTracking(env, payload, token))) {
    return new Response("Invalid link", { status: 400 });
  }
  await recordEngagementOnce(env, "click", id);
  const dest = new URL("/checkout", url.origin);
  dest.searchParams.set("product", product);
  dest.searchParams.set("tid", id);
  if (domain) dest.searchParams.set("domain", domain);
  if (email) dest.searchParams.set("email", email);
  return Response.redirect(dest.toString(), 302);
}

function surveyThanksHtml() {
  return unsubscribeHtml(
    "Díky za zpětnou vazbu",
    "Odpověď jsme zaznamenali. Už vás tímto dotazníkem znovu obtěžovat nebudeme.",
  );
}

function surveyOtherFormHtml(actionUrl) {
  const safeAction = escapeHtml(actionUrl);
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jiný důvod — GoFixWeb</title>
</head>
<body style="margin:0;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#1a2332;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:0 auto;">
    <tr><td style="padding:0 0 16px 0;font-size:22px;font-weight:700;">GoFix<span style="color:#16a34a;">Web</span></td></tr>
    <tr><td style="padding:0 0 12px 0;font-size:20px;font-weight:700;">Jiný důvod</td></tr>
    <tr><td style="padding:0 0 16px 0;font-size:16px;line-height:1.5;">Napište nám krátce, co rozhodlo. Pole je volitelné — můžete odeslat i prázdné.</td></tr>
    <tr><td>
      <form method="post" action="${safeAction}">
        <textarea name="note" maxlength="500" rows="4" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:15px;"></textarea>
        <p style="margin:12px 0 0 0;">
          <button type="submit" style="border:0;border-radius:8px;padding:10px 16px;background:#16a34a;color:#fff;font-weight:700;cursor:pointer;">Odeslat</button>
        </p>
      </form>
    </td></tr>
  </table>
</body>
</html>`;
}

function surveyCacheKey(trackingId, source) {
  const src = SURVEY_SOURCES.has(source) ? source : "click_48h";
  return `https://survey.gofixweb/${src}/${String(trackingId || "").trim()}`;
}

function surveySourceFromUrl(url) {
  const raw = String(url.searchParams.get("src") || "").trim();
  return SURVEY_SOURCES.has(raw) ? raw : "click_48h";
}

async function surveyTokenMatches(env, id, reason, source, token) {
  if (source === "click_48h") {
    if (await tokenMatchesTracking(env, `survey\n${id}\n${reason}`, token)) return true;
    if (await tokenMatchesTracking(env, `survey\n${id}\n${reason}\nclick_48h`, token)) return true;
    return false;
  }
  return tokenMatchesTracking(env, `survey\n${id}\n${reason}\n${source}`, token);
}

async function recordSurveyOnce(env, trackingId, reason, freeText, source) {
  const src = SURVEY_SOURCES.has(source) ? source : "click_48h";
  const cache = caches.default;
  const key = surveyCacheKey(trackingId, src);
  const hit = await cache.match(key);
  if (hit) return false;
  await cache.put(key, new Response("1"), { expirationTtl: ENG_CACHE_TTL });
  try {
    await dispatchGithubEvent(env, "email-click-survey", {
      tracking_id: trackingId,
      reason,
      source: src,
      text: String(freeText || "").slice(0, 500),
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("survey_dispatch_failed", err);
  }
  return true;
}

async function handleSurvey(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/survey\/([A-Za-z0-9]{8,64})$/);
  if (!match) return new Response("Not Found", { status: 404 });
  const id = match[1];
  const reason = String(url.searchParams.get("reason") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("t") || "").trim();
  const source = surveySourceFromUrl(url);
  const invalid = unsubscribeHtml(
    "Odkaz je neplatný",
    "Tento odkaz na dotazník je neplatný nebo poškozený.",
  );
  if (!TRACKING_ID_RE.test(id) || !SURVEY_REASONS.has(reason)) {
    return new Response(invalid, { status: 400, headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }
  if (!(await surveyTokenMatches(env, id, reason, source, token))) {
    return new Response(invalid, { status: 400, headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }
  const thanks = new Response(surveyThanksHtml(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
  if (reason === "other" && request.method === "GET") {
    return new Response(surveyOtherFormHtml(url.toString()), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  let note = "";
  if (reason === "other" && request.method === "POST") {
    try {
      const form = await request.formData();
      note = String(form.get("note") || "").trim().slice(0, 500);
    } catch {
      note = "";
    }
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }
  await recordSurveyOnce(env, id, reason, note, source);
  return thanks;
}

async function handleExitIntent(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = String(body.reason || "").trim().toLowerCase();
  if (!EXIT_INTENT_REASONS.has(reason)) {
    return jsonResponse({ ok: false, error: "invalid_reason" }, 400);
  }
  let tid = String(body.tid || body.tracking_id || "").trim();
  if (tid && !TRACKING_ID_RE.test(tid)) tid = "";
  const cache = caches.default;
  const ip = clientIp(request) || "unknown";
  const debounceKey = new Request(`https://exit.gofixweb/${ip}`);
  if (await cache.match(debounceKey)) {
    return jsonResponse({ ok: true, duplicate: true });
  }
  await cache.put(debounceKey, new Response("1"), { expirationTtl: 2 });
  try {
    await dispatchGithubEvent(env, "email-exit-intent", {
      tracking_id: tid,
      reason,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("exit_intent_dispatch_failed", err);
  }
  return jsonResponse({ ok: true });
}

async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("token") || "").trim();
  const invalid = unsubscribeHtml(
    "Odhlášení se nezdařilo",
    "Odkaz je neplatný nebo vypršel. Napište na info@gofixweb.com a odhlášení vyřídíme ručně.",
  );
  if (!EMAIL_RE.test(email) || !(await tokenMatchesUnsubscribe(env, email, token))) {
    return new Response(invalid, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  }
  await markUnsubscribed(env, email);
  const ok = unsubscribeHtml(
    "Odhlášení dokončeno",
    `E-mail ${email} jsme odhlásili. Další obchodní zprávy z kampaní GoFixWeb na něj posílat nebudeme.`,
  );
  return new Response(ok, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}

async function handleUnsubStatus(request, env) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("token") || "").trim();
  if (!EMAIL_RE.test(email) || !(await tokenMatchesUnsubscribe(env, email, token))) {
    return jsonResponse({ ok: false, error: "invalid" }, 400);
  }
  const suppressed = await cacheHasUnsub(email);
  return jsonResponse({ ok: true, suppressed }, 200);
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      refreshAdminOrdersCache(env).catch((err) => {
        console.error("admin_orders_cron_failed", err);
      }),
    );
  },
  async fetch(request, env, ctx) {
    const aliasRedirect = aliasTldRedirect(request);
    if (aliasRedirect) return aliasRedirect;

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

    if (url.pathname === "/exit-intent") {
      return handleExitIntent(request, env);
    }

    if (/^\/o\/[A-Za-z0-9]{8,64}$/.test(url.pathname)) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleTrackOpen(request, env);
    }

    if (/^\/r\/[A-Za-z0-9]{8,64}$/.test(url.pathname)) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleTrackClick(request, env);
    }

    if (/^\/survey\/[A-Za-z0-9]{8,64}$/.test(url.pathname)) {
      if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleSurvey(request, env);
    }

    if (url.pathname === "/wp-onboarding") {
      return handleWpOnboarding(request, env, origin);
    }

    if (url.pathname === "/wp-rollback") {
      return handleWpRollback(request, env);
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return handleAdminPage(request, env);
    }

    if (url.pathname === "/admin/resume") {
      return handleAdminResume(request, env);
    }

    if (url.pathname === "/admin/launch") {
      return handleAdminLaunch(request, env);
    }

    if (url.pathname === "/admin/auto") {
      return handleAdminAuto(request, env);
    }

    if (url.pathname === "/admin/suppress") {
      return handleAdminSuppress(request, env);
    }

    if (url.pathname === "/unsubscribe") {
      if (request.method !== "GET" && request.method !== "POST") {
        return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, origin);
      }
      return handleUnsubscribe(request, env);
    }

    if (url.pathname === "/unsub-status") {
      return handleUnsubStatus(request, env);
    }

    if (url.pathname === "/admin/unsub-clear") {
      const denied = await requireAdminAuth(request, env);
      if (denied) return denied;
      const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return jsonResponse({ ok: false, error: "invalid_email" }, 400);
      }
      await caches.default.delete(unsubCacheKey(email));
      return jsonResponse({ ok: true, email, cleared: true }, 200);
    }

    if (url.pathname === "/blog" || url.pathname.startsWith("/blog/")) {
      const blog = handleBlogRequest(request);
      if (blog) return blog;
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
