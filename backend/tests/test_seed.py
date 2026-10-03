"""The demo story (phase B7): seed, step the clock through each checkpoint, check it."""

import pytest
from sqlmodel import SQLModel, select

from app.models import Alert, Member
from app.services.seed import DISPUTED_DESCRIPTION, DISPUTE_NOTE, at_t


def set_t(client, t):
    res = client.post("/api/demo/time", json={"now": at_t(t).isoformat()})
    assert res.status_code == 200


def overview(client):
    body = client.get("/api/assignments/1/overview").json()
    return body, {t["name"]: t for t in body["teams"]}


def member_id(session, name):
    return session.exec(select(Member.id).where(Member.name == name)).one()


def alerts_for(client, session, team_id, viewer):
    res = client.get(f"/api/teams/{team_id}/alerts", params={"viewer_id": member_id(session, viewer)})
    assert res.status_code == 200, res.text
    return res.json()


def alert_rows(session):
    names = {m.id: m.name for m in session.exec(select(Member)).all()}
    return [(names[a.member_id], a.checkpoint, a.level, a.resolved)
            for a in session.exec(select(Alert).order_by(Alert.id)).all()]


def test_story(client, session):
    res = client.post("/api/demo/seed")
    assert res.status_code == 200
    body = res.json()
    teams = {t["name"]: t for t in body["teams"]}
    g7, g3 = teams["Group 7"]["id"], teams["Group 3"]["id"]

    # t = 0.20: nothing evaluated yet, Jordan's paste is flagged, both groups green.
    assert body["t"] == pytest.approx(0.20)
    assert body["assignment"]["title"] == "Engineering Design Report"
    assert body["assignment"]["checkpoints"] == [0.33, 0.66]
    assert {n: t["health"] for n, t in teams.items()} == {"Group 7": "green", "Group 3": "green"}
    assert teams["Group 7"]["flagged_pastes"] == 1
    assert alert_rows(session) == []
    (paste,) = client.get(f"/api/teams/{g7}/pastes").json()
    assert paste["char_count"] == 900 and paste["flagged"] is True and paste["label"] is None

    # t = 0.35: Sam and Ben get private alerts; nobody else is flagged; still green.
    set_t(client, 0.35)
    assert alert_rows(session) == [("Sam", 0.33, "private", False), ("Ben", 0.33, "private", False)]
    assert [a["level"] for a in alerts_for(client, session, g7, "Sam")] == ["private"]
    assert alerts_for(client, session, g7, "Maya") == []
    assert alerts_for(client, session, g3, "Alex") == []
    _, teams = overview(client)
    assert {n: t["health"] for n, t in teams.items()} == {"Group 7": "green", "Group 3": "green"}

    # t = 0.50: Priya's dispute is in, so Group 7 turns amber.
    set_t(client, 0.50)
    entries = client.get(f"/api/teams/{g7}/entries").json()
    (disputed,) = [e for e in entries if e["description"] == DISPUTED_DESCRIPTION]
    assert disputed["status"] == "disputed"
    assert any(r["note"] == DISPUTE_NOTE for r in disputed["reviews"])
    _, teams = overview(client)
    assert {n: t["health"] for n, t in teams.items()} == {"Group 7": "amber", "Group 3": "green"}
    assert teams["Group 7"]["disputed_entries"] == 1

    # t = 0.70: Sam has caught up (alert resolved); Ben escalates to team; Group 3 red.
    set_t(client, 0.70)
    assert alert_rows(session) == [
        ("Sam", 0.33, "private", True),
        ("Ben", 0.33, "private", False),
        ("Ben", 0.66, "team", False),
    ]
    assert [a["level"] for a in alerts_for(client, session, g3, "Alex")] == ["team"]
    assert [a["level"] for a in alerts_for(client, session, g3, "Chloe")] == ["team"]
    contribution = client.get(f"/api/teams/{g7}/contribution").json()
    assert {m["name"]: m["status"] for m in contribution["members"]}["Sam"] == "on_track"
    _, teams = overview(client)
    assert {n: t["health"] for n, t in teams.items()} == {"Group 7": "amber", "Group 3": "red"}
    assert teams["Group 3"]["open_team_alerts"] == 1


def dump(session):
    conn = session.connection()
    return {t.name: sorted(tuple(r) for r in conn.execute(t.select()).all())
            for t in SQLModel.metadata.sorted_tables}


def test_seeding_twice_gives_identical_results(client, session):
    first = client.post("/api/demo/seed").json()
    rows_first = dump(session)
    time_first = client.get("/api/demo/time").json()

    set_t(client, 0.70)  # create alerts, streaks and evaluated checkpoints
    assert alert_rows(session)

    second = client.post("/api/demo/seed").json()
    assert second == first
    assert dump(session) == rows_first
    assert client.get("/api/demo/time").json() == time_first


def test_reset_clears_everything(client, session):
    client.post("/api/demo/seed")
    assert client.post("/api/demo/reset").json() == {"ok": True}
    assert all(rows == [] for rows in dump(session).values())
    assert client.get("/api/demo/time").json()["overridden"] is False
    assert client.get("/api/assignments/1").status_code == 404


def test_overview_unknown_assignment_404(client):
    assert client.get("/api/assignments/999/overview").status_code == 404


def test_overview_ignores_private_alerts_and_future_records(client):
    client.post("/api/demo/seed")
    set_t(client, 0.35)  # private alerts only
    _, teams = overview(client)
    assert teams["Group 3"]["open_team_alerts"] == 0
    set_t(client, 0.70)
    set_t(client, 0.50)  # team alert (dated at 0.66) is hidden again
    _, teams = overview(client)
    assert teams["Group 3"]["health"] == "green"
