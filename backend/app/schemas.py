"""Request/response shapes for endpoints. See docs/API.md."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models import DEFAULT_CHECKPOINTS
from app.services.clock import to_utc


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1)
    start_date: datetime
    due_date: datetime
    checkpoints: list[float] = Field(default_factory=lambda: list(DEFAULT_CHECKPOINTS))

    @model_validator(mode="after")
    def check_dates(self):
        self.start_date = to_utc(self.start_date)
        self.due_date = to_utc(self.due_date)
        if self.due_date <= self.start_date:
            raise ValueError("due_date must be after start_date")
        if any(not 0 < c < 1 for c in self.checkpoints):
            raise ValueError("checkpoints must be between 0 and 1")
        self.checkpoints = sorted(self.checkpoints)
        return self


class NameCreate(BaseModel):
    name: str = Field(min_length=1)


class TeamOut(BaseModel):
    id: int
    assignment_id: int
    name: str
    charter_locked: bool


class MemberOut(BaseModel):
    id: int
    team_id: int
    name: str


class AssignmentOut(BaseModel):
    id: int
    title: str
    start_date: datetime
    due_date: datetime
    join_code: str
    checkpoints: list[float]
    join_url: str
    teams: list[TeamOut]


class CharterItemIn(BaseModel):
    # Range rules are checked in the charter router so they return 400.
    member_id: int
    responsibility: str
    planned_points: int
    start_pct: float
    end_pct: float


class CharterIn(BaseModel):
    items: list[CharterItemIn]


class CharterItemOut(CharterItemIn):
    id: int
    team_id: int


class TeamDetailOut(TeamOut):
    members: list[MemberOut]
    charter_items: list[CharterItemOut]


class EvidenceIn(BaseModel):
    kind: str  # "url" | "file" | "doc_activity" | "commit"
    ref: str
    label: str = ""


class EntryCreate(BaseModel):
    # Allowed values are checked in the ledger router so they return 400.
    member_id: int
    description: str
    size: str  # "S" | "M" | "L"
    charter_item_id: Optional[int] = None
    evidence: list[EvidenceIn] = Field(default_factory=list)


class ReviewCreate(BaseModel):
    reviewer_id: int
    verdict: str  # "confirm" | "dispute"
    note: str = ""


class ReviewOut(BaseModel):
    id: int
    entry_id: int
    reviewer_id: int
    verdict: str
    note: str
    created_at: datetime


class EntryOut(BaseModel):
    id: int
    team_id: int
    member_id: int
    description: str
    size: str
    charter_item_id: Optional[int]
    evidence: list[EvidenceIn]
    created_at: datetime
    status: str  # "pending" | "confirmed" | "disputed"
    reviews: list[ReviewOut]


class DemoTimeIn(BaseModel):
    now: Optional[datetime]  # null clears the override


class DemoTimeOut(BaseModel):
    now: datetime
    overridden: bool
