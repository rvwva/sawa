"""
WHO-5 Wellbeing Index — Scoring Module
=======================================
Reference: World Health Organization (1998). Mastering Depression in Primary
Care. WHO Regional Office for Europe.

5 items, each rated 0–5 over the past two weeks:
  5 = All of the time
  4 = Most of the time
  3 = More than half of the time
  2 = Less than half of the time
  1 = Some of the time
  0 = At no time

Raw score = sum of items (0–25)
Percentage score = raw × 4  (0–100)

Interpretation bands:
  0–28   → Low (depression screening recommended)
  29–50  → Below Average
  51–67  → Moderate
  68–100 → Good
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List

ALL_ITEMS = [f"who5_{i}" for i in range(1, 6)]
VALID_VALUES = {0, 1, 2, 3, 4, 5}

BANDS = [
    (0,  28, "Low"),
    (29, 50, "Below Average"),
    (51, 67, "Moderate"),
    (68, 100, "Good"),
]

DEPRESSION_SCREEN_THRESHOLD = 50  # percentage score ≤ 50 → recommend screening


@dataclass
class WHO5Result:
    raw_score: int
    percentage_score: int
    band: str
    depression_screen_recommended: bool

    def to_dict(self) -> dict:
        return {
            "total": {
                "raw_score": self.raw_score,
                "score": self.percentage_score,   # normalised 0–100
                "band": self.band,
                "depression_screen_recommended": self.depression_screen_recommended,
            }
        }


def _get_band(pct: int) -> str:
    for low, high, label in BANDS:
        if low <= pct <= high:
            return label
    return "Good"


def validate_responses(responses: Dict[str, int]) -> List[str]:
    errors: List[str] = []
    missing = [k for k in ALL_ITEMS if k not in responses]
    if missing:
        errors.append(f"Missing items: {missing}")
    for key, val in responses.items():
        if key in set(ALL_ITEMS):
            if val not in VALID_VALUES:
                errors.append(f"Item {key} has invalid value {val}. Must be 0–5.")
    return errors


def score(responses: Dict[str, int]) -> WHO5Result:
    """
    Compute WHO-5 percentage score.

    Parameters
    ----------
    responses : dict
        Mapping of item key → integer value (0–5).
        e.g. {"who5_1": 4, "who5_2": 3, "who5_3": 4, "who5_4": 2, "who5_5": 3}

    Returns
    -------
    WHO5Result with raw score, percentage score, and interpretation band.
    """
    errors = validate_responses(responses)
    if errors:
        raise ValueError(f"WHO-5 validation failed: {errors}")

    raw = sum(responses[k] for k in ALL_ITEMS)
    pct = raw * 4

    return WHO5Result(
        raw_score=raw,
        percentage_score=pct,
        band=_get_band(pct),
        depression_screen_recommended=(pct <= DEPRESSION_SCREEN_THRESHOLD),
    )
