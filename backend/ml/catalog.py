"""Curated learning catalog: careers, topics, prerequisite graph, resources and questions.

The JSON files in ``ml/catalog_data/`` are the single source of truth. They feed:
  * the ML pipeline (synthetic data generation, features, roadmap, recommender), and
  * ``scripts/generate_seed.py``, which writes ``supabase/seed.sql``.

Loading validates referential integrity so a bad edit fails loudly instead of
silently producing a broken roadmap.
"""
from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import networkx as nx

CATALOG_DIR = Path(__file__).resolve().parent / "catalog_data"

DIFFICULTIES = ("easy", "medium", "hard")
RESOURCE_LEVELS = ("beginner", "intermediate", "advanced")
RESOURCE_FORMATS = ("video", "article", "course", "interactive", "book", "documentation")
# free: no payment needed; freemium: free to start or audit, payment for full access or a certificate.
RESOURCE_COSTS = ("free", "freemium", "paid")
# Expected time budget per question; used to normalise response times into features.
EXPECTED_SECONDS = {"easy": 30, "medium": 45, "hard": 60}


@dataclass(frozen=True)
class Topic:
    id: str
    name: str
    domain: str
    description: str
    est_hours: int
    prerequisites: tuple[str, ...]


@dataclass(frozen=True)
class Career:
    id: str
    title: str
    icon: str
    description: str
    topics: dict[str, int]  # topic_id -> importance weight (1-3)


@dataclass(frozen=True)
class Resource:
    id: str
    topic: str
    title: str
    provider: str
    url: str
    format: str
    difficulty: str
    minutes: int
    description: str
    tags: tuple[str, ...]
    cost: str = "free"
    instructor: str | None = None


@dataclass(frozen=True)
class Question:
    id: str
    topic: str
    difficulty: str
    prompt: str
    options: tuple[str, ...]
    correct_index: int
    explanation: str

    @property
    def expected_seconds(self) -> int:
        return EXPECTED_SECONDS[self.difficulty]


@dataclass(frozen=True)
class Catalog:
    topics: dict[str, Topic]
    careers: dict[str, Career]
    resources: dict[str, Resource]
    questions: dict[str, Question]
    graph: nx.DiGraph = field(compare=False)

    def questions_for(self, topic_id: str) -> list[Question]:
        return [q for q in self.questions.values() if q.topic == topic_id]

    def resources_for(self, topic_id: str) -> list[Resource]:
        return [r for r in self.resources.values() if r.topic == topic_id]

    def depth(self, topic_id: str) -> int:
        """Length of the longest prerequisite chain leading to a topic."""
        return _depths(self)[topic_id]

    @property
    def fingerprint(self) -> str:
        """Stable hash of the catalog content, recorded with trained models."""
        h = hashlib.sha256()
        for name in ("topics", "careers", "resources", "questions"):
            h.update((CATALOG_DIR / f"{name}.json").read_bytes())
        return h.hexdigest()[:12]


def _shuffled_options(qid: str, correct: str, distractors: list[str]) -> tuple[tuple[str, ...], int]:
    """Deterministically shuffle options so the answer position is stable but not always first."""
    options = [correct, *distractors]
    rng = random.Random(int(hashlib.md5(qid.encode()).hexdigest(), 16))
    rng.shuffle(options)
    return tuple(options), options.index(correct)


def _read(name: str):
    with open(CATALOG_DIR / f"{name}.json", encoding="utf-8") as fh:
        return json.load(fh)


class CatalogError(ValueError):
    pass


@lru_cache(maxsize=1)
def load_catalog() -> Catalog:
    topics = {t["id"]: Topic(t["id"], t["name"], t["domain"], t["description"], int(t["est_hours"]), tuple(t["prerequisites"]))
              for t in _read("topics")}
    careers = {c["id"]: Career(c["id"], c["title"], c["icon"], c["description"], dict(c["topics"])) for c in _read("careers")}
    resources = {r["id"]: Resource(r["id"], r["topic"], r["title"], r["provider"], r["url"], r["format"], r["difficulty"],
                                   int(r["minutes"]), r["description"], tuple(r["tags"]), r.get("cost", "free"),
                                   r.get("instructor")) for r in _read("resources")}
    questions = {}
    for q in _read("questions"):
        options, idx = _shuffled_options(q["id"], q["correct"], q["distractors"])
        questions[q["id"]] = Question(q["id"], q["topic"], q["difficulty"], q["prompt"], options, idx, q["explanation"])

    graph = nx.DiGraph()
    graph.add_nodes_from(topics)
    for t in topics.values():
        for p in t.prerequisites:
            graph.add_edge(p, t.id)  # edge direction: prerequisite -> dependent

    catalog = Catalog(topics, careers, resources, questions, graph)
    validate(catalog)
    return catalog


def validate(c: Catalog) -> None:
    errors: list[str] = []
    for t in c.topics.values():
        errors += [f"topic {t.id}: unknown prerequisite {p}" for p in t.prerequisites if p not in c.topics]
    if not nx.is_directed_acyclic_graph(c.graph):
        errors.append(f"prerequisite cycle: {nx.find_cycle(c.graph)}")
    for car in c.careers.values():
        errors += [f"career {car.id}: unknown topic {t}" for t in car.topics if t not in c.topics]
        errors += [f"career {car.id}: weight for {t} must be 1-3" for t, w in car.topics.items() if w not in (1, 2, 3)]
    for r in c.resources.values():
        if r.topic not in c.topics:
            errors.append(f"resource {r.id}: unknown topic {r.topic}")
        if r.format not in RESOURCE_FORMATS:
            errors.append(f"resource {r.id}: bad format {r.format}")
        if r.difficulty not in RESOURCE_LEVELS:
            errors.append(f"resource {r.id}: bad difficulty {r.difficulty}")
        if r.cost not in RESOURCE_COSTS:
            errors.append(f"resource {r.id}: bad cost {r.cost}")
        if not r.url.startswith("https://"):
            errors.append(f"resource {r.id}: url must be https")
    for q in c.questions.values():
        if q.topic not in c.topics:
            errors.append(f"question {q.id}: unknown topic {q.topic}")
        if q.difficulty not in DIFFICULTIES:
            errors.append(f"question {q.id}: bad difficulty")
        if len(q.options) != 4 or len(set(q.options)) != 4:
            errors.append(f"question {q.id}: needs 4 distinct options")
    for tid in c.topics:
        qs = c.questions_for(tid)
        if {q.difficulty for q in qs} != set(DIFFICULTIES):
            errors.append(f"topic {tid}: questions must cover easy/medium/hard")
        if len(c.resources_for(tid)) < 3:
            errors.append(f"topic {tid}: needs at least 3 resources")
    if errors:
        raise CatalogError("Catalog validation failed:\n  " + "\n  ".join(errors))


_DEPTHS: dict[str, int] | None = None


def _depths(c: Catalog) -> dict[str, int]:
    global _DEPTHS
    if _DEPTHS is None:
        depths: dict[str, int] = {}
        for node in nx.topological_sort(c.graph):
            preds = list(c.graph.predecessors(node))
            depths[node] = 0 if not preds else 1 + max(depths[p] for p in preds)
        _DEPTHS = depths
    return _DEPTHS
