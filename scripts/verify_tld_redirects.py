#!/usr/bin/env python3
"""Probe alias TLDs for valid HTTPS and path-preserving 301 to gofixweb.com."""

from __future__ import annotations

import os
import socket
import ssl
import sys
import urllib.error
import urllib.request

PRIMARY = "gofixweb.com"
DOMAINS = ("gofixweb.cz", "gofixweb.eu", "gofixweb.de", "gofixweb.ai")
PARKING_IPS = {"207.207.210.107", "207.207.210.229"}
PATHS = ("/", "/blog", "/blog/")


def resolve_a(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        return [f"dns_error:{exc}"]
    ips = sorted({item[4][0] for item in infos})
    return ips


def tls_ok(host: str) -> tuple[bool, str]:
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((host, 443), timeout=20) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                sans = [n for t, n in cert.get("subjectAltName") or [] if t == "DNS"]
                issuer = dict(x[0] for x in cert.get("issuer", []))
                return True, f"issuer={issuer.get('organizationName')} san={sans}"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def headers(url: str) -> tuple[int, dict[str, str], str]:
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}, ""
    except urllib.error.HTTPError as exc:
        return exc.code, {k.lower(): v for k, v in exc.headers.items()}, ""
    except Exception as exc:
        return 0, {}, f"{type(exc).__name__}: {exc}"


def expected_location(src_path: str) -> str:
    return f"https://{PRIMARY}{src_path}"


def main() -> int:
    strict = os.environ.get("VERIFY_STRICT", "true").lower() not in {"0", "false", "no"}
    failed = 0
    for domain in DOMAINS:
        for host in (domain, f"www.{domain}"):
            ips = resolve_a(host)
            parking = sorted(set(ips) & PARKING_IPS)
            print(f"\n== {host} ips={ips} parking={parking or '-'} ==")
            if parking:
                print("  WARN still on Porkbun parking IP")
                failed += 1
            ok, detail = tls_ok(host)
            print(f"  TLS {'OK' if ok else 'FAIL'} {detail}")
            if not ok:
                failed += 1
            for path in PATHS:
                url = f"https://{host}{path}"
                status, hdrs, err = headers(url)
                location = hdrs.get("location", "")
                want = expected_location(path)
                path_ok = status == 301 and location.rstrip("/") == want.rstrip("/")
                # Allow trailing-slash normalization on the homepage only.
                if path == "/" and status == 301 and location in {want, f"https://{PRIMARY}", f"https://{PRIMARY}/"}:
                    path_ok = True
                if path != "/" and status == 301 and location.rstrip("/") == f"https://{PRIMARY}{path.rstrip('/')}":
                    path_ok = True
                print(f"  {status} {url} -> {location or err} {'OK' if path_ok else 'FAIL'}")
                if not path_ok:
                    failed += 1
    print(f"\nFailures: {failed}")
    if failed and strict:
        return 1
    return 0 if not failed else 0


if __name__ == "__main__":
    sys.exit(main())
