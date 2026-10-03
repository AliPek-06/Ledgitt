from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Member, Team
from app.schemas import MemberOut, NameCreate, TeamDetailOut

router = APIRouter(prefix="/api")


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
    members = session.exec(select(Member).where(Member.team_id == team_id).order_by(Member.id)).all()
    return TeamDetailOut(**t.model_dump(), members=[MemberOut(**m.model_dump()) for m in members])
