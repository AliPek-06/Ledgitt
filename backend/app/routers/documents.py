"""Shared team document and paste events (docs/RULES.md, "Paste detection").

Paste/burst detection and is_internal are decided in the frontend; the backend
stores them as given and only derives `flagged`.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Document, Member, PasteEvent, Team
from app.schemas import DocumentIn, DocumentOut, PasteCreate, PasteLabelIn, PasteOut
from app.services import clock

router = APIRouter(prefix="/api")

PASTE_KINDS = {"paste", "burst"}
LABELS = {"my_notes", "quote", "moved", "other"}
PREVIEW_CHARS = 120


def is_flagged(is_internal: bool, label: Optional[str]) -> bool:
    return not is_internal and label is None


def _get_team(session: Session, team_id: int) -> Team:
    t = session.get(Team, team_id)
    if not t:
        raise HTTPException(404, "Team not found")
    return t


def _check_member(session: Session, member_id: int, team_id: int) -> None:
    m = session.get(Member, member_id)
    if not m or m.team_id != team_id:
        raise HTTPException(400, f"Member {member_id} is not in this team")


def _check_label(label: Optional[str]) -> None:
    if label is not None and label not in LABELS:
        raise HTTPException(400, 'label must be "my_notes", "quote", "moved" or "other"')


@router.get("/teams/{team_id}/document", response_model=DocumentOut)
def get_document(team_id: int, session: Session = Depends(get_session)):
    _get_team(session, team_id)
    doc = session.get(Document, team_id)
    if not doc:
        doc = Document(team_id=team_id, updated_at=clock.now())
        session.add(doc)
        session.commit()
        session.refresh(doc)
    return doc


@router.put("/teams/{team_id}/document", response_model=DocumentOut)
def save_document(team_id: int, body: DocumentIn, session: Session = Depends(get_session)):
    _get_team(session, team_id)
    _check_member(session, body.member_id, team_id)
    doc = session.get(Document, team_id) or Document(team_id=team_id, updated_at=clock.now())
    doc.content_html = body.content_html
    doc.content_text = body.content_text
    doc.updated_at = clock.now()
    doc.updated_by = body.member_id
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


@router.post("/teams/{team_id}/pastes", response_model=PasteOut, status_code=201)
def create_paste(team_id: int, body: PasteCreate, session: Session = Depends(get_session)):
    _get_team(session, team_id)
    _check_member(session, body.member_id, team_id)
    if body.kind not in PASTE_KINDS:
        raise HTTPException(400, 'kind must be "paste" or "burst"')
    if body.char_count < 0:
        raise HTTPException(400, "char_count must not be negative")
    _check_label(body.label)
    p = PasteEvent(
        team_id=team_id,
        member_id=body.member_id,
        kind=body.kind,
        char_count=body.char_count,
        preview=body.preview[:PREVIEW_CHARS],
        is_internal=body.is_internal,
        label=body.label,
        label_note=body.label_note,
        flagged=is_flagged(body.is_internal, body.label),
        created_at=clock.now(),
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@router.get("/teams/{team_id}/pastes", response_model=list[PasteOut])
def list_pastes(team_id: int, session: Session = Depends(get_session)):
    """Internal events are stored but never shown, so they are left out here."""
    _get_team(session, team_id)
    return session.exec(
        select(PasteEvent)
        .where(
            PasteEvent.team_id == team_id,
            PasteEvent.is_internal == False,  # noqa: E712
            PasteEvent.created_at <= clock.now(),
        )
        .order_by(PasteEvent.created_at.desc(), PasteEvent.id.desc())
    ).all()


@router.patch("/pastes/{paste_id}/label", response_model=PasteOut)
def label_paste(paste_id: int, body: PasteLabelIn, session: Session = Depends(get_session)):
    p = session.get(PasteEvent, paste_id)
    if not p or p.created_at > clock.now():
        raise HTTPException(404, "Paste event not found")
    if body.member_id != p.member_id:
        raise HTTPException(403, "Only the member who pasted can label this")
    _check_label(body.label)
    p.label = body.label
    p.label_note = body.label_note
    p.flagged = is_flagged(p.is_internal, p.label)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p
