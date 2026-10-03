"""Early-warning rules from docs/RULES.md (TIME, EXPECTED VS ACTUAL, escalation).

Pure functions: no database access, no clock. Callers pass everything in.
"""

import statistics
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Protocol

SIZE_POINTS = {"S": 1, "M": 2, "L": 4}


class CharterItemLike(Protocol):
    member_id: int
    planned_points: int
    start_pct: float
    end_pct: float


@dataclass(frozen=True)
class MemberInfo:
    id: int
    name: str


@dataclass(frozen=True)
class EntryPoints:
    member_id: int
    size: str  # "S" | "M" | "L"
    status: str  # "pending" | "confirmed" | "disputed"


@dataclass(frozen=True)
class Contribution:
    member_id: int
    name: str
    expected_points: float
    actual_points: float
    progress_ratio: Optional[float]  # None when expected < 1
    status: str  # "not_started_yet" | "behind" | "on_track"


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def elapsed_fraction(now: datetime, start: datetime, due: datetime) -> float:
    return _clamp01((now - start) / (due - start))


def expected_points(charter_items: Iterable[CharterItemLike], t: float) -> float:
    return sum(
        i.planned_points * _clamp01((t - i.start_pct) / (i.end_pct - i.start_pct))
        for i in charter_items
    )


def is_behind(row: Contribution, team_median: Optional[float]) -> bool:
    if row.expected_points < 1:
        return False
    ratio = row.progress_ratio
    if team_median is not None and ratio < 0.5 * team_median:
        return True
    if ratio < 0.25:  # catches a whole-team stall
        return True
    return row.actual_points == 0 and row.expected_points >= 2


def contribution_rows(
    members: Sequence[MemberInfo],
    charter_items: Sequence[CharterItemLike],
    entries: Iterable[EntryPoints],
    t: float,
) -> list[Contribution]:
    """entries: the team's entries with status already computed. Only confirmed count."""
    actual = {m.id: 0.0 for m in members}
    for e in entries:
        if e.status == "confirmed" and e.member_id in actual:
            actual[e.member_id] += SIZE_POINTS[e.size]

    draft = []
    for m in members:
        exp = expected_points([i for i in charter_items if i.member_id == m.id], t)
        ratio = actual[m.id] / exp if exp >= 1 else None
        draft.append(Contribution(m.id, m.name, exp, actual[m.id], ratio, "on_track"))

    median = team_median(draft)
    rows = []
    for r in draft:
        if r.expected_points < 1:
            status = "not_started_yet"
        elif is_behind(r, median):
            status = "behind"
        else:
            status = "on_track"
        rows.append(Contribution(**{**r.__dict__, "status": status}))
    return rows


def team_median(rows: Iterable[Contribution]) -> Optional[float]:
    ratios = [r.progress_ratio for r in rows if r.expected_points >= 1]
    return statistics.median(ratios) if ratios else None


def next_level(streak: int) -> str:
    return "private" if streak <= 1 else "team"


def team_health(open_team_alerts: int, disputed_entries: int) -> str:
    """Overview colour. Private alerts are deliberately not an input: they stay private."""
    if open_team_alerts > 0:
        return "red"
    if disputed_entries > 0:
        return "amber"
    return "green"
