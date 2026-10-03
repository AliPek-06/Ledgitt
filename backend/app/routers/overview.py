from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from app.db import get_session
from app.models import Assignment, Member, PasteEvent, Team
from app.routers.assignments import JOIN_BASE_URL
from app.schemas import AssignmentSummaryOut, OverviewOut, TeamHealthOut
from app.services import clock
from app.services.checkpoints import entry_points, evaluate_due_checkpoints
from app.services.warnings import elapsed_fraction, team_health

router = APIRouter(prefix="/api")


def _count(session: Session, stmt) -> int:
    return session.exec(stmt).one()


@router.get("/assignments/{assignment_id}/overview", response_model=OverviewOut)
def get_overview(assignment_id: int, session: Session = Depends(get_session)):
    a = session.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    now = clock.now()
    teams = session.exec(select(Team).where(Team.assignment_id == a.id).order_by(Team.id)).all()

    rows = []
    for t in teams:
        evaluate_due_checkpoints(session, t.id)
        size = _count(session, select(func.count()).select_from(Member).where(Member.team_id == t.id))
        disputed = sum(1 for e in entry_points(session, t.id, size, now) if e.status == "disputed")
        flagged = _count(session, select(func.count()).select_from(PasteEvent).where(
            PasteEvent.team_id == t.id, PasteEvent.flagged == True,  # noqa: E712
            PasteEvent.created_at <= now,
        ))
        rows.append(TeamHealthOut(
            id=t.id, name=t.name, charter_locked=t.charter_locked, member_count=size,
            health=team_health(disputed),
            disputed_entries=disputed, flagged_pastes=flagged,
        ))

    return OverviewOut(
        assignment=AssignmentSummaryOut(**a.model_dump(), join_url=JOIN_BASE_URL + a.join_code),
        t=elapsed_fraction(now, a.start_date, a.due_date),
        teams=rows,
    )
