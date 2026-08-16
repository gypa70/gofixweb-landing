/**
 * GoFixWeb — příjem lead formuláře a spuštění GitHub Actions (repository_dispatch).
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN       — PAT s repo scope pro gofixweb-scanner
 *   TURNSTILE_SECRET   — Turnstile secret key (siteverify)
 *   WEBHOOK_SECRET     — volitelný shared secret z formuláře
 */

const ALLOWED_ORIGINS = new Set([
  "https://gofixweb.com",
  "https://www.gofixweb.com",
]);

const TURNSTILE_ACTION = "free-report";
const TURNSTILE_HOSTNAMES = new Set(["gofixweb.com", "www.gofixweb.com"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
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
