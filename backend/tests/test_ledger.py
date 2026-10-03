import pytest

from app.main import app
from tests.test_teams import create_team


def make_team(client, size):
    t = create_team(client)
    ids = [client.post(f"/api/teams/{t['id']}/members", json={"name": f"M{i}"}).json()["id"]
           for i in range(size)]
    return t["id"], ids


def add_entry(client, team_id, member_id, **overrides):
    body = {"member_id": member_id, "description": "Wrote intro", "size": "M", **overrides}
    res = client.post(f"/api/teams/{team_id}/entries", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def review(client, entry_id, reviewer_id, verdict="confirm", note=""):
    return client.post(f"/api/entries/{entry_id}/reviews",
                       json={"reviewer_id": reviewer_id, "verdict": verdict, "note": note})


def set_time(client, iso):
    assert client.post("/api/demo/time", json={"now": iso}).status_code == 200


def assert_400(res, fragment):
    assert res.status_code == 400, res.text
    assert fragment in res.json()["detail"]


# Creating and listing


def test_create_entry(client):
    team_id, (ana, _) = make_team(client, 2)
    set_time(client, "2026-01-10T09:00:00Z")
    e = add_entry(client, team_id, ana, evidence=[{"kind": "url", "ref": "https://x.y", "label": "Draft"}])
    assert e["status"] == "pending"
    assert e["reviews"] == []
    assert e["evidence"] == [{"kind": "url", "ref": "https://x.y", "label": "Draft"}]
    assert e["created_at"] == "2026-01-10T09:00:00Z"  # from clock.now()


def test_list_newest_first_with_reviews(client):
    team_id, (ana, ben, _) = make_team(client, 3)
    set_time(client, "2026-01-10T09:00:00Z")
    first = add_entry(client, team_id, ana, description="first")
    set_time(client, "2026-01-11T09:00:00Z")
    add_entry(client, team_id, ana, description="second")
    review(client, first["id"], ben)

    entries = client.get(f"/api/teams/{team_id}/entries").json()
    assert [e["description"] for e in entries] == ["second", "first"]
    assert entries[1]["status"] == "confirmed"
    assert [r["reviewer_id"] for r in entries[1]["reviews"]] == [ben]


# Status as reviews come in


def test_pending_without_enough_reviews(client):
    team_id, (ana, *_) = make_team(client, 3)
    e = add_entry(client, team_id, ana)
    assert client.get(f"/api/teams/{team_id}/entries").json()[0]["status"] == "pending"


def test_confirmed_three_person_team(client):
    team_id, (ana, ben, _) = make_team(client, 3)
    e = add_entry(client, team_id, ana)
    res = review(client, e["id"], ben)
    assert res.status_code == 201
    assert res.json()["status"] == "confirmed"


def test_confirmed_four_person_team_needs_two(client):
    team_id, (ana, ben, cam, _) = make_team(client, 4)
    e = add_entry(client, team_id, ana)
    assert review(client, e["id"], ben).json()["status"] == "pending"
    assert review(client, e["id"], cam).json()["status"] == "confirmed"


def test_disputed(client):
    team_id, (ana, ben, cam, _) = make_team(client, 4)
    e = add_entry(client, team_id, ana)
    review(client, e["id"], ben)
    review(client, e["id"], cam)
    res = review(client, e["id"], _, verdict="dispute", note="I wrote that section")
    assert res.json()["status"] == "disputed"
    assert client.get(f"/api/teams/{team_id}/entries").json()[0]["status"] == "disputed"


# Review rejection rules


def test_self_review_rejected(client):
    team_id, (ana, _) = make_team(client, 2)
    e = add_entry(client, team_id, ana)
    assert_400(review(client, e["id"], ana), "your own entry")


def test_double_review_rejected(client):
    team_id, (ana, ben, _) = make_team(client, 3)
    e = add_entry(client, team_id, ana)
    assert review(client, e["id"], ben).status_code == 201
    assert_400(review(client, e["id"], ben, verdict="dispute", note="changed my mind"), "already reviewed")


def test_dispute_requires_note(client):
    team_id, (ana, ben) = make_team(client, 2)
    e = add_entry(client, team_id, ana)
    assert_400(review(client, e["id"], ben, verdict="dispute"), "requires a note")
    assert_400(review(client, e["id"], ben, verdict="dispute", note="   "), "requires a note")


def test_reviewer_must_be_in_team(client):
    team_id, (ana, _) = make_team(client, 2)
    _, (outsider,) = make_team(client, 1)
    e = add_entry(client, team_id, ana)
    assert_400(review(client, e["id"], outsider), "not in this team")


def test_invalid_verdict_rejected(client):
    team_id, (ana, ben) = make_team(client, 2)
    e = add_entry(client, team_id, ana)
    assert_400(review(client, e["id"], ben, verdict="maybe"), "verdict")


def test_review_unknown_entry_404(client):
    _, (ana,) = make_team(client, 1)
    assert review(client, 999, ana).status_code == 404


# Entry rejection rules


@pytest.mark.parametrize("overrides,fragment", [
    ({"size": "XL"}, "size"),
    ({"description": "  "}, "description"),
    ({"evidence": [{"kind": "tweet", "ref": "x"}]}, "evidence kind"),
    ({"evidence": [{"kind": "url", "ref": ""}]}, "ref is required"),
    ({"charter_item_id": 999}, "Lock the charter"),
])
def test_invalid_entry_rejected(client, overrides, fragment):
    team_id, (ana,) = make_team(client, 1)
    body = {"member_id": ana, "description": "x", "size": "S", **overrides}
    assert_400(client.post(f"/api/teams/{team_id}/entries", json=body), fragment)


def test_entry_member_must_be_in_team(client):
    team_id, _ = make_team(client, 1)
    _, (outsider,) = make_team(client, 1)
    res = client.post(f"/api/teams/{team_id}/entries",
                      json={"member_id": outsider, "description": "x", "size": "S"})
    assert_400(res, "not in this team")


def test_charter_item_link_requires_locked_charter_in_same_team(client):
    team_id, (ana,) = make_team(client, 1)
    item = {"member_id": ana, "responsibility": "Intro", "planned_points": 2,
            "start_pct": 0, "end_pct": 0.5}
    client.put(f"/api/teams/{team_id}/charter", json={"items": [item]})
    ci = client.get(f"/api/teams/{team_id}").json()["charter_items"][0]["id"]
    body = {"member_id": ana, "description": "x", "size": "S", "charter_item_id": ci}

    assert_400(client.post(f"/api/teams/{team_id}/entries", json=body), "Lock the charter")
    client.post(f"/api/teams/{team_id}/charter/lock")
    assert client.post(f"/api/teams/{team_id}/entries", json=body).json()["charter_item_id"] == ci

    other_id, (zed,) = make_team(client, 1)
    client.put(f"/api/teams/{other_id}/charter", json={"items": [{**item, "member_id": zed}]})
    client.post(f"/api/teams/{other_id}/charter/lock")
    other_body = {**body, "member_id": zed}
    assert_400(client.post(f"/api/teams/{other_id}/entries", json=other_body), "not in this team")


# Time travel


def test_future_records_hidden(client):
    team_id, (ana, ben, _) = make_team(client, 3)
    set_time(client, "2026-01-10T09:00:00Z")
    old = add_entry(client, team_id, ana, description="old")
    set_time(client, "2026-01-12T09:00:00Z")
    add_entry(client, team_id, ana, description="new")
    review(client, old["id"], ben)  # confirmed on the 12th

    set_time(client, "2026-01-11T09:00:00Z")
    entries = client.get(f"/api/teams/{team_id}/entries").json()
    assert [e["description"] for e in entries] == ["old"]
    # The review is also in the future, so the entry is pending again.
    assert entries[0]["reviews"] == [] and entries[0]["status"] == "pending"

    set_time(client, "2026-01-12T09:00:00Z")  # boundary: created_at == now is visible
    entries = client.get(f"/api/teams/{team_id}/entries").json()
    assert [e["description"] for e in entries] == ["new", "old"]
    assert entries[1]["status"] == "confirmed"


def test_cannot_review_future_entry(client):
    team_id, (ana, ben) = make_team(client, 2)
    set_time(client, "2026-01-12T09:00:00Z")
    e = add_entry(client, team_id, ana)
    set_time(client, "2026-01-11T09:00:00Z")
    assert review(client, e["id"], ben).status_code == 404


def test_double_review_blocked_even_if_first_review_is_in_future(client):
    team_id, (ana, ben) = make_team(client, 2)
    set_time(client, "2026-01-10T09:00:00Z")
    e = add_entry(client, team_id, ana)
    set_time(client, "2026-01-12T09:00:00Z")
    review(client, e["id"], ben)
    set_time(client, "2026-01-11T09:00:00Z")
    assert_400(review(client, e["id"], ben), "already reviewed")


# Append-only


def test_no_update_or_delete_routes_for_entries_or_reviews():
    for route in app.routes:
        path = getattr(route, "path", "")
        if "entries" in path or "reviews" in path:
            assert route.methods <= {"GET", "POST", "HEAD"}, (path, route.methods)
