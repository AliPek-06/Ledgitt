import re

ASSIGNMENT = {
    "title": "Group report",
    "start_date": "2026-01-01T00:00:00",
    "due_date": "2026-01-31T00:00:00",
}


def create_assignment(client, **overrides):
    res = client.post("/api/assignments", json={**ASSIGNMENT, **overrides})
    assert res.status_code == 201, res.text
    return res.json()


def test_create_assignment(client):
    a = create_assignment(client)
    assert a["title"] == "Group report"
    assert re.fullmatch(r"[A-Z0-9]{6}", a["join_code"])
    assert a["join_url"] == f"http://localhost:5173/join/{a['join_code']}"
    assert a["checkpoints"] == [0.33, 0.66]
    assert a["teams"] == []
    assert a["start_date"] == "2026-01-01T00:00:00Z"


def test_assignment_dates_with_offset_are_stored_as_utc(client):
    a = create_assignment(client, start_date="2026-01-01T02:00:00+02:00")
    assert a["start_date"] == "2026-01-01T00:00:00Z"
    fetched = client.get(f"/api/assignments/{a['id']}").json()
    assert fetched["start_date"] == "2026-01-01T00:00:00Z"


def test_create_assignment_custom_checkpoints(client):
    a = create_assignment(client, checkpoints=[0.5, 0.25])
    assert a["checkpoints"] == [0.25, 0.5]


def test_join_codes_are_unique(client):
    codes = {create_assignment(client)["join_code"] for _ in range(20)}
    assert len(codes) == 20


def test_due_date_must_be_after_start_date(client):
    res = client.post("/api/assignments", json={**ASSIGNMENT, "due_date": "2025-12-01T00:00:00"})
    assert res.status_code == 422
    res = client.post("/api/assignments", json={**ASSIGNMENT, "due_date": ASSIGNMENT["start_date"]})
    assert res.status_code == 422


def test_invalid_checkpoints_rejected(client):
    res = client.post("/api/assignments", json={**ASSIGNMENT, "checkpoints": [1.5]})
    assert res.status_code == 422


def test_get_assignment(client):
    a = create_assignment(client)
    client.post(f"/api/assignments/{a['id']}/teams", json={"name": "Team A"})
    res = client.get(f"/api/assignments/{a['id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == a["id"]
    assert [t["name"] for t in body["teams"]] == ["Team A"]


def test_get_assignment_404(client):
    assert client.get("/api/assignments/999").status_code == 404


def test_join_by_code(client):
    a = create_assignment(client)
    res = client.get(f"/api/join/{a['join_code']}")
    assert res.status_code == 200
    assert res.json()["id"] == a["id"]
    # Codes are case-insensitive.
    assert client.get(f"/api/join/{a['join_code'].lower()}").json()["id"] == a["id"]


def test_join_by_bad_code_404(client):
    assert client.get("/api/join/NOPE00").status_code == 404


def test_create_team(client):
    a = create_assignment(client)
    res = client.post(f"/api/assignments/{a['id']}/teams", json={"name": "Team A"})
    assert res.status_code == 201
    assert res.json() == {"id": res.json()["id"], "assignment_id": a["id"],
                          "name": "Team A", "charter_locked": False}


def test_create_team_unknown_assignment_404(client):
    assert client.post("/api/assignments/999/teams", json={"name": "X"}).status_code == 404


def test_create_team_requires_name(client):
    a = create_assignment(client)
    assert client.post(f"/api/assignments/{a['id']}/teams", json={"name": ""}).status_code == 422
