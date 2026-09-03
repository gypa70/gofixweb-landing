#!/usr/bin/env python3
"""Create Cloudflare zones and 301 path-preserving redirects for alias TLDs.

Does NOT touch gofixweb.com (GitHub Pages + Google Workspace mail).
Optional Porkbun nameserver update if PORKBUN_API_KEY + PORKBUN_SECRET_API_KEY are set.
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from typing import Any

CF_API = "https://api.cloudflare.com/client/v4"
PORKBUN_API = "https://api.porkbun.com/api/json/v3"
PRIMARY = "gofixweb.com"
DUMMY_ORIGIN = "192.0.2.1"

DOMAINS = ("gofixweb.cz", "gofixweb.eu", "gofixweb.de", "gofixweb.ai")

# Preserve existing Websupport/Active24 mailbox routing on .cz if NS move to Cloudflare.
CZ_MAIL = (
    {"type": "MX", "name": "@", "content": "mx10.active24.cz", "priority": 10},
    {"type": "MX", "name": "@", "content": "mx20.active24.cz", "priority": 20},
    {
        "type": "TXT",
        "name": "@",
        "content": "v=spf1 a mx include:_spf.websupport.cz -all",
    },
)

REDIRECT_RULE = {
    "ref": "alias_tld_to_gofixweb_com",
    "expression": "true",
    "description": "301 entire hostname to gofixweb.com, keep path and query",
    "action": "redirect",
    "action_parameters": {
        "from_value": {
            "target_url": {
                "expression": 'concat("https://gofixweb.com", http.request.uri.path)',
            },
            "status_code": 301,
            "preserve_query_string": True,
        }
    },
}


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def cf_token() -> str:
    token = (os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not token:
        die("CLOUDFLARE_API_TOKEN is empty")
    return token


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: Any = None,
    timeout: int = 60,
) -> tuple[int, Any]:
    data = None
    req_headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return exc.code, parsed


def cf(method: str, path: str, body: Any = None) -> Any:
    status, payload = http_json(
        method,
        f"{CF_API}{path}",
        headers={"Authorization": f"Bearer {cf_token()}"},
        body=body,
    )
    if status >= 400 or not payload.get("success", True):
        errors = payload.get("errors") or payload
        die(f"Cloudflare {method} {path} -> HTTP {status}: {errors}")
    return payload


def cf_try(method: str, path: str, body: Any = None) -> tuple[int, Any]:
    return http_json(
        method,
        f"{CF_API}{path}",
        headers={"Authorization": f"Bearer {cf_token()}"},
        body=body,
    )


def account_id() -> str:
    forced = (os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "").strip()
    if forced:
        return forced
    payload = cf("GET", "/accounts?per_page=50")
    result = payload.get("result") or []
    if not result:
        die("No Cloudflare accounts visible to this token")
    if len(result) > 1:
        print("Multiple Cloudflare accounts; using the first. Set CLOUDFLARE_ACCOUNT_ID to pin.")
        for row in result:
            print(f"  - {row.get('id')} {row.get('name')}")
    return result[0]["id"]


def get_zone(name: str) -> dict[str, Any] | None:
    payload = cf("GET", f"/zones?name={name}")
    rows = payload.get("result") or []
    return rows[0] if rows else None


def ensure_zone(name: str, acc: str) -> dict[str, Any]:
    existing = get_zone(name)
    if existing:
        print(f"[{name}] zone exists id={existing['id']} status={existing.get('status')}")
        return existing
    print(f"[{name}] creating zone")
    payload = cf(
        "POST",
        "/zones",
        {
            "name": name,
            "account": {"id": acc},
            "jump_start": False,
            "type": "full",
        },
    )
    zone = payload["result"]
    print(f"[{name}] created id={zone['id']} ns={zone.get('name_servers')}")
    return zone


def list_dns(zone_id: str) -> list[dict[str, Any]]:
    payload = cf("GET", f"/zones/{zone_id}/dns_records?per_page=500")
    return payload.get("result") or []


def upsert_dns(
    zone_id: str,
    *,
    rtype: str,
    name: str,
    content: str,
    proxied: bool | None = None,
    priority: int | None = None,
) -> None:
    records = list_dns(zone_id)
    match = None
    for rec in records:
        if rec.get("type") == rtype and rec.get("name") == name:
            match = rec
            break

    body: dict[str, Any] = {"type": rtype, "name": name, "content": content, "ttl": 1}
    if proxied is not None:
        body["proxied"] = proxied
    if priority is not None:
        body["priority"] = priority

    if match:
        if (
            match.get("content") == content
            and (proxied is None or match.get("proxied") == proxied)
            and (priority is None or match.get("priority") == priority)
        ):
            print(f"  DNS ok {rtype} {name} -> {content}")
            return
        cf("PUT", f"/zones/{zone_id}/dns_records/{match['id']}", body)
        print(f"  DNS updated {rtype} {name} -> {content}")
        return
    cf("POST", f"/zones/{zone_id}/dns_records", body)
    print(f"  DNS created {rtype} {name} -> {content}")


def delete_parking_a_records(zone_id: str, zone_name: str) -> None:
    parking = {"207.207.210.107", "207.207.210.229", "37.9.175.164"}
    for rec in list_dns(zone_id):
        if rec.get("type") in {"A", "AAAA", "CNAME"} and rec.get("content") in parking:
            print(f"  deleting parking {rec.get('type')} {rec.get('name')} {rec.get('content')}")
            cf("DELETE", f"/zones/{zone_id}/dns_records/{rec['id']}")


def ensure_web_and_mail_dns(zone: dict[str, Any]) -> None:
    zone_id = zone["id"]
    name = zone["name"]
    delete_parking_a_records(zone_id, name)
    upsert_dns(zone_id, rtype="A", name=name, content=DUMMY_ORIGIN, proxied=True)
    upsert_dns(zone_id, rtype="CNAME", name=f"www.{name}", content=name, proxied=True)
    if name == "gofixweb.cz":
        for row in CZ_MAIL:
            rec_name = name if row["name"] == "@" else f"{row['name']}.{name}"
            upsert_dns(
                zone_id,
                rtype=row["type"],
                name=rec_name,
                content=row["content"],
                proxied=False if row["type"] != "TXT" else None,
                priority=row.get("priority"),
            )


def ensure_https_settings(zone_id: str, name: str) -> None:
    for setting, value in (
        ("always_use_https", "on"),
        ("ssl", "flexible"),
        ("min_tls_version", "1.2"),
    ):
        status, payload = cf_try(
            "PATCH",
            f"/zones/{zone_id}/settings/{setting}",
            {"value": value},
        )
        if status >= 400 or not payload.get("success", True):
            print(f"[{name}] setting {setting} skipped: {payload.get('errors') or status}")
        else:
            print(f"[{name}] setting {setting}={value}")


def ensure_redirect_rule(zone_id: str, name: str) -> None:
    status, payload = cf_try(
        "GET",
        f"/zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint",
    )
    if status == 404 or not payload.get("success"):
        print(f"[{name}] creating dynamic redirect ruleset")
        cf(
            "POST",
            f"/zones/{zone_id}/rulesets",
            {
                "name": "GoFixWeb alias 301",
                "kind": "zone",
                "phase": "http_request_dynamic_redirect",
                "rules": [REDIRECT_RULE],
            },
        )
        print(f"[{name}] redirect rule created")
        return
    ruleset = payload["result"]
    ruleset_id = ruleset["id"]
    rules = list(ruleset.get("rules") or [])
    already = any(
        r.get("ref") == REDIRECT_RULE["ref"]
        or (
            r.get("action") == "redirect"
            and (r.get("action_parameters") or {})
            .get("from_value", {})
            .get("status_code")
            == 301
        )
        for r in rules
    )
    if already:
        # Replace with our canonical rule set so path preservation stays correct.
        pass
    cf(
        "PUT",
        f"/zones/{zone_id}/rulesets/{ruleset_id}",
        {
            "name": ruleset.get("name") or "GoFixWeb alias 301",
            "kind": "zone",
            "phase": "http_request_dynamic_redirect",
            "rules": [REDIRECT_RULE],
        },
    )
    print(f"[{name}] redirect rule upserted (301 + path)")


def porkbun_update_ns(domain: str, nameservers: list[str]) -> None:
    key = (os.environ.get("PORKBUN_API_KEY") or "").strip()
    secret = (os.environ.get("PORKBUN_SECRET_API_KEY") or "").strip()
    if not key or not secret:
        print(f"[{domain}] Porkbun API keys not set — skip NS update")
        print(f"[{domain}] set these NS at the registrar: {', '.join(nameservers)}")
        return
    status, payload = http_json(
        "POST",
        f"{PORKBUN_API}/domain/updateNs/{domain}",
        body={"apikey": key, "secretapikey": secret, "ns": nameservers},
    )
    if status >= 400 or payload.get("status") == "ERROR":
        die(f"Porkbun updateNs {domain}: {payload}")
    print(f"[{domain}] Porkbun nameservers updated to {nameservers}")


def ssl_status(zone_id: str) -> str:
    status, payload = cf_try("GET", f"/zones/{zone_id}/ssl/certificate_packs?status=all")
    if status >= 400 or not payload.get("success"):
        return f"unavailable ({status})"
    packs = payload.get("result") or []
    if not packs:
        return "none"
    states = sorted({p.get("status") or "?" for p in packs})
    return ",".join(states)


def main() -> None:
    if PRIMARY in DOMAINS:
        die("refusing to treat gofixweb.com as an alias")
    print("Verifying Cloudflare token")
    status, verify = cf_try("GET", "/user/tokens/verify")
    print(json.dumps({"http": status, "verify": verify.get("result") or verify}, indent=2))
    if status >= 400 or not verify.get("success"):
        die("Cloudflare token verify failed — token may lack even User.Tokens.Read")

    acc = account_id()
    print(f"Account {acc}")

    zones: dict[str, dict[str, Any]] = {}
    for name in DOMAINS:
        if name == PRIMARY:
            die("refusing to modify gofixweb.com")
        zone = ensure_zone(name, acc)
        zones[name] = zone
        ensure_web_and_mail_dns(zone)
        ensure_https_settings(zone["id"], name)
        ensure_redirect_rule(zone["id"], name)
        ns = zone.get("name_servers") or []
        print(f"[{name}] Cloudflare NS: {ns}")
        print(f"[{name}] SSL pack status: {ssl_status(zone['id'])}")
        # .cz registrar is Websupport, not Porkbun.
        if name.endswith(".cz"):
            print(f"[{name}] Websupport registrar — NS must be changed there, not Porkbun")
            print(f"[{name}] target NS: {', '.join(ns)}")
        else:
            porkbun_update_ns(name, list(ns))

    print("\n=== SUMMARY ===")
    for name, zone in zones.items():
        print(
            f"{name}: zone={zone['id']} status={zone.get('status')} "
            f"ns={zone.get('name_servers')} ssl={ssl_status(zone['id'])}"
        )


if __name__ == "__main__":
    main()
