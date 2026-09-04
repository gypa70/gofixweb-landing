#!/usr/bin/env python3
"""Vytvoří (nebo najde) měsíční Stripe Prices Basic/Pro/Premium v CZK.

Vytvoří (nebo najde) měsíční Stripe Prices. Lookup keys:
  gofixweb_basic_1490_month
  gofixweb_pro_3990_month
  gofixweb_premium_6990_month
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

CURRENCY = "czk"
TAX_CODE = "txcd_10000000"
PRICES = (
    {
        "lookup_key": "gofixweb_basic_1490_month",
        "product_key": "gofixweb_basic",
        "name": "GoFixWeb Basic",
        "description": "Měsíční sken, 1 oprava, 1 sloučený e-mail s nálezy i opravami.",
        "metadata_product": "basic",
        "amount": 149000,
    },
    {
        "lookup_key": "gofixweb_pro_3990_month",
        "product_key": "gofixweb_pro",
        "name": "GoFixWeb Pro",
        "description": "Týdenní sken, až 4 opravy měsíčně, 1 sloučený e-mail týdně.",
        "metadata_product": "pro",
        "amount": 399000,
    },
    {
        "lookup_key": "gofixweb_premium_6990_month",
        "product_key": "gofixweb_premium",
        "name": "GoFixWeb Premium",
        "description": "Denní sken a optimalizace, 1 sloučený e-mail denně.",
        "metadata_product": "premium",
        "amount": 699000,
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
            "unit_amount": str(spec["amount"]),
            "recurring[interval]": "month",
            "product": product["id"],
            "lookup_key": spec["lookup_key"],
            "tax_behavior": "inclusive",
            "metadata[gofixweb_product]": spec["metadata_product"],
        },
    )


def main() -> int:
    secret = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not secret:
        print("Chybí STRIPE_SECRET_KEY", file=sys.stderr)
        return 1
    mode = "test" if secret.startswith("sk_test_") else "live"
    print(f"Stripe mode: {mode}")
    out = {}
    for spec in PRICES:
        price = ensure_price(secret, spec)
        out[spec["metadata_product"]] = price.get("id")
        print(f"{spec['metadata_product']}: {price.get('id')} ({spec['lookup_key']})")
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
