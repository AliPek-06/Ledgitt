"""Lazy checkpoint evaluation (docs/RULES.md, "Checkpoints and escalation").

Each checkpoint is judged as of its own moment: t = checkpoint, and only
entries/reviews created up to the checkpoint's datetime count. So jumping demo
time past several checkpoints at once evaluates each one fairly.
"""

from datetime import datetime

from sqlmodel import Session, col, select

from app.models import (
    Alert, Assignment, CharterItem, Entry, EvaluatedCheckpoint, Member, MemberStreak,
    Review, Team,
)
from app.services import clock
from app.services.status import entry_status
from app.services.warnings import (
    Contribution, EntryPoints, MemberInfo, contribution_rows, elapsed_fraction, next_level,
)


def checkpoint_time(a: Assignment, c: float) -> datetime:
    return a.start_date + (a.due_date - a.start_date) * c


def entry_points(session: Session, team_id: int, team_size: int, cutoff: datetime) -> list[EntryPoints]:
    """The team's entries created at or before cutoff, with status from reviews up to cutoff."""
    entries = session.exec(
        select(Entry).where(Entry.team_id == team_id, Entry.created_at <= cutoff)
    ).all()
    verdicts: dict[int, list[str]] = {e.id: [] for e in entries if e.id is not None}
    if verdicts:
        for r in session.exec(
            select(Review).where(col(Review.entry_id).in_(verdicts), Review.created_at <= cutoff)
        ).all():
            verdicts[r.entry_id].append(r.verdict)
    return [
        EntryPoints(e.member_id, e.size, entry_status(verdicts[e.id], team_size))
        for e in entries if e.id is not None
    ]


def team_contribution(session: Session, team: Team, t: float, cutoff: datetime) -> list[Contribution]:
    """Contribution rows at fraction t, counting only records created at or before cutoff."""
    members = session.exec(select(Member).where(Member.team_id == team.id).order_by(Member.id)).all()
    items = session.exec(select(CharterItem).where(CharterItem.team_id == team.id)).all()
    points = entry_points(session, team.id, len(members), cutoff)
    return contribution_rows([MemberInfo(m.id, m.name) for m in members], items, points, t)


def _alert_reason(row: Contribution) -> str:
    # No checkpoint in the text: the alert has a `checkpoint` field and the
    # frontend says "At the N% checkpoint" itself.
    return f"{row.actual_points:g} of {row.expected_points:.1f} expected points confirmed"


def evaluate_due_checkpoints(session: Session, team_id: int) -> None:
    team = session.get(Team, team_id)
    if not team or not team.charter_locked:
        return
    a = session.get(Assignment, team.assignment_id)
    t_now = elapsed_fraction(clock.now(), a.start_date, a.due_date)
    done = set(session.exec(
        select(EvaluatedCheckpoint.checkpoint).where(EvaluatedCheckpoint.team_id == team_id)
    ).all())

    for c in sorted(a.checkpoints):
        if c in done or t_now < c:
            continue
        at = checkpoint_time(a, c)
        for row in team_contribution(session, team, c, at):
            ms = session.get(MemberStreak, (team_id, row.member_id)) or MemberStreak(
                team_id=team_id, member_id=row.member_id, streak=0)
            if row.status == "behind":
                ms.streak += 1
                session.add(Alert(
                    team_id=team_id, member_id=row.member_id, checkpoint=c,
                    level=next_level(ms.streak), reason=_alert_reason(row), created_at=at,
                ))
            else:
                ms.streak = 0
                for alert in session.exec(select(Alert).where(
                    Alert.team_id == team_id, Alert.member_id == row.member_id,
                    Alert.resolved == False,  # noqa: E712
                )).all():
                    alert.resolved = True
                    session.add(alert)
            session.add(ms)
        session.add(EvaluatedCheckpoint(team_id=team_id, checkpoint=c))
        session.commit()


def evaluate_all_teams(session: Session) -> None:
    for team_id in session.exec(select(Team.id).where(Team.charter_locked == True)).all():  # noqa: E712
        if team_id is not None:
            evaluate_due_checkpoints(session, team_id)
