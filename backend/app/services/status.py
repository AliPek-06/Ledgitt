"""Entry status rules (docs/RULES.md, "Entry status"). Pure functions, no I/O."""

import math
from collections.abc import Iterable


def confirms_needed(team_size: int) -> int:
    return math.ceil((team_size - 1) / 2)


def entry_status(verdicts: Iterable[str], team_size: int) -> str:
    """verdicts: the "confirm" / "dispute" verdicts of the entry's visible reviews."""
    verdicts = list(verdicts)
    if "dispute" in verdicts:
        return "disputed"
    if verdicts.count("confirm") >= confirms_needed(team_size):
        return "confirmed"
    return "pending"
