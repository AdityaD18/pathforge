"""Feature extraction for topic-proficiency estimation.

This module is the ONLY place features are computed. Both the training pipeline
(on simulated responses) and the live API (on real learner responses) call
``extract_features`` so there is no training/serving skew.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np

from .catalog import EXPECTED_SECONDS

DIFFICULTY_WEIGHT = {"easy": 1.0, "medium": 2.0, "hard": 3.0}
# Answers faster than this can't reflect reading the question; they are treated as rapid guesses.
RAPID_GUESS_MS = 3000
# Bound log(time / expected) so out-of-range timings can't be extrapolated by the model (≈0.22× to 4.5×).
LOG_TIME_RATIO_BOUND = 1.5

FEATURE_NAMES: tuple[str, ...] = (
    "n_items",
    "accuracy",
    "weighted_score",
    "acc_easy",
    "acc_medium",
    "acc_hard",
    "mean_log_time_ratio",
    "log_time_ratio_correct",
    "mean_confidence",
    "sure_correct_rate",
    "sure_wrong_rate",
    "guess_correct_rate",
    "rapid_guess_rate",
    "prereq_mean_accuracy",
    "prereq_coverage",
    "topic_depth",
)

FEATURE_DESCRIPTIONS: dict[str, str] = {
    "n_items": "Number of questions answered",
    "accuracy": "Share of questions answered correctly",
    "weighted_score": "Accuracy weighted by difficulty (easy 1, medium 2, hard 3)",
    "acc_easy": "Accuracy on easy questions",
    "acc_medium": "Accuracy on medium questions",
    "acc_hard": "Accuracy on hard questions",
    "mean_log_time_ratio": "Mean log of (response time ÷ expected time), excluding rapid guesses",
    "log_time_ratio_correct": "Mean log time ratio on correct answers, excluding rapid guesses",
    "mean_confidence": "Mean self-reported confidence, scaled 0–1",
    "sure_correct_rate": "Share answered 'sure' and correct",
    "sure_wrong_rate": "Share answered 'sure' but wrong (overconfidence)",
    "guess_correct_rate": "Share marked 'guess' that were correct (lucky guesses)",
    "rapid_guess_rate": "Share answered in under 3 seconds (too fast to have read the question)",
    "prereq_mean_accuracy": "Mean accuracy on the latest attempts of prerequisite topics",
    "prereq_coverage": "Share of prerequisite topics already assessed",
    "topic_depth": "Longest prerequisite chain leading to this topic",
}


@dataclass(frozen=True)
class ResponseRecord:
    difficulty: str          # easy | medium | hard
    is_correct: bool
    confidence: int          # 1 = guess, 2 = unsure, 3 = sure
    time_ms: int


def _mean(values: Iterable[float]) -> float:
    values = list(values)
    return float(np.mean(values)) if values else math.nan


def extract_features(
    responses: Sequence[ResponseRecord],
    prereq_accuracies: Sequence[float],
    n_prerequisites: int,
    topic_depth: int,
) -> dict[str, float]:
    """Compute the model's feature vector for one topic attempt.

    Missing values (e.g. no hard questions answered, no prerequisites assessed)
    are returned as NaN and imputed inside the trained pipeline.
    """
    if not responses:
        raise ValueError("At least one response is required")
    for r in responses:
        if r.difficulty not in DIFFICULTY_WEIGHT:
            raise ValueError(f"Unknown difficulty {r.difficulty!r}")
        if r.confidence not in (1, 2, 3):
            raise ValueError("confidence must be 1, 2 or 3")

    n = len(responses)
    correct = [1.0 if r.is_correct else 0.0 for r in responses]
    weights = [DIFFICULTY_WEIGHT[r.difficulty] for r in responses]
    # Time features use only answers given slowly enough to have read the question, and are bounded
    # so a stalled tab or an unusually fast reader can't push the model outside its training range.
    def log_ratio(r: ResponseRecord) -> float:
        raw = math.log(max(r.time_ms, 1) / 1000.0 / EXPECTED_SECONDS[r.difficulty])
        return max(-LOG_TIME_RATIO_BOUND, min(LOG_TIME_RATIO_BOUND, raw))

    considered = [(log_ratio(r), r.is_correct) for r in responses if r.time_ms >= RAPID_GUESS_MS]

    def acc_for(level: str) -> float:
        return _mean(c for c, r in zip(correct, responses) if r.difficulty == level)

    return {
        "n_items": float(n),
        "accuracy": float(np.mean(correct)),
        "weighted_score": float(np.dot(correct, weights) / sum(weights)),
        "acc_easy": acc_for("easy"),
        "acc_medium": acc_for("medium"),
        "acc_hard": acc_for("hard"),
        "mean_log_time_ratio": _mean(lr for lr, _ in considered),
        "log_time_ratio_correct": _mean(lr for lr, ok in considered if ok),
        "mean_confidence": float(np.mean([(r.confidence - 1) / 2 for r in responses])),
        "sure_correct_rate": sum(1 for r in responses if r.confidence == 3 and r.is_correct) / n,
        "sure_wrong_rate": sum(1 for r in responses if r.confidence == 3 and not r.is_correct) / n,
        "guess_correct_rate": sum(1 for r in responses if r.confidence == 1 and r.is_correct) / n,
        "rapid_guess_rate": sum(1 for r in responses if r.time_ms < RAPID_GUESS_MS) / n,
        "prereq_mean_accuracy": _mean(prereq_accuracies),
        "prereq_coverage": (len(prereq_accuracies) / n_prerequisites) if n_prerequisites else 1.0,
        "topic_depth": float(topic_depth),
    }


def to_matrix(rows: Sequence[dict[str, float]]) -> np.ndarray:
    return np.array([[row[name] for name in FEATURE_NAMES] for row in rows], dtype=float)


# ---------------------------------------------------------------------------
# Attempt validity (a rule, applied outside the model)
# ---------------------------------------------------------------------------
MAX_RAPID_GUESSES = 2  # with 5 items: 3+ answers under RAPID_GUESS_MS means the attempt isn't counted


def attempt_validity(responses: Sequence[ResponseRecord]) -> tuple[bool, str | None]:
    """Return (counted, reason). Rapid guesses carry no information about ability, so an
    attempt made mostly of them must not move the learner's mastery estimate either way."""
    rapid = sum(1 for r in responses if r.time_ms < RAPID_GUESS_MS)
    if rapid > MAX_RAPID_GUESSES:
        return False, (f"{rapid} of {len(responses)} answers took under {RAPID_GUESS_MS // 1000} seconds, too fast to "
                       "reflect reading the question, so this attempt doesn't change your mastery estimate.")
    return True, None
