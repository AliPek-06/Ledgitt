"""Append-only ledger. There are deliberately no update or delete endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from app.db import get_session
from app.models import CharterItem, Entry, Member, Review, Team
from app.schemas import EntryCreate, EntryOut, ReviewCreate, ReviewOut
from app.services import clock
from app.services.status import entry_status

router = APIRouter(prefix="/api")

SIZES = {"S", "M", "L"}
EVIDENCE_KINDS = {"url", "file", "doc_activity", "commit"}
VERDICTS = {"confirm", "dispute"}


def _team_size(session: Session, team_id: int) -> int:
    return session.exec(select(func.count()).select_from(Member).where(Member.team_id == team_id)).one()


def _visible_entry(session: Session, entry_id: int) -> Entry:
    e = session.get(Entry, entry_id)
    if not e or e.created_at > clock.now():
        raise HTTPException(404, "Entry not found")
    return e


def _entry_out(session: Session, e: Entry, team_size: int) -> EntryOut:
    reviews = session.exec(
        select(Review)
        .where(Review.entry_id == e.id, Review.created_at <= clock.now())
        .order_by(Review.created_at, Review.id)
    ).all()
    return EntryOut(
        **e.model_dump(),
        status=entry_status([r.verdict for r in reviews], team_size),
        reviews=[ReviewOut(**r.model_dump()) for r in reviews],
    )


@router.post("/teams/{team_id}/entries", response_model=EntryOut, status_code=201)
def create_entry(team_id: int, body: EntryCreate, session: Session = Depends(get_session)):
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team not found")
    member = session.get(Member, body.member_id)
    if not member or member.team_id != team_id:
        raise HTTPException(400, f"Member {body.member_id} is not in this team")
    if not body.description.strip():
        raise HTTPException(400, "description is required")
    if body.size not in SIZES:
        raise HTTPException(400, 'size must be "S", "M" or "L"')
    for ev in body.evidence:
        if ev.kind not in EVIDENCE_KINDS:
            raise HTTPException(400, f"Unknown evidence kind {ev.kind!r}")
        if not ev.ref.strip():
            raise HTTPException(400, "Evidence ref is required")
    if body.charter_item_id is not None:
        # Unlocked charters get replaced (new item ids), which would orphan the link.
        if not team.charter_locked:
            raise HTTPException(400, "Lock the charter before linking entries to charter items")
        ci = session.get(CharterItem, body.charter_item_id)
        if not ci or ci.team_id != team_id:
            raise HTTPException(400, f"Charter item {body.charter_item_id} is not in this team")

    e = Entry(
        team_id=team_id,
        member_id=body.member_id,
        description=body.description,
        size=body.size,
        charter_item_id=body.charter_item_id,
        evidence=[ev.model_dump() for ev in body.evidence],
        created_at=clock.now(),
    )
    session.add(e)
    session.commit()
    session.refresh(e)
    return _entry_out(session, e, _team_size(session, team_id))


@router.get("/teams/{team_id}/entries", response_model=list[EntryOut])
def list_entries(team_id: int, session: Session = Depends(get_session)):
    if not session.get(Team, team_id):
        raise HTTPException(404, "Team not found")
    entries = session.exec(
        select(Entry)
        .where(Entry.team_id == team_id, Entry.created_at <= clock.now())
        .order_by(Entry.created_at.desc(), Entry.id.desc())
    ).all()
    size = _team_size(session, team_id)
    return [_entry_out(session, e, size) for e in entries]


@router.post("/entries/{entry_id}/reviews", response_model=EntryOut, status_code=201)
def create_review(entry_id: int, body: ReviewCreate, session: Session = Depends(get_session)):
    e = _visible_entry(session, entry_id)
    reviewer = session.get(Member, body.reviewer_id)
    if not reviewer or reviewer.team_id != e.team_id:
        raise HTTPException(400, f"Member {body.reviewer_id} is not in this team")
    if body.reviewer_id == e.member_id:
        raise HTTPException(400, "You cannot review your own entry")
    if body.verdict not in VERDICTS:
        raise HTTPException(400, 'verdict must be "confirm" or "dispute"')
    if body.verdict == "dispute" and not body.note.strip():
        raise HTTPException(400, "A dispute requires a note")
    # Checked against all reviews, not just visible ones: one review per reviewer, ever.
    existing = session.exec(
        select(Review).where(Review.entry_id == e.id, Review.reviewer_id == body.reviewer_id)
    ).first()
    if existing:
        raise HTTPException(400, "You have already reviewed this entry")

    session.add(Review(
        entry_id=e.id,
        reviewer_id=body.reviewer_id,
        verdict=body.verdict,
        note=body.note,
        created_at=clock.now(),
    ))
    session.commit()
    return _entry_out(session, e, _team_size(session, e.team_id))
