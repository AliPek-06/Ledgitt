from sqlmodel import SQLModel


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_all_tables_exist(session):
    expected = {
        "assignment", "team", "member", "charteritem", "entry", "review",
        "document", "pasteevent", "alert", "memberstreak", "evaluatedcheckpoint",
    }
    assert expected <= set(SQLModel.metadata.tables)
