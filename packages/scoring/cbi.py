"""
Copenhagen Burnout Inventory (CBI) — Scoring Module
=====================================================
Reference: Kristensen et al. (2005). The Copenhagen Burnout Inventory: A new tool
for the assessment of burnout. Work & Stress, 19(3), 192-207.

Structure:
  - Personal Burnout  : items 1–6   (frequency scale)
  - Work Burnout      : items 7–13  (degree scale; item 13 reversed)
  - Client Burnout    : items 14–19 (frequency scale)

Response encoding (caller must pass values already mapped to these integers):
  Frequency scale  : Always=100, Often=75, Sometimes=50, Seldom=25, Never/Almost never=0
  Degree scale     : To a very high degree=100, High=75, Somewhat=50, Low=25, Very low=0

Item 13 is REVERSED before averaging Work Burnout.

Score range per subscale: 0–100
Interpretation bands:
  0–49   → Low
  50–74  → Moderate
  ≥75    → High
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List

# Keys expected in the responses dict
PERSONAL_ITEMS = [f"cbi_{i}" for i in range(1, 7)]    # cbi_1 … cbi_6
WORK_ITEMS     = [f"cbi_{i}" for i in range(7, 14)]   # cbi_7 … cbi_13
CLIENT_ITEMS   = [f"cbi_{i}" for i in range(14, 20)]  # cbi_14 … cbi_19
REVERSED_ITEMS = {"cbi_13"}                            # item 13: high energy = low burnout

ALL_ITEMS = PERSONAL_ITEMS + WORK_ITEMS + CLIENT_ITEMS

VALID_VALUES = {0, 25, 50, 75, 100}

BANDS = [
    (0,  49,  "Low"),
    (50, 74,  "Moderate"),
    (75, 100, "High"),
]


@dataclass
class CBIResult:
    personal_burnout: float
    work_burnout: float
    client_burnout: float
    total: float
    bands: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "subscales": {
                "personal_burnout": {
                    "score": round(self.personal_burnout, 1),
                    "band": self.bands.get("personal_burnout", ""),
                },
                "work_burnout": {
                    "score": round(self.work_burnout, 1),
                    "band": self.bands.get("work_burnout", ""),
                },
                "client_burnout": {
                    "score": round(self.client_burnout, 1),
                    "band": self.bands.get("client_burnout", ""),
                },
            },
            "total": {
                "score": round(self.total, 1),
                "band": self.bands.get("total", ""),
            },
        }


def _get_band(score: float) -> str:
    for low, high, label in BANDS:
        if low <= score <= high:
            return label
    return "High"


def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _reverse(value: int) -> int:
    """Reverse a CBI value: 0↔100, 25↔75, 50↔50."""
    return 100 - value


def validate_responses(responses: Dict[str, int]) -> List[str]:
    """Return a list of validation error messages (empty = valid)."""
    errors: List[str] = []
    missing = [k for k in ALL_ITEMS if k not in responses]
    if missing:
        errors.append(f"Missing items: {missing}")
    for key, val in responses.items():
        if key in {*PERSONAL_ITEMS, *WORK_ITEMS, *CLIENT_ITEMS}:
            if val not in VALID_VALUES:
                errors.append(f"Item {key} has invalid value {val}. Must be one of {VALID_VALUES}.")
    return errors


def score(responses: Dict[str, int]) -> CBIResult:
    """
    Compute CBI subscale scores.

    Parameters
    ----------
    responses : dict
        Mapping of item key → integer value (already on 0/25/50/75/100 scale).
        e.g. {"cbi_1": 75, "cbi_2": 50, …, "cbi_19": 25}

    Returns
    -------
    CBIResult with scores and interpretation bands.
    """
    errors = validate_responses(responses)
    if errors:
        raise ValueError(f"CBI validation failed: {errors}")

    def _value(key: str) -> float:
        val = responses[key]
        return float(_reverse(val) if key in REVERSED_ITEMS else val)

    personal_scores = [_value(k) for k in PERSONAL_ITEMS]
    work_scores     = [_value(k) for k in WORK_ITEMS]
    client_scores   = [_value(k) for k in CLIENT_ITEMS]

    personal = _mean(personal_scores)
    work     = _mean(work_scores)
    client   = _mean(client_scores)
    total    = _mean(personal_scores + work_scores + client_scores)

    result = CBIResult(
        personal_burnout=personal,
        work_burnout=work,
        client_burnout=client,
        total=total,
    )
    result.bands = {
        "personal_burnout": _get_band(personal),
        "work_burnout":     _get_band(work),
        "client_burnout":   _get_band(client),
        "total":            _get_band(total),
    }
    return result
