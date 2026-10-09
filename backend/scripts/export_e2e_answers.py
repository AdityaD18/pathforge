"""Write e2e/.answers.json (prompt -> correct option) for the browser test. Gitignored: it's the answer key."""
import json
from pathlib import Path

from ml.catalog import load_catalog

OUT = Path(__file__).resolve().parents[2] / "e2e" / ".answers.json"
strip = lambda s: s.replace("`", "")  # noqa: E731  (rendered prompts show code without backticks)
c = load_catalog()
OUT.write_text(json.dumps({strip(q.prompt): strip(q.options[q.correct_index]) for q in c.questions.values()}))
print(f"Wrote {OUT} ({len(c.questions)} questions)")
