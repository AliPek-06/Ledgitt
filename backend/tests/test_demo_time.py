def test_get_time_default(client):
    body = client.get("/api/demo/time").json()
    assert body["overridden"] is False
    assert body["now"]


def test_set_and_clear_time(client):
    res = client.post("/api/demo/time", json={"now": "2026-01-10T09:30:00"})
    assert res.status_code == 200
    assert res.json() == {"now": "2026-01-10T09:30:00Z", "overridden": True}
    assert client.get("/api/demo/time").json() == {"now": "2026-01-10T09:30:00Z", "overridden": True}

    res = client.post("/api/demo/time", json={"now": None})
    assert res.json()["overridden"] is False
    assert client.get("/api/demo/time").json()["now"] != "2026-01-10T09:30:00Z"


def test_set_time_with_timezone(client):
    res = client.post("/api/demo/time", json={"now": "2026-01-10T11:30:00+02:00"})
    assert res.json()["now"] == "2026-01-10T09:30:00Z"
