import pytest

from app.routers.documents import is_flagged
from tests.test_ledger import make_team, set_time


def assert_status(res, code, fragment=""):
    assert res.status_code == code, res.text
    if fragment:
        assert fragment in res.json()["detail"]


# Document


def test_first_get_creates_empty_document(client):
    team_id, _ = make_team(client, 1)
    set_time(client, "2026-01-10T09:00:00Z")
    res = client.get(f"/api/teams/{team_id}/document")
    assert res.status_code == 200
    assert res.json() == {"team_id": team_id, "content_html": "", "content_text": "",
                          "updated_at": "2026-01-10T09:00:00Z", "updated_by": None}
    # A second GET returns the same document rather than a new one.
    set_time(client, "2026-01-11T09:00:00Z")
    assert client.get(f"/api/teams/{team_id}/document").json()["updated_at"] == "2026-01-10T09:00:00Z"


def test_document_saves_and_loads(client):
    team_id, (ana,) = make_team(client, 1)
    set_time(client, "2026-01-10T09:00:00Z")
    body = {"member_id": ana, "content_html": "<p>Hello</p>", "content_text": "Hello"}
    res = client.put(f"/api/teams/{team_id}/document", json=body)
    assert res.status_code == 200
    loaded = client.get(f"/api/teams/{team_id}/document").json()
    assert loaded["content_html"] == "<p>Hello</p>"
    assert loaded["content_text"] == "Hello"
    assert loaded["updated_by"] == ana
    assert loaded["updated_at"] == "2026-01-10T09:00:00Z"


def test_document_save_overwrites(client):
    team_id, (ana, ben) = make_team(client, 2)
    client.put(f"/api/teams/{team_id}/document", json={"member_id": ana, "content_html": "a", "content_text": "a"})
    client.put(f"/api/teams/{team_id}/document", json={"member_id": ben, "content_html": "b", "content_text": "b"})
    doc = client.get(f"/api/teams/{team_id}/document").json()
    assert doc["content_text"] == "b" and doc["updated_by"] == ben


def test_document_save_requires_team_member(client):
    team_id, _ = make_team(client, 1)
    _, (outsider,) = make_team(client, 1)
    res = client.put(f"/api/teams/{team_id}/document",
                     json={"member_id": outsider, "content_html": "", "content_text": ""})
    assert_status(res, 400, "not in this team")


def test_document_unknown_team_404(client):
    assert client.get("/api/teams/999/document").status_code == 404


# Pastes


def paste(client, team_id, member_id, **overrides):
    body = {"member_id": member_id, "kind": "paste", "char_count": 250,
            "preview": "Some pasted text", "is_internal": False, **overrides}
    return client.post(f"/api/teams/{team_id}/pastes", json=body)


@pytest.mark.parametrize("is_internal,label,expected", [
    (False, None, True),
    (False, "quote", False),
    (True, None, False),
    (True, "quote", False),
])
def test_flagged_rule(is_internal, label, expected):
    assert is_flagged(is_internal, label) is expected


def test_unlabelled_external_paste_is_flagged(client):
    team_id, (ana,) = make_team(client, 1)
    res = paste(client, team_id, ana)
    assert res.status_code == 201
    assert res.json()["flagged"] is True and res.json()["label"] is None


def test_internal_paste_not_flagged(client):
    team_id, (ana,) = make_team(client, 1)
    assert paste(client, team_id, ana, is_internal=True).json()["flagged"] is False


def test_paste_labelled_on_create_not_flagged(client):
    team_id, (ana,) = make_team(client, 1)
    assert paste(client, team_id, ana, label="my_notes").json()["flagged"] is False


def test_burst_is_stored(client):
    team_id, (ana,) = make_team(client, 1)
    assert paste(client, team_id, ana, kind="burst", char_count=320).json()["kind"] == "burst"


def test_preview_truncated_to_120_chars(client):
    team_id, (ana,) = make_team(client, 1)
    assert len(paste(client, team_id, ana, preview="x" * 500).json()["preview"]) == 120


@pytest.mark.parametrize("overrides,fragment", [
    ({"kind": "drop"}, "kind"),
    ({"label": "stolen"}, "label"),
    ({"char_count": -1}, "char_count"),
])
def test_invalid_paste_rejected(client, overrides, fragment):
    team_id, (ana,) = make_team(client, 1)
    assert_status(paste(client, team_id, ana, **overrides), 400, fragment)


def test_paste_member_must_be_in_team(client):
    team_id, _ = make_team(client, 1)
    _, (outsider,) = make_team(client, 1)
    assert_status(paste(client, team_id, outsider), 400, "not in this team")


# Labelling


def label(client, paste_id, member_id, label="quote", note=""):
    return client.patch(f"/api/pastes/{paste_id}/label",
                        json={"member_id": member_id, "label": label, "label_note": note})


def test_labelling_clears_flag(client):
    team_id, (ana,) = make_team(client, 1)
    p = paste(client, team_id, ana).json()
    res = label(client, p["id"], ana, "quote", "From the course reader")
    assert res.status_code == 200
    body = res.json()
    assert body["flagged"] is False
    assert body["label"] == "quote" and body["label_note"] == "From the course reader"
    assert client.get(f"/api/teams/{team_id}/pastes").json()[0]["flagged"] is False


def test_only_original_member_can_label(client):
    team_id, (ana, ben) = make_team(client, 2)
    p = paste(client, team_id, ana).json()
    assert_status(label(client, p["id"], ben), 403, "Only the member who pasted")
    assert client.get(f"/api/teams/{team_id}/pastes").json()[0]["flagged"] is True


def test_label_must_be_valid(client):
    team_id, (ana,) = make_team(client, 1)
    p = paste(client, team_id, ana).json()
    assert_status(label(client, p["id"], ana, "whatever"), 400, "label")


def test_label_unknown_paste_404(client):
    _, (ana,) = make_team(client, 1)
    assert label(client, 999, ana).status_code == 404


# Listing


def test_list_excludes_internal_newest_first(client):
    team_id, (ana,) = make_team(client, 1)
    set_time(client, "2026-01-10T09:00:00Z")
    paste(client, team_id, ana, preview="first")
    set_time(client, "2026-01-11T09:00:00Z")
    paste(client, team_id, ana, preview="internal", is_internal=True)
    set_time(client, "2026-01-12T09:00:00Z")
    paste(client, team_id, ana, preview="second")
    previews = [p["preview"] for p in client.get(f"/api/teams/{team_id}/pastes").json()]
    assert previews == ["second", "first"]


def test_list_hides_future_pastes(client):
    team_id, (ana,) = make_team(client, 1)
    set_time(client, "2026-01-10T09:00:00Z")
    paste(client, team_id, ana, preview="old")
    set_time(client, "2026-01-12T09:00:00Z")
    p = paste(client, team_id, ana, preview="new").json()
    set_time(client, "2026-01-11T09:00:00Z")
    assert [x["preview"] for x in client.get(f"/api/teams/{team_id}/pastes").json()] == ["old"]
    assert label(client, p["id"], ana).status_code == 404
