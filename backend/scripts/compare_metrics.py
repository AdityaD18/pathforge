"""Check that freshly trained metrics match the committed ones (used in CI).

Training is seeded, but parallel tree fitting can change float summation order, so numbers
are compared with a tight relative tolerance instead of exact equality.

    python -m scripts.compare_metrics [git-ref]   (default ref: HEAD)
"""
import json
import math
import subprocess
import sys

SKIP = {"generated_at", "environment"}


def compare(a, b, path="") -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        out = [f"{path}.{k}: missing" for k in set(a) ^ set(b) if k not in SKIP]
        for k in set(a) & set(b) - SKIP:
            out += compare(a[k], b[k], f"{path}.{k}")
        return out
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [f"{path}: length {len(a)} != {len(b)}"]
        return [m for i, (x, y) in enumerate(zip(a, b)) for m in compare(x, y, f"{path}[{i}]")]
    if isinstance(a, float) or isinstance(b, float):
        return [] if a is not None and b is not None and math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12) else [f"{path}: {a} != {b}"]
    return [] if a == b else [f"{path}: {a!r} != {b!r}"]


def main() -> int:
    ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    new = json.load(open("ml/artifacts/metrics.json"))
    old = json.loads(subprocess.check_output(["git", "show", f"{ref}:backend/ml/artifacts/metrics.json"]))
    problems = compare(new, old)
    if problems:
        print("Retraining changed the evaluation results; commit the new artifacts:\n  " + "\n  ".join(problems[:20]))
        return 1
    print("Metrics reproduced within tolerance.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
