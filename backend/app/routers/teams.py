from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import CharterItem, Member, Team
from app.schemas import CharterItemOut, MemberOut, NameCreate, TeamDetailOut

router = APIRouter(prefix="/api")


def team_detail(session: Session, t: Team) -> TeamDetailOut:
    members = session.exec(select(Member).where(Member.team_id == t.id).order_by(Member.id)).all()
    items = session.exec(
        select(CharterItem).where(CharterItem.team_id == t.id).order_by(CharterItem.id)
    ).all()
    return TeamDetailOut(
        **t.model_dump(),
        members=[MemberOut(**m.model_dump()) for m in members],
        charter_items=[CharterItemOut(**i.model_dump()) for i in items],
    )


@router.post("/teams/{team_id}/members", response_model=MemberOut, status_code=201)
def join_team(team_id: int, body: NameCreate, session: Session = Depends(get_session)):
    if not session.get(Team, team_id):
        raise HTTPException(404, "Team not found")
    m = Member(team_id=team_id, name=body.name)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


@router.get("/teams/{team_id}", response_model=TeamDetailOut)
def get_team(team_id: int, session: Session = Depends(get_session)):
    t = session.get(Team, team_id)
    if not t:
        raise HTTPException(404, "Team not found")
    return team_detail(session, t)
