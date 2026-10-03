import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Assignment, Team
from app.schemas import AssignmentCreate, AssignmentOut, NameCreate, TeamOut

router = APIRouter(prefix="/api")

JOIN_BASE_URL = "http://localhost:5173/join/"
# No 0/O/1/I so codes are easy to read aloud.
JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_join_code(session: Session) -> str:
    while True:
        code = "".join(secrets.choice(JOIN_ALPHABET) for _ in range(6))
        if not session.exec(select(Assignment).where(Assignment.join_code == code)).first():
            return code


def _assignment_out(session: Session, a: Assignment) -> AssignmentOut:
    teams = session.exec(select(Team).where(Team.assignment_id == a.id).order_by(Team.id)).all()
    return AssignmentOut(
        **a.model_dump(),
        join_url=JOIN_BASE_URL + a.join_code,
        teams=[TeamOut(**t.model_dump()) for t in teams],
    )


@router.post("/assignments", response_model=AssignmentOut, status_code=201)
def create_assignment(body: AssignmentCreate, session: Session = Depends(get_session)):
    a = Assignment(**body.model_dump(), join_code=_new_join_code(session))
    session.add(a)
    session.commit()
    session.refresh(a)
    return _assignment_out(session, a)


@router.get("/assignments/{assignment_id}", response_model=AssignmentOut)
def get_assignment(assignment_id: int, session: Session = Depends(get_session)):
    a = session.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    return _assignment_out(session, a)


@router.get("/join/{join_code}", response_model=AssignmentOut)
def get_by_join_code(join_code: str, session: Session = Depends(get_session)):
    a = session.exec(select(Assignment).where(Assignment.join_code == join_code.upper())).first()
    if not a:
        raise HTTPException(404, "Invalid join code")
    return _assignment_out(session, a)


@router.post("/assignments/{assignment_id}/teams", response_model=TeamOut, status_code=201)
def create_team(assignment_id: int, body: NameCreate, session: Session = Depends(get_session)):
    if not session.get(Assignment, assignment_id):
        raise HTTPException(404, "Assignment not found")
    t = Team(assignment_id=assignment_id, name=body.name)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t
