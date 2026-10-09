"""Choose which questions a learner sees in a topic assessment.

Shared by the live API and the learner simulator so the simulated training data
follows the same test design the real application uses.
"""
from __future__ import annotations

import random
from typing import Iterable, Sequence

from .catalog import Question

ITEMS_PER_ASSESSMENT = 5

# Difficulty mix by the learner's current estimate for the topic.
# A first attempt is broad; once someone is known to be stronger we probe harder items.
DIFFICULTY_MIX = {
    None: ("easy", "easy", "medium", "medium", "hard"),
    "beginner": ("easy", "easy", "medium", "medium", "hard"),
    "intermediate": ("easy", "medium", "medium", "hard", "hard"),
    "advanced": ("easy", "medium", "medium", "hard", "hard"),
}
_ORDER = {"easy": 0, "medium": 1, "hard": 2}


def select_questions(
    questions: Sequence[Question],
    estimated_level: str | None,
    seen_ids: Iterable[str] = (),
    rng: random.Random | None = None,
) -> list[Question]:
    """Return ITEMS_PER_ASSESSMENT questions ordered easy -> hard.

    Unseen questions are preferred within each difficulty band; if a band runs
    out the remaining slots are filled from the closest band.
    """
    rng = rng or random.Random()
    seen = set(seen_ids)
    mix = DIFFICULTY_MIX.get(estimated_level, DIFFICULTY_MIX[None])
    pools = {d: sorted([q for q in questions if q.difficulty == d], key=lambda q: (q.id in seen, rng.random()))
             for d in _ORDER}

    chosen: list[Question] = []
    for difficulty in mix:
        pool = pools[difficulty]
        if not pool:  # fall back to the nearest non-empty band
            for alt in sorted(_ORDER, key=lambda d: abs(_ORDER[d] - _ORDER[difficulty])):
                if pools[alt]:
                    pool = pools[alt]
                    break
        if pool:
            chosen.append(pool.pop(0))
    return sorted(chosen, key=lambda q: (_ORDER[q.difficulty], q.id))
