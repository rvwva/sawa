"""
Perceived Stress Scale — 10-item version (PSS-10) — Scoring Module
===================================================================
Reference: Cohen, S., Kamarck, T., & Mermelstein, R. (1983). A global measure
of perceived stress. Journal of Health and Social Behavior, 24, 385-396.

Items:
  Negative (scored as-is): 1, 2, 3, 6, 9, 10
  Positive (reverse scored): 4, 5, 7, 8

Response scale (caller passes raw 0–4 integer):
  0 = Never
  1 = Almost Never
  2 = Sometimes
  3 = Fairly Often
  4 = Very Often

Total score: sum of all 10 items (after reversing positives), range 0–40.

Interpretation bands:
  0–13   → Low stress
  14–26  → Moderate stress
  27–40  → High stress
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List

NEGATIVE_ITEMS = {f"pss_{i}" for i in [1, 2, 3, 6, 9, 10]}
POSITIVE_ITEMS = {f"pss_{i}" for i in [4, 5, 7, 8]}   # reverse-scored
ALL_ITEMS      = [f"pss_{i}" for i in range(1, 11)]

VALID_VALUES = {0, 1, 2, 3, 4}

BANDS = [
    (0,  13, "Low"),
    (14, 26, "Moderate"),
    (27, 40, "High"),
]


@dataclass
class PSSResult:
    total_score: int
    band: str

    def to_dict(self) -> dict:
        return {
            "total": {
                "score": self.total_score,
                "band": self.band,
            }
        }


def _get_band(score: int) -> str:
    for low, high, label in BANDS:
        if low <= score <= high:
            return label
    return "High"


def _reverse(value: int) -> int:
    """Reverse 0–4 Likert value: 0↔4, 1↔3, 2↔2."""
    return 4 - value


def validate_responses(responses: Dict[str, int]) -> List[str]:
    errors: List[str] = []
    missing = [k for k in ALL_ITEMS if k not in responses]
    if missing:
        errors.append(f"Missing items: {missing}")
    for key, val in responses.items():
        if key in NEGATIVE_ITEMS | POSITIVE_ITEMS:
            if val not in VALID_VALUES:
                errors.append(f"Item {key} has invalid value {val}. Must be 0–4.")
    return errors


def score(responses: Dict[str, int]) -> PSSResult:
    """
    Compute PSS-10 total score.

    Parameters
    ----------
    responses : dict
        Mapping of item key → integer value (0–4).
        e.g. {"pss_1": 2, "pss_2": 3, "pss_4": 1, …}

    Returns
    -------
    PSSResult with total score and interpretation band.
    """
    errors = validate_responses(responses)
    if errors:
        raise ValueError(f"PSS validation failed: {errors}")

    total = 0
    for key in ALL_ITEMS:
        val = responses[key]
        total += _reverse(val) if key in POSITIVE_ITEMS else val

    return PSSResult(total_score=total, band=_get_band(total))
