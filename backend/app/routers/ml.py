from __future__ import annotations

from fastapi import APIRouter

from ml.features import FEATURE_DESCRIPTIONS
from ml.inference import get_model, load_metrics
from ml.ranking import WEIGHTS
from ml.roadmap import MASTERED_THRESHOLD, NEAR_MASTERY

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.get("/metrics")
def metrics():
    """Evaluation results written by `python -m ml.train` — served verbatim, never edited by hand."""
    m = load_metrics()
    model = get_model()
    m["features"] = [{"name": f["name"], "description": FEATURE_DESCRIPTIONS[f["name"]]} for f in m["features"]]
    m["serving"] = {"model_version": model.version, "model_name": model.model_name, "classes": model.classes,
                    "matches_metrics": model.version == m.get("model_version")}
    m["policy"] = {"mastered_threshold": MASTERED_THRESHOLD, "developing_threshold": NEAR_MASTERY,
                   "ranking_weights": WEIGHTS,
                   "mastery_score_formula": "P(intermediate) × 0.5 + P(advanced) × 1.0"}
    return m
