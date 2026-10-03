"""Single source of "now" for all business logic.

All datetimes are timezone-aware UTC (SQLModel stores and returns them that
way). Naive input is treated as UTC.
"""

from datetime import datetime, timezone
from typing import Optional

_override: Optional[datetime] = None


def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def now() -> datetime:
    if _override is not None:
        return _override
    return datetime.now(timezone.utc)


def is_overridden() -> bool:
    return _override is not None


def set_override(dt: datetime) -> None:
    global _override
    _override = to_utc(dt)


def clear_override() -> None:
    global _override
    _override = None
