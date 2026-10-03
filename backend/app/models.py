"""Tables for every stored model in docs/API.md, plus warning-engine state.

Not stored: Entry.status and Entry.reviews (derived from Review rows) and
Contribution (computed per member). Evidence is stored as JSON on Entry.
created_at values are set by callers from app/services/clock.py, never here.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

DEFAULT_CHECKPOINTS = [0.33, 0.66]


class Assignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    start_date: datetime
    due_date: datetime
    join_code: str = Field(index=True, unique=True)
    checkpoints: list[float] = Field(
        default_factory=lambda: list(DEFAULT_CHECKPOINTS), sa_column=Column(JSON)
    )


class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: int = Field(foreign_key="assignment.id", index=True)
    name: str
    charter_locked: bool = False


class Member(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    name: str


class CharterItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    member_id: int = Field(foreign_key="member.id", index=True)
    responsibility: str
    planned_points: int
    start_pct: float  # 0.0..1.0 of the project timeline
    end_pct: float


class Entry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    member_id: int = Field(foreign_key="member.id", index=True)
    description: str
    size: str  # "S" | "M" | "L"
    charter_item_id: Optional[int] = Field(default=None, foreign_key="charteritem.id")
    # List of {kind, ref, label}; kind = "url" | "file" | "doc_activity" | "commit"
    evidence: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime


class Review(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entry.id", index=True)
    reviewer_id: int = Field(foreign_key="member.id")
    verdict: str  # "confirm" | "dispute"
    note: str = ""
    created_at: datetime


class Document(SQLModel, table=True):
    team_id: int = Field(foreign_key="team.id", primary_key=True)
    content_html: str = ""
    content_text: str = ""
    updated_at: datetime
    updated_by: Optional[int] = Field(default=None, foreign_key="member.id")


class PasteEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    member_id: int = Field(foreign_key="member.id", index=True)
    kind: str  # "paste" | "burst"
    char_count: int
    preview: str  # first 120 chars
    is_internal: bool  # text already existed in the doc
    label: Optional[str] = None  # "my_notes" | "quote" | "moved" | "other"
    label_note: str = ""
    flagged: bool  # true when not internal and unlabelled
    created_at: datetime


class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    member_id: int = Field(foreign_key="member.id", index=True)
    checkpoint: float
    level: str  # "private" | "team"
    reason: str
    created_at: datetime
    resolved: bool = False


# Warning-engine state (not part of the API contract).


class MemberStreak(SQLModel, table=True):
    team_id: int = Field(foreign_key="team.id", primary_key=True)
    member_id: int = Field(foreign_key="member.id", primary_key=True)
    streak: int = 0


class EvaluatedCheckpoint(SQLModel, table=True):
    team_id: int = Field(foreign_key="team.id", primary_key=True)
    checkpoint: float = Field(primary_key=True)
