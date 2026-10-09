"""SYNTHETIC training data: simulated learners answering the real question bank.

PathForge has no historical learner data, so the proficiency model is trained on
responses produced by a documented generative model. Every row produced here is
marked ``is_synthetic = True``. The model therefore learns to invert *this
simulator*; its accuracy on real learners is unknown until real data is collected
(see the Limitations section of the README and the ML Evaluation page).

Generative model (per simulated learner)
  * general ability g ~ N(0, 1); per-domain affinity ~ N(0, 0.6); per-topic noise ~ N(0, 0.6)
  * topic ability θ_t = 0.5·g + affinity[domain] + 0.45·mean(θ of prerequisites) − 0.12·depth + noise
  * ground-truth level: beginner if θ < −0.35, advanced if θ > 0.75, else intermediate
  * items follow a 2-parameter IRT "knowledge" model with a 25% guessing floor
    (4 options) and a 5% slip rate: P(know) = sigmoid(1.7·a·(θ − b))
  * self-reported confidence depends on whether the item was known and on a
    per-learner overconfidence trait; response time shrinks with ability
"""
from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass

import networkx as nx
import numpy as np
import pandas as pd

from .catalog import Catalog, EXPECTED_SECONDS, load_catalog
from .features import ResponseRecord, extract_features
from .item_selection import select_questions
from .roadmap import required_topics

DEFAULT_SEED = 42
LEVELS = ("beginner", "intermediate", "advanced")
BEGINNER_MAX_THETA = -0.35
ADVANCED_MIN_THETA = 0.75
BASE_DIFFICULTY = {"easy": -1.2, "medium": 0.0, "hard": 1.1}
GUESS_RATE = 0.25
SLIP_RATE = 0.05


def theta_to_level(theta: float) -> str:
    if theta < BEGINNER_MAX_THETA:
        return "beginner"
    if theta > ADVANCED_MIN_THETA:
        return "advanced"
    return "intermediate"


@dataclass(frozen=True)
class ItemParams:
    a: float  # discrimination
    b: float  # difficulty


def item_params(catalog: Catalog) -> dict[str, ItemParams]:
    """Fixed per-question parameters derived deterministically from the question id."""
    params = {}
    for q in catalog.questions.values():
        r = random.Random(int(hashlib.sha256(q.id.encode()).hexdigest(), 16))
        params[q.id] = ItemParams(a=1.2 + r.uniform(-0.3, 0.3), b=BASE_DIFFICULTY[q.difficulty] + r.gauss(0, 0.25))
    return params


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def simulate_learners(n_learners: int = 2500, seed: int = DEFAULT_SEED, catalog: Catalog | None = None) -> pd.DataFrame:
    catalog = catalog or load_catalog()
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    params = item_params(catalog)
    topo = list(nx.topological_sort(catalog.graph))
    domains = sorted({t.domain for t in catalog.topics.values()})
    careers = sorted(catalog.careers)
    rows: list[dict] = []

    for learner in range(n_learners):
        g = np_rng.normal(0, 1)
        affinity = {d: np_rng.normal(0, 0.6) for d in domains}
        overconfidence = np_rng.normal(0, 0.5)
        speed = np_rng.normal(0, 0.2)

        theta: dict[str, float] = {}
        for tid in topo:
            topic = catalog.topics[tid]
            prereq_mean = np.mean([theta[p] for p in topic.prerequisites]) if topic.prerequisites else 0.0
            theta[tid] = (0.5 * g + affinity[topic.domain] + 0.45 * prereq_mean
                          - 0.12 * catalog.depth(tid) + np_rng.normal(0, 0.6))

        career = rng.choice(careers)
        pool = [t for t in topo if t in required_topics(catalog, career)]
        k = rng.randint(min(3, len(pool)), len(pool))
        sampled = set(rng.sample(pool, k))
        attempted = [t for t in pool if t in sampled]  # keep prerequisite (topological) order

        latest_accuracy: dict[str, float] = {}
        for tid in attempted:
            topic = catalog.topics[tid]
            mix_level = rng.choice([None, "intermediate"])  # mirror first attempts and retakes
            items = select_questions(catalog.questions_for(tid), mix_level, rng=rng)
            responses = []
            for q in items:
                p = params[q.id]
                knows = rng.random() < _sigmoid(1.7 * p.a * (theta[tid] - p.b))
                correct = (rng.random() > SLIP_RATE) if knows else (rng.random() < GUESS_RATE)
                u = rng.random()
                if knows:
                    p_sure = min(max(0.7 + 0.1 * overconfidence, 0.3), 0.95)
                    confidence = 3 if u < p_sure else (2 if u < p_sure + 0.25 else 1)
                else:
                    p_guess = min(max(0.5 - 0.15 * overconfidence, 0.1), 0.85)
                    p_sure = min(max(0.15 + 0.1 * overconfidence, 0.02), 0.5)
                    confidence = 1 if u < p_guess else (3 if u < p_guess + p_sure else 2)
                log_t = (math.log(EXPECTED_SECONDS[q.difficulty]) + 0.25 * (p.b - theta[tid])
                         - 0.15 * knows + speed + np_rng.normal(0, 0.35))
                time_ms = int(min(max(math.exp(log_t), 3.0), 300.0) * 1000)
                responses.append(ResponseRecord(q.difficulty, correct, confidence, time_ms))

            prereq_acc = [latest_accuracy[p] for p in topic.prerequisites if p in latest_accuracy]
            feats = extract_features(responses, prereq_acc, len(topic.prerequisites), catalog.depth(tid))
            latest_accuracy[tid] = feats["accuracy"]
            rows.append({
                "learner_id": learner,
                "topic_id": tid,
                "career_id": career,
                **feats,
                "true_theta": theta[tid],
                "level": theta_to_level(theta[tid]),
                "is_synthetic": True,
            })

    return pd.DataFrame(rows)
