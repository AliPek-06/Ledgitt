import pytest

from tests.test_teams import create_team


@pytest.fixture
def team(client):
    t = create_team(client)
    ana = client.post(f"/api/teams/{t['id']}/members", json={"name": "Ana"}).json()
    ben = client.post(f"/api/teams/{t['id']}/members", json={"name": "Ben"}).json()
    return {"id": t["id"], "ana": ana["id"], "ben": ben["id"]}


def item(member_id, **overrides):
    return {"member_id": member_id, "responsibility": "Write intro",
            "planned_points": 2, "start_pct": 0.0, "end_pct": 0.5, **overrides}


def put(client, team_id, items):
    return client.put(f"/api/teams/{team_id}/charter", json={"items": items})


def assert_400(res, fragment):
    assert res.status_code == 400, res.text
    assert fragment in res.json()["detail"]


# Saving, replacing, locking


def test_save_charter(client, team):
    res = put(client, team["id"], [item(team["ana"]), item(team["ben"], responsibility="Research")])
    assert res.status_code == 200
    items = res.json()["charter_items"]
    assert [i["responsibility"] for i in items] == ["Write intro", "Research"]
    assert all(i["team_id"] == team["id"] and i["id"] for i in items)


def test_put_replaces_whole_charter(client, team):
    put(client, team["id"], [item(team["ana"]), item(team["ben"])])
    res = put(client, team["id"], [item(team["ben"], responsibility="Slides", planned_points=4)])
    items = res.json()["charter_items"]
    assert len(items) == 1
    assert items[0]["responsibility"] == "Slides" and items[0]["planned_points"] == 4


def test_get_team_includes_charter_items(client, team):
    put(client, team["id"], [item(team["ana"])])
    body = client.get(f"/api/teams/{team['id']}").json()
    assert [i["member_id"] for i in body["charter_items"]] == [team["ana"]]


def test_get_team_without_charter_has_empty_list(client, team):
    assert client.get(f"/api/teams/{team['id']}").json()["charter_items"] == []


def test_lock_charter(client, team):
    put(client, team["id"], [item(team["ana"])])
    res = client.post(f"/api/teams/{team['id']}/charter/lock")
    assert res.status_code == 200
    assert res.json()["charter_locked"] is True
    assert client.get(f"/api/teams/{team['id']}").json()["charter_locked"] is True


# Validation: start_pct / end_pct


@pytest.mark.parametrize("start,end", [
    (0.5, 0.5),    # start == end
    (0.6, 0.4),    # start > end
    (-0.1, 0.5),   # start < 0
    (0.2, 1.1),    # end > 1
])
def test_invalid_pct_range(client, team, start, end):
    res = put(client, team["id"], [item(team["ana"], start_pct=start, end_pct=end)])
    assert_400(res, "0 <= start_pct < end_pct <= 1")


def test_pct_bounds_are_inclusive(client, team):
    res = put(client, team["id"], [item(team["ana"], start_pct=0.0, end_pct=1.0)])
    assert res.status_code == 200


# Validation: planned_points


@pytest.mark.parametrize("points", [0, -1])
def test_planned_points_must_be_positive(client, team, points):
    res = put(client, team["id"], [item(team["ana"], planned_points=points)])
    assert_400(res, "planned_points must be greater than 0")


# Validation: member belongs to team


def test_member_must_belong_to_team(client, team):
    other = create_team(client)
    outsider = client.post(f"/api/teams/{other['id']}/members", json={"name": "Zed"}).json()
    res = put(client, team["id"], [item(outsider["id"])])
    assert_400(res, f"member {outsider['id']} is not in this team")


def test_unknown_member_rejected(client, team):
    assert_400(put(client, team["id"], [item(9999)]), "not in this team")


# Validation: locked charter


def test_put_rejected_after_lock(client, team):
    put(client, team["id"], [item(team["ana"])])
    client.post(f"/api/teams/{team['id']}/charter/lock")
    res = put(client, team["id"], [item(team["ben"])])
    assert_400(res, "locked")
    # The original charter is untouched.
    items = client.get(f"/api/teams/{team['id']}").json()["charter_items"]
    assert [i["member_id"] for i in items] == [team["ana"]]


# Other rules


def test_error_names_the_bad_item(client, team):
    res = put(client, team["id"], [item(team["ana"]), item(team["ben"], planned_points=0)])
    assert_400(res, "Charter item 2")


def test_invalid_item_saves_nothing(client, team):
    put(client, team["id"], [item(team["ana"])])
    put(client, team["id"], [item(team["ben"]), item(team["ben"], planned_points=0)])
    items = client.get(f"/api/teams/{team['id']}").json()["charter_items"]
    assert [i["member_id"] for i in items] == [team["ana"]]


def test_responsibility_required(client, team):
    assert_400(put(client, team["id"], [item(team["ana"], responsibility="  ")]), "responsibility")


def test_cannot_lock_empty_charter(client, team):
    assert_400(client.post(f"/api/teams/{team['id']}/charter/lock"), "empty")


def test_cannot_lock_twice(client, team):
    put(client, team["id"], [item(team["ana"])])
    client.post(f"/api/teams/{team['id']}/charter/lock")
    assert_400(client.post(f"/api/teams/{team['id']}/charter/lock"), "already locked")


def test_unknown_team_404(client):
    assert put(client, 999, []).status_code == 404
    assert client.post("/api/teams/999/charter/lock").status_code == 404
