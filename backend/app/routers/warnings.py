from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, or_, select

from app.db import get_session
from app.models import Alert, Assignment, Member, Team
from app.schemas import AlertOut, ContributionOut, TeamContributionOut
from app.services import clock
from app.services.checkpoints import evaluate_due_checkpoints, team_contribution
from app.services.warnings import elapsed_fraction, team_median

router = APIRouter(prefix="/api")


def _get_team(session: Session, team_id: int) -> Team:
    t = session.get(Team, team_id)
    if not t:
        raise HTTPException(404, "Team not found")
    return t


@router.get("/teams/{team_id}/contribution", response_model=TeamContributionOut)
def get_contribution(team_id: int, session: Session = Depends(get_session)):
    team = _get_team(session, team_id)
    evaluate_due_checkpoints(session, team_id)
    a = session.get(Assignment, team.assignment_id)
    now = clock.now()
    t = elapsed_fraction(now, a.start_date, a.due_date)
    rows = team_contribution(session, team, t, now)
    return TeamContributionOut(
        t=t,
        team_median=team_median(rows),
        members=[ContributionOut(**r.__dict__) for r in rows],
    )


@router.get("/teams/{team_id}/alerts", response_model=list[AlertOut])
def get_alerts(team_id: int, viewer_id: int, session: Session = Depends(get_session)):
    """Visibility: "private" only to the member it is about, "team" to the whole team."""
    _get_team(session, team_id)
    viewer = session.get(Member, viewer_id)
    if not viewer or viewer.team_id != team_id:
        raise HTTPException(400, f"Member {viewer_id} is not in this team")
    evaluate_due_checkpoints(session, team_id)
    return session.exec(
        select(Alert)
        .where(
            Alert.team_id == team_id,
            Alert.created_at <= clock.now(),
            or_(Alert.level == "team", Alert.member_id == viewer_id),
        )
        .order_by(col(Alert.created_at).desc(), col(Alert.id).desc())
    ).all()
