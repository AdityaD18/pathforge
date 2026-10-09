"""Check that every resource URL in the catalog still resolves.

    python -m scripts.check_links            # from backend/; exits 1 if any link is dead

Course sites often block automated requests (403/429), so those are reported as "blocked" rather than
dead. Only 404/410 responses and DNS/connection failures count as broken. Run weekly by
.github/workflows/links.yml; the summary is written to $GITHUB_STEP_SUMMARY when present.
"""
from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from ml.catalog import load_catalog

UA = "Mozilla/5.0 (compatible; PathForgeLinkCheck/1.0; +https://github.com/AdityaD18/pathforge)"
DEAD = {404, 410}


def check(url: str) -> tuple[str, int | None, str]:
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return "ok", r.status, r.geturl()
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 429, 501):
                continue  # some servers reject HEAD; retry with GET
            return ("dead" if e.code in DEAD else "blocked" if e.code in (401, 403, 429, 999) else "error"), e.code, url
        except Exception as e:  # noqa: BLE001 - DNS, TLS and timeouts all mean "unreachable"
            return "error", None, str(e)[:120]
    return "blocked", None, url


def main() -> int:
    c = load_catalog()
    resources = sorted(c.resources.values(), key=lambda r: r.id)
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(lambda r: (r, *check(r.url)), resources))

    counts: dict[str, int] = {}
    for _, state, _, _ in results:
        counts[state] = counts.get(state, 0) + 1
    lines = [f"# Resource link check: {len(results)} links",
             ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())), ""]
    problems = [x for x in results if x[1] != "ok"]
    if problems:
        lines += ["| Status | Code | Resource | URL |", "|---|---|---|---|"]
        lines += [f"| {s} | {code or '—'} | `{r.id}` {r.title} | {r.url} |" for r, s, code, _ in sorted(problems, key=lambda x: x[1])]
    report = "\n".join(lines)
    print(report)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(report + "\n")
    return 1 if counts.get("dead") or counts.get("error", 0) > 3 else 0


if __name__ == "__main__":
    sys.exit(main())
