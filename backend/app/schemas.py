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


class AssignmentSummaryOut(BaseModel):
    id: int
    title: str
    start_date: datetime
    due_date: datetime
    join_code: str
    checkpoints: list[float]
    join_url: str


class AssignmentOut(AssignmentSummaryOut):
    teams: list[TeamOut]


class TeamHealthOut(BaseModel):
    id: int
    name: str
    charter_locked: bool
    member_count: int
    health: str  # "red" | "amber" | "green"
    open_team_alerts: int
    disputed_entries: int
    flagged_pastes: int


class OverviewOut(BaseModel):
    assignment: AssignmentSummaryOut
    t: float
    teams: list[TeamHealthOut]


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


class DocumentIn(BaseModel):
    member_id: int
    content_html: str
    content_text: str


class DocumentOut(BaseModel):
    team_id: int
    content_html: str
    content_text: str
    updated_at: datetime
    updated_by: Optional[int]


class PasteCreate(BaseModel):
    # Allowed values are checked in the documents router so they return 400.
    member_id: int
    kind: str  # "paste" | "burst"
    char_count: int
    preview: str  # server keeps the first 120 chars
    is_internal: bool  # decided by the frontend; trusted
    label: Optional[str] = None
    label_note: str = ""


class PasteLabelIn(BaseModel):
    member_id: int  # must be the member who pasted
    label: str  # "my_notes" | "quote" | "moved" | "other"
    label_note: str = ""


class PasteOut(BaseModel):
    id: int
    team_id: int
    member_id: int
    kind: str
    char_count: int
    preview: str
    is_internal: bool
    label: Optional[str]
    label_note: str
    flagged: bool
    created_at: datetime


class ContributionOut(BaseModel):
    member_id: int
    name: str
    expected_points: float
    actual_points: float
    progress_ratio: Optional[float]  # null when expected < 1
    status: str  # "not_started_yet" | "behind" | "on_track"


class TeamContributionOut(BaseModel):
    t: float
    team_median: Optional[float]
    members: list[ContributionOut]


class AlertOut(BaseModel):
    id: int
    team_id: int
    member_id: int
    checkpoint: float
    level: str  # "private" | "team"
    reason: str
    created_at: datetime
    resolved: bool


class DemoTimeIn(BaseModel):
    now: Optional[datetime]  # null clears the override


class DemoTimeOut(BaseModel):
    now: datetime
    overridden: bool
