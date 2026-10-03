from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import CharterItem, Member, Team
from app.routers.teams import team_detail
from app.schemas import CharterIn, CharterItemIn, TeamDetailOut

router = APIRouter(prefix="/api")


def _get_team(session: Session, team_id: int) -> Team:
    t = session.get(Team, team_id)
    if not t:
        raise HTTPException(404, "Team not found")
    return t


def _validate_item(n: int, item: CharterItemIn, member_ids: set[int]) -> None:
    def fail(msg: str):
        raise HTTPException(400, f"Charter item {n}: {msg}")

    if not item.responsibility.strip():
        fail("responsibility is required")
    if item.planned_points <= 0:
        fail("planned_points must be greater than 0")
    if not 0 <= item.start_pct < item.end_pct <= 1:
        fail("must satisfy 0 <= start_pct < end_pct <= 1")
    if item.member_id not in member_ids:
        fail(f"member {item.member_id} is not in this team")


@router.put("/teams/{team_id}/charter", response_model=TeamDetailOut)
def replace_charter(team_id: int, body: CharterIn, session: Session = Depends(get_session)):
    t = _get_team(session, team_id)
    if t.charter_locked:
        raise HTTPException(400, "Charter is locked and can no longer be edited")

    member_ids = set(session.exec(select(Member.id).where(Member.team_id == team_id)).all())
    for n, item in enumerate(body.items, start=1):
        _validate_item(n, item, member_ids)

    for old in session.exec(select(CharterItem).where(CharterItem.team_id == team_id)).all():
        session.delete(old)
    for item in body.items:
        session.add(CharterItem(team_id=team_id, **item.model_dump()))
    session.commit()
    return team_detail(session, t)


@router.post("/teams/{team_id}/charter/lock", response_model=TeamDetailOut)
def lock_charter(team_id: int, session: Session = Depends(get_session)):
    t = _get_team(session, team_id)
    if t.charter_locked:
        raise HTTPException(400, "Charter is already locked")
    if not session.exec(select(CharterItem).where(CharterItem.team_id == team_id)).first():
        raise HTTPException(400, "Cannot lock an empty charter")
    t.charter_locked = True
    session.add(t)
    session.commit()
    session.refresh(t)
    return team_detail(session, t)
