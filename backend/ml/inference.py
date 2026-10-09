"""Load the trained proficiency model and turn assessment responses into an estimate."""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Sequence

import joblib
import numpy as np
import pandas as pd

from .evaluate import mastery_from_proba
from .features import FEATURE_NAMES, ResponseRecord, extract_features

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "proficiency_model.joblib"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"


class ModelNotTrainedError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProficiencyEstimate:
    level: str
    probabilities: dict[str, float]
    mastery_score: float
    confidence: float
    features: dict[str, float | None]
    model_version: str


class ProficiencyModel:
    def __init__(self, bundle: dict):
        self.pipeline = bundle["pipeline"]
        self.classes: list[str] = list(bundle["classes"])
        self.version: str = bundle["version"]
        self.model_name: str = bundle["model_name"]
        if list(bundle["feature_names"]) != list(FEATURE_NAMES):
            raise ModelNotTrainedError("Model was trained with a different feature set; re-run `python -m ml.train`.")

    @classmethod
    def load(cls, path: Path = MODEL_PATH) -> "ProficiencyModel":
        if not path.exists():
            raise ModelNotTrainedError(f"No trained model at {path}. Run `python -m ml.train` first.")
        return cls(joblib.load(path))

    def predict(self, responses: Sequence[ResponseRecord], prereq_accuracies: Sequence[float],
                n_prerequisites: int, topic_depth: int) -> ProficiencyEstimate:
        feats = extract_features(responses, prereq_accuracies, n_prerequisites, topic_depth)
        X = pd.DataFrame([feats], columns=list(FEATURE_NAMES))
        proba = self.pipeline.predict_proba(X)
        p = proba[0]
        level = self.classes[int(np.argmax(p))]
        return ProficiencyEstimate(
            level=level,
            probabilities={c: round(float(v), 4) for c, v in zip(self.classes, p)},
            mastery_score=round(float(mastery_from_proba(proba, self.classes)[0]), 4),
            confidence=round(float(p.max()), 4),
            features={k: (None if isinstance(v, float) and np.isnan(v) else round(float(v), 4)) for k, v in feats.items()},
            model_version=self.version,
        )


@lru_cache(maxsize=1)
def get_model() -> ProficiencyModel:
    return ProficiencyModel.load()


def load_metrics() -> dict:
    if not METRICS_PATH.exists():
        raise ModelNotTrainedError("metrics.json not found. Run `python -m ml.train` first.")
    return json.loads(METRICS_PATH.read_text())
