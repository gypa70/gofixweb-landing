#!/usr/bin/env python3
"""Vytvoří (nebo najde) Stripe Price 1 990 Kč pro Manuál i Auto. Staré ceny nemaže."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

CURRENCY = "czk"
AMOUNT = 199000
TAX_CODE = "txcd_10000000"
PRICES = (
    {
        "lookup_key": "gofixweb_manual_fix_1990",
        "product_key": "gofixweb_manual_fix",
        "name": "Manuální oprava e-shopu",
        "description": (
            "Přesný návod k opravě nálezů — zásahy provedete sami ve své administraci "
            "(jednorázová platba)."
        ),
        "metadata_product": "manual_fix",
    },
    {
        "lookup_key": "gofixweb_wp_autofix_1990",
        "product_key": "gofixweb_wp_autofix",
        "name": "Automatická oprava e-shopu",
        "description": (
            "Automatické zapsání SEO a rychlostních oprav přímo do vašeho WordPress webu "
            "(jednorázový zásah)"
        ),
        "metadata_product": "wp_autofix",
    },
)


def _request(secret: str, path: str, data: dict | None = None, method: str = "GET") -> dict:
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data, doseq=True).encode("utf-8")
        method = "POST"
    req = urllib.request.Request(
        f"https://api.stripe.com/v1/{path.lstrip('/')}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {secret}",
            "Stripe-Version": "2024-06-20",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"stripe {path} {exc.code}: {detail}") from exc


def _find_price(secret: str, lookup_key: str) -> dict | None:
    payload = _request(secret, f"prices?lookup_keys[]={urllib.parse.quote(lookup_key)}&limit=1")
    data = payload.get("data") or []
    return data[0] if data else None


def _find_product(secret: str, metadata_product: str) -> dict | None:
    payload = _request(secret, "products?limit=100&active=true")
    for item in payload.get("data") or []:
        meta = item.get("metadata") or {}
        if str(meta.get("gofixweb_product") or "") == metadata_product:
            return item
        if str(item.get("name") or "") in {
            "Manuální oprava e-shopu",
            "Automatická oprava e-shopu",
        } and metadata_product in str(meta.get("gofixweb_product") or item.get("name") or ""):
            return item
    for item in payload.get("data") or []:
        name = str(item.get("name") or "")
        if metadata_product == "manual_fix" and name == "Manuální oprava e-shopu":
            return item
        if metadata_product == "wp_autofix" and name == "Automatická oprava e-shopu":
            return item
    return None


def ensure_price(secret: str, spec: dict) -> dict:
    existing = _find_price(secret, spec["lookup_key"])
    if existing:
        return existing
    product = _find_product(secret, spec["metadata_product"])
    if not product:
        product = _request(
            secret,
            "products",
            {
                "name": spec["name"],
                "description": spec["description"],
                "metadata[gofixweb_product]": spec["metadata_product"],
                "tax_code": TAX_CODE,
            },
        )
    return _request(
        secret,
        "prices",
        {
            "currency": CURRENCY,
            "unit_amount": str(AMOUNT),
            "product": product["id"],
            "lookup_key": spec["lookup_key"],
            "tax_behavior": "inclusive",
            "metadata[gofixweb_product]": spec["metadata_product"],
        },
    )


def main() -> int:
    secret = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not secret:
        print("missing STRIPE_SECRET_KEY", file=sys.stderr)
        return 2
    out = {}
    for spec in PRICES:
        price = ensure_price(secret, spec)
        out[spec["metadata_product"]] = {
            "price_id": price["id"],
            "product_id": price.get("product"),
            "unit_amount": price.get("unit_amount"),
            "lookup_key": spec["lookup_key"],
            "livemode": price.get("livemode"),
        }
        print(
            f"{spec['metadata_product']} price={price['id']} "
            f"amount={price.get('unit_amount')} livemode={price.get('livemode')}",
            flush=True,
        )
    github_out = os.environ.get("GITHUB_OUTPUT")
    if github_out:
        with open(github_out, "a", encoding="utf-8") as handle:
            handle.write(f"manual_price_id={out['manual_fix']['price_id']}\n")
            handle.write(f"auto_price_id={out['wp_autofix']['price_id']}\n")
    print(json.dumps(out, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
