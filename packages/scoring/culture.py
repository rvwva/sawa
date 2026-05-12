"""
Mindlign Proprietary Culture Assessment — Scoring Module
=====================================================
9 dimensions, 40 items total. 5-point Likert scale.

Response scale (caller passes raw 1–5 integer):
  1 = Strongly Disagree
  2 = Disagree
  3 = Neutral
  4 = Agree
  5 = Strongly Agree

Scoring per dimension:
  dimension_mean = average of items in dimension (1.0–5.0)
  dimension_score = (mean - 1) / 4 × 100  → 0–100

Overall culture score = mean of all 9 dimension scores.

Interpretation bands (per dimension and overall):
  0–40   → Needs Attention
  41–60  → Developing
  61–80  → Healthy
  81–100 → Thriving
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

VALID_VALUES = {1, 2, 3, 4, 5}

# ─── Dimension definitions (key, label, item keys) ──────────────────────────

DIMENSIONS: List[Tuple[str, str, List[str]]] = [
    (
        "leadership",
        "Leadership Effectiveness",
        ["culture_1", "culture_2", "culture_3", "culture_4", "culture_5"],
    ),
    (
        "communication",
        "Communication & Transparency",
        ["culture_6", "culture_7", "culture_8", "culture_9", "culture_10"],
    ),
    (
        "innovation",
        "Innovation & Agility",
        ["culture_11", "culture_12", "culture_13", "culture_14"],
    ),
    (
        "psychological_safety",
        "Psychological Safety",
        ["culture_15", "culture_16", "culture_17", "culture_18", "culture_19"],
    ),
    (
        "inclusion",
        "Inclusion & Belonging",
        ["culture_20", "culture_21", "culture_22", "culture_23", "culture_24"],
    ),
    (
        "growth",
        "Growth & Development",
        ["culture_25", "culture_26", "culture_27", "culture_28"],
    ),
    (
        "work_life_balance",
        "Work-Life Balance",
        ["culture_29", "culture_30", "culture_31", "culture_32"],
    ),
    (
        "recognition",
        "Recognition & Reward",
        ["culture_33", "culture_34", "culture_35", "culture_36"],
    ),
    (
        "collaboration",
        "Collaboration & Teamwork",
        ["culture_37", "culture_38", "culture_39", "culture_40"],
    ),
]

ALL_ITEMS = [item for _, _, items in DIMENSIONS for item in items]

BANDS = [
    (0,  40, "Needs Attention"),
    (41, 60, "Developing"),
    (61, 80, "Healthy"),
    (81, 100, "Thriving"),
]


@dataclass
class DimensionScore:
    key: str
    label: str
    mean: float          # 1.0–5.0 raw Likert mean
    score: float         # 0–100 scaled
    band: str


@dataclass
class CultureResult:
    dimensions: List[DimensionScore] = field(default_factory=list)
    overall_score: float = 0.0
    overall_band: str = ""

    def to_dict(self) -> dict:
        return {
            "dimensions": [
                {
                    "key": d.key,
                    "label": d.label,
                    "score": round(d.score, 1),
                    "mean": round(d.mean, 2),
                    "band": d.band,
                }
                for d in self.dimensions
            ],
            "total": {
                "score": round(self.overall_score, 1),
                "band": self.overall_band,
            },
        }


def _get_band(score: float) -> str:
    for low, high, label in BANDS:
        if low <= score <= high:
            return label
    return "Thriving"


def _scale(mean: float) -> float:
    """Convert Likert mean (1–5) to 0–100 scale."""
    return (mean - 1) / 4 * 100


def validate_responses(responses: Dict[str, int]) -> List[str]:
    errors: List[str] = []
    missing = [k for k in ALL_ITEMS if k not in responses]
    if missing:
        errors.append(f"Missing items: {missing}")
    for key, val in responses.items():
        if key.startswith("culture_"):
            if val not in VALID_VALUES:
                errors.append(f"Item {key} has invalid value {val}. Must be 1–5.")
    return errors


def score(responses: Dict[str, int]) -> CultureResult:
    """
    Compute Mindlign Culture Assessment dimension and overall scores.

    Parameters
    ----------
    responses : dict
        Mapping of item key → integer value (1–5).
        e.g. {"culture_1": 4, "culture_2": 3, …, "culture_40": 5}

    Returns
    -------
    CultureResult with per-dimension scores and overall culture score.
    """
    errors = validate_responses(responses)
    if errors:
        raise ValueError(f"Culture assessment validation failed: {errors}")

    dimension_scores: List[DimensionScore] = []

    for dim_key, dim_label, item_keys in DIMENSIONS:
        values = [float(responses[k]) for k in item_keys]
        mean = sum(values) / len(values)
        scaled = _scale(mean)
        dimension_scores.append(
            DimensionScore(
                key=dim_key,
                label=dim_label,
                mean=mean,
                score=scaled,
                band=_get_band(scaled),
            )
        )

    overall = sum(d.score for d in dimension_scores) / len(dimension_scores)

    return CultureResult(
        dimensions=dimension_scores,
        overall_score=overall,
        overall_band=_get_band(overall),
    )
