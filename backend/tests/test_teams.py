from tests.test_assignments import create_assignment


def create_team(client):
    a = create_assignment(client)
    return client.post(f"/api/assignments/{a['id']}/teams", json={"name": "Team A"}).json()


def test_add_member(client):
    t = create_team(client)
    res = client.post(f"/api/teams/{t['id']}/members", json={"name": "Ana"})
    assert res.status_code == 201
    m = res.json()
    assert m["team_id"] == t["id"] and m["name"] == "Ana"


def test_add_member_unknown_team_404(client):
    assert client.post("/api/teams/999/members", json={"name": "Ana"}).status_code == 404


def test_get_team_with_members(client):
    t = create_team(client)
    for name in ["Ana", "Ben"]:
        client.post(f"/api/teams/{t['id']}/members", json={"name": name})
    res = client.get(f"/api/teams/{t['id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Team A"
    assert body["charter_locked"] is False
    assert [m["name"] for m in body["members"]] == ["Ana", "Ben"]


def test_get_team_404(client):
    assert client.get("/api/teams/999").status_code == 404
