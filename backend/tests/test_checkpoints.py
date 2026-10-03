"""Scenario tests for CHECKPOINTS AND ESCALATION and ALERT VISIBILITY (docs/RULES.md).

Timeline: 2026-01-01 -> 2026-01-31 (30 days). Default checkpoints 0.33 / 0.66 fall
on Jan 10 21:36 and Jan 20 19:12; 0.9 falls on Jan 28 00:00.
"""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlmodel import select

from app.models import Alert, Entry, EvaluatedCheckpoint, MemberStreak, Review

NAMES = ("Ana", "Ben", "Cam")
EVEN = {n: [(8, 0.0, 1.0)] for n in NAMES}  # 8 points spread over the whole timeline


def day(d, hour=0):
    return f"2026-01-{d:02d}T{hour:02d}:00:00Z"


def set_time(client, iso):
    assert client.post("/api/demo/time", json={"now": iso}).status_code == 200


def setup_team(client, charter=EVEN, checkpoints=None, lock=True):
    body = {"title": "Report", "start_date": day(1), "due_date": day(31)}
    if checkpoints:
        body["checkpoints"] = checkpoints
    a = client.post("/api/assignments", json=body).json()
    team_id = client.post(f"/api/assignments/{a['id']}/teams", json={"name": "T"}).json()["id"]
    ids = {n: client.post(f"/api/teams/{team_id}/members", json={"name": n}).json()["id"]
           for n in NAMES}
    items = [{"member_id": ids[n], "responsibility": f"{n} part", "planned_points": p,
              "start_pct": s, "end_pct": e}
             for n, specs in charter.items() for (p, s, e) in specs]
    assert client.put(f"/api/teams/{team_id}/charter", json={"items": items}).status_code == 200
    if lock:
        assert client.post(f"/api/teams/{team_id}/charter/lock").status_code == 200
    set_time(client, day(1, 1))
    return SimpleNamespace(team_id=team_id, ids=ids, names={v: k for k, v in ids.items()})


def log(client, ctx, name, size, when):
    """Log an entry at `when` and have a teammate confirm it straight away."""
    set_time(client, when)
    e = client.post(f"/api/teams/{ctx.team_id}/entries",
                    json={"member_id": ctx.ids[name], "description": "work", "size": size})
    assert e.status_code == 201, e.text
    reviewer = next(n for n in NAMES if n != name)
    r = client.post(f"/api/entries/{e.json()['id']}/reviews",
                    json={"reviewer_id": ctx.ids[reviewer], "verdict": "confirm"})
    assert r.json()["status"] == "confirmed"


def alerts_for(client, ctx, viewer):
    res = client.get(f"/api/teams/{ctx.team_id}/alerts", params={"viewer_id": ctx.ids[viewer]})
    assert res.status_code == 200, res.text
    return res.json()


def db_alerts(session, ctx):
    return session.exec(select(Alert).where(Alert.team_id == ctx.team_id).order_by(Alert.id)).all()


def streak(session, ctx, name):
    ms = session.get(MemberStreak, (ctx.team_id, ctx.ids[name]))
    return ms.streak if ms else 0


# Who gets flagged at the first checkpoint (table-driven)


@pytest.mark.parametrize("charter,work,flagged", [
    pytest.param(
        {"Ana": [(4, 0.0, 0.3)], "Ben": [(4, 0.7, 1.0)], "Cam": [(4, 0.7, 1.0)]},
        [("Ana", "L", 5)], [],
        id="uneven charter: members planned late are not flagged early"),
    pytest.param(
        EVEN, [("Ana", "L", 5), ("Ben", "L", 5)], ["Cam"],
        id="zero-work member flagged"),
    pytest.param(
        EVEN, [], ["Ana", "Ben", "Cam"],
        id="whole-team stall with no work flags everyone"),
    pytest.param(
        {n: [(16, 0.0, 1.0)] for n in NAMES},
        [("Ana", "S", 5), ("Ben", "S", 5), ("Cam", "S", 5)], ["Ana", "Ben", "Cam"],
        id="whole-team stall with a little work flags everyone (ratio < 0.25)"),
    pytest.param(
        EVEN, [("Ana", "L", 5), ("Ben", "L", 5), ("Cam", "L", 5)], [],
        id="everyone on track: nobody flagged"),
])
def test_first_checkpoint(client, session, charter, work, flagged):
    ctx = setup_team(client, charter)
    for name, size, d in work:
        log(client, ctx, name, size, day(d))
    set_time(client, day(11))
    alerts = db_alerts(session, ctx)
    assert sorted(ctx.names[a.member_id] for a in alerts) == sorted(flagged)
    assert all(a.level == "private" and a.checkpoint == 0.33 for a in alerts)


# Escalation ladder


@pytest.mark.parametrize("when,expected_levels,expected_streak", [
    (day(11), ["private"], 1),
    (day(21), ["private", "team"], 2),
    (day(29), ["private", "team", "team"], 3),
])
def test_streak_escalates_private_team_team(client, session, when, expected_levels, expected_streak):
    ctx = setup_team(client, checkpoints=[0.33, 0.66, 0.9])
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    for step in (day(11), day(21), day(29)):  # walk demo time forward like the slider
        set_time(client, step)
        if step == when:
            break
    alerts = db_alerts(session, ctx)
    assert {ctx.names[a.member_id] for a in alerts} == {"Cam"}
    assert [a.level for a in alerts] == expected_levels
    assert streak(session, ctx, "Cam") == expected_streak


def test_recovery_resolves_alerts_and_resets_streak(client, session):
    ctx = setup_team(client)
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    set_time(client, day(11))
    (alert,) = db_alerts(session, ctx)
    assert alert.resolved is False and streak(session, ctx, "Cam") == 1
    # Expected at 0.33 = 8 * 0.33 = 2.64; the checkpoint is not repeated in the text.
    assert alert.reason == "0 of 2.6 expected points confirmed"

    log(client, ctx, "Cam", "L", day(15))
    log(client, ctx, "Cam", "L", day(15, 1))
    set_time(client, day(21))
    session.refresh(alert)
    assert alert.resolved is True
    assert streak(session, ctx, "Cam") == 0
    assert len(db_alerts(session, ctx)) == 1  # no new alert


def test_after_recovery_next_alert_starts_private_again(client, session):
    ctx = setup_team(client, checkpoints=[0.33, 0.5, 0.95])
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    set_time(client, day(11))                       # 0.33: Cam behind -> private
    log(client, ctx, "Cam", "L", day(12))
    set_time(client, day(17))                       # 0.5: Cam 4/4, recovers
    log(client, ctx, "Ana", "L", day(25))
    log(client, ctx, "Ana", "L", day(25, 1))
    log(client, ctx, "Ben", "L", day(25, 2))
    log(client, ctx, "Ben", "L", day(25, 3))
    set_time(client, day(30))                       # 0.95: Cam far below median -> behind
    cam = [a for a in db_alerts(session, ctx) if a.member_id == ctx.ids["Cam"]]
    assert [(a.checkpoint, a.level, a.resolved) for a in cam] == [
        (0.33, "private", True), (0.95, "private", False)]


# Each checkpoint evaluated once


def test_each_checkpoint_evaluated_only_once(client, session):
    ctx = setup_team(client)
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    set_time(client, day(11))
    for _ in range(3):
        alerts_for(client, ctx, "Cam")
        client.get(f"/api/teams/{ctx.team_id}/contribution")
    set_time(client, day(12))
    set_time(client, day(11))
    assert len(db_alerts(session, ctx)) == 1
    assert streak(session, ctx, "Cam") == 1
    evaluated = session.exec(
        select(EvaluatedCheckpoint.checkpoint).where(EvaluatedCheckpoint.team_id == ctx.team_id)
    ).all()
    assert evaluated == [0.33]


def test_jump_past_two_checkpoints_judges_each_as_of_its_own_moment(client, session):
    ctx = setup_team(client)

    def add(name, size, when, reviewer):
        at = datetime.fromisoformat(when)
        e = Entry(team_id=ctx.team_id, member_id=ctx.ids[name], description="w", size=size,
                  created_at=at)
        session.add(e)
        session.commit()
        session.add(Review(entry_id=e.id, reviewer_id=ctx.ids[reviewer], verdict="confirm",
                           created_at=at))
        session.commit()

    # Records written directly so no evaluation runs before the jump.
    add("Ana", "L", day(5), "Ben")
    add("Ben", "L", day(5), "Ana")
    add("Cam", "L", day(15), "Ana")   # Cam only starts after the 33% checkpoint
    add("Cam", "L", day(15), "Ben")

    set_time(client, day(21))  # one jump past both 0.33 and 0.66
    (alert,) = db_alerts(session, ctx)
    assert ctx.names[alert.member_id] == "Cam"
    assert alert.checkpoint == 0.33 and alert.level == "private"
    assert alert.created_at == datetime(2026, 1, 10, 21, 36, tzinfo=timezone.utc)
    assert alert.resolved is True  # recovered by 0.66
    assert streak(session, ctx, "Cam") == 0


def test_unlocked_charter_is_not_evaluated(client, session):
    ctx = setup_team(client, lock=False)
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    set_time(client, day(21))
    assert alerts_for(client, ctx, "Cam") == []
    assert session.exec(select(EvaluatedCheckpoint)).all() == []

    client.post(f"/api/teams/{ctx.team_id}/charter/lock")
    # Locking late: passed checkpoints are evaluated on the next request, each as of its own moment.
    levels = sorted(a["level"] for a in alerts_for(client, ctx, "Cam"))
    assert levels == ["private", "team"]


# Alert visibility and time


def test_private_alert_only_visible_to_that_member(client):
    ctx = setup_team(client)
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    set_time(client, day(11))
    assert [a["level"] for a in alerts_for(client, ctx, "Cam")] == ["private"]
    assert alerts_for(client, ctx, "Ana") == []
    assert alerts_for(client, ctx, "Ben") == []


def test_team_alert_visible_to_whole_team(client):
    ctx = setup_team(client)
    log(client, ctx, "Ana", "L", day(5))
    log(client, ctx, "Ben", "L", day(5))
    set_time(client, day(11))
    set_time(client, day(21))
    for viewer in ("Ana", "Ben"):
        assert [a["level"] for a in alerts_for(client, ctx, viewer)] == ["team"]
    # Cam sees both, newest first.
    assert [a["level"] for a in alerts_for(client, ctx, "Cam")] == ["team", "private"]


def test_alerts_hidden_before_their_checkpoint_time(client):
    ctx = setup_team(client)
    set_time(client, day(11))
    assert len(alerts_for(client, ctx, "Cam")) == 1
    set_time(client, day(9))
    assert alerts_for(client, ctx, "Cam") == []
    set_time(client, day(11))
    assert len(alerts_for(client, ctx, "Cam")) == 1


def test_alerts_viewer_must_be_in_team(client):
    ctx = setup_team(client)
    other = setup_team(client)
    res = client.get(f"/api/teams/{ctx.team_id}/alerts", params={"viewer_id": other.ids["Ana"]})
    assert res.status_code == 400
    assert client.get(f"/api/teams/{ctx.team_id}/alerts").status_code == 422  # viewer_id required


def test_alerts_unknown_team_404(client):
    assert client.get("/api/teams/999/alerts", params={"viewer_id": 1}).status_code == 404


# Contribution endpoint


def test_contribution_endpoint(client):
    charter = {"Ana": [(8, 0.0, 1.0)], "Ben": [(8, 0.0, 1.0)], "Cam": [(4, 0.7, 1.0)]}
    ctx = setup_team(client, charter)
    log(client, ctx, "Ana", "L", day(5))
    set_time(client, day(6))
    # An unconfirmed entry does not count.
    client.post(f"/api/teams/{ctx.team_id}/entries",
                json={"member_id": ctx.ids["Ben"], "description": "w", "size": "L"})
    set_time(client, day(16))  # t = 0.5

    body = client.get(f"/api/teams/{ctx.team_id}/contribution").json()
    assert body["t"] == pytest.approx(0.5)
    rows = {r["name"]: r for r in body["members"]}
    assert rows["Ana"] == {"member_id": ctx.ids["Ana"], "name": "Ana", "expected_points": 4.0,
                           "actual_points": 4.0, "progress_ratio": 1.0, "status": "on_track"}
    assert rows["Ben"]["actual_points"] == 0 and rows["Ben"]["status"] == "behind"
    assert rows["Cam"]["status"] == "not_started_yet" and rows["Cam"]["progress_ratio"] is None
    assert body["team_median"] == pytest.approx(0.5)  # median of Ana 1.0 and Ben 0.0


def test_contribution_unknown_team_404(client):
    assert client.get("/api/teams/999/contribution").status_code == 404
