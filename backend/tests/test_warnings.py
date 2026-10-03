"""Pure-function tests for docs/RULES.md TIME and EXPECTED VS ACTUAL rules."""

from dataclasses import dataclass
from datetime import datetime, timezone

import pytest

from app.services.warnings import (
    Contribution, EntryPoints, MemberInfo, contribution_rows, elapsed_fraction,
    expected_points, is_behind, next_level, team_median,
)


@dataclass
class Item:
    member_id: int
    planned_points: int
    start_pct: float
    end_pct: float


def dt(day, hour=0):
    return datetime(2026, 1, day, hour, tzinfo=timezone.utc)


START, DUE = dt(1), dt(31)  # 30 days


@pytest.mark.parametrize("now,expected", [
    (datetime(2025, 12, 1, tzinfo=timezone.utc), 0.0),  # before start: clamped
    (START, 0.0),
    (dt(16), 0.5),
    (DUE, 1.0),
    (datetime(2026, 3, 1, tzinfo=timezone.utc), 1.0),   # after due: clamped
])
def test_elapsed_fraction(now, expected):
    assert elapsed_fraction(now, START, DUE) == pytest.approx(expected)


@pytest.mark.parametrize("items,t,expected", [
    ([Item(1, 4, 0.0, 0.5)], 0.0, 0.0),
    ([Item(1, 4, 0.0, 0.5)], 0.25, 2.0),   # halfway through the item
    ([Item(1, 4, 0.0, 0.5)], 0.5, 4.0),
    ([Item(1, 4, 0.0, 0.5)], 1.0, 4.0),    # clamped at planned_points
    ([Item(1, 4, 0.5, 1.0)], 0.25, 0.0),   # item not started yet
    ([Item(1, 4, 0.0, 0.5), Item(1, 2, 0.5, 1.0)], 0.75, 5.0),  # summed
    ([], 0.5, 0.0),
])
def test_expected_points(items, t, expected):
    assert expected_points(items, t) == pytest.approx(expected)


def row(expected, actual):
    ratio = actual / expected if expected >= 1 else None
    return Contribution(1, "Ana", expected, actual, ratio, "on_track")


@pytest.mark.parametrize("r,median,behind,why", [
    (row(0.5, 0), 1.0, False, "expected < 1 is never flagged"),
    (row(4, 1), 1.0, True, "ratio 0.25 < half the median 0.5"),
    (row(4, 2), 1.0, False, "ratio exactly half the median is not behind"),
    (row(4, 4), 1.0, False, "on track"),
    (row(5, 1), 0.2, True, "ratio 0.2 < 0.25 even though it matches the median (stall)"),
    (row(4, 1), 0.25, False, "ratio 0.25 is not < 0.25 and not < half the median"),
    (row(2, 0), 0.0, True, "no work with expected >= 2"),
    (row(4, 4), None, False, "no median available, on track"),
    (row(4, 0.5), None, True, "no median available, stall rule still applies"),
])
def test_is_behind(r, median, behind, why):
    assert is_behind(r, median) is behind, why


@pytest.mark.parametrize("streak,level", [(1, "private"), (2, "team"), (3, "team"), (6, "team")])
def test_next_level(streak, level):
    assert next_level(streak) == level


MEMBERS = [MemberInfo(1, "Ana"), MemberInfo(2, "Ben"), MemberInfo(3, "Cam")]


def by_name(rows):
    return {r.name: r for r in rows}


def test_contribution_counts_only_confirmed_entries():
    items = [Item(1, 4, 0.0, 1.0)]
    entries = [EntryPoints(1, "L", "confirmed"), EntryPoints(1, "M", "pending"),
               EntryPoints(1, "S", "disputed")]
    ana = by_name(contribution_rows(MEMBERS, items, entries, 0.5))["Ana"]
    assert ana.actual_points == 4
    assert ana.expected_points == pytest.approx(2.0)


def test_contribution_sizes_map_to_points():
    entries = [EntryPoints(1, s, "confirmed") for s in ("S", "M", "L")]
    assert by_name(contribution_rows(MEMBERS, [], entries, 0.5))["Ana"].actual_points == 7


def test_uneven_charter_late_member_not_started_and_not_in_median():
    items = [Item(1, 4, 0.0, 0.3), Item(2, 4, 0.7, 1.0), Item(3, 4, 0.0, 0.3)]
    entries = [EntryPoints(1, "L", "confirmed"), EntryPoints(3, "M", "confirmed")]
    rows = by_name(contribution_rows(MEMBERS, items, entries, 0.33))
    assert rows["Ben"].status == "not_started_yet"
    assert rows["Ben"].progress_ratio is None
    assert rows["Ana"].status == "on_track" and rows["Ana"].progress_ratio == 1.0
    # Median of Ana (1.0) and Cam (0.5) only; Cam is exactly half, so not behind.
    assert team_median(rows.values()) == pytest.approx(0.75)
    assert rows["Cam"].status == "on_track"


def test_member_far_below_median_is_behind():
    items = [Item(m.id, 4, 0.0, 0.5) for m in MEMBERS]
    entries = [EntryPoints(1, "L", "confirmed"), EntryPoints(2, "L", "confirmed"),
               EntryPoints(3, "S", "confirmed")]
    rows = by_name(contribution_rows(MEMBERS, items, entries, 0.5))
    assert [rows[n].status for n in ("Ana", "Ben", "Cam")] == ["on_track", "on_track", "behind"]


def test_team_median_none_when_nobody_expected():
    rows = contribution_rows(MEMBERS, [], [], 0.5)
    assert team_median(rows) is None
    assert all(r.status == "not_started_yet" for r in rows)


@pytest.mark.parametrize("disputed,health", [(0, "green"), (1, "amber"), (3, "amber")])
def test_team_health(disputed, health):
    from app.services.warnings import team_health
    assert team_health(disputed) == health
