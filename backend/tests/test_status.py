"""ENTRY STATUS rules from docs/RULES.md, tested on the pure function."""

import pytest

from app.services.status import confirms_needed, entry_status


@pytest.mark.parametrize("team_size,needed", [(1, 0), (2, 1), (3, 1), (4, 2), (5, 2), (6, 3)])
def test_confirms_needed_is_ceil_half_of_others(team_size, needed):
    assert confirms_needed(team_size) == needed


def test_no_reviews_is_pending():
    assert entry_status([], 3) == "pending"


def test_three_person_team_one_confirm_confirms():
    assert entry_status(["confirm"], 3) == "confirmed"


def test_four_person_team_needs_two_confirms():
    assert entry_status(["confirm"], 4) == "pending"
    assert entry_status(["confirm", "confirm"], 4) == "confirmed"


def test_any_dispute_is_disputed():
    assert entry_status(["dispute"], 3) == "disputed"


def test_dispute_beats_confirms():
    assert entry_status(["confirm", "confirm", "dispute"], 4) == "disputed"
