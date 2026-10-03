from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.routers.overview import get_overview
from app.schemas import DemoTimeIn, DemoTimeOut, OverviewOut
from app.services import clock
from app.services.checkpoints import evaluate_all_teams
from app.services.seed import reset_db, seed

router = APIRouter(prefix="/api/demo")


def _time_out() -> DemoTimeOut:
    return DemoTimeOut(now=clock.now(), overridden=clock.is_overridden())


@router.get("/time", response_model=DemoTimeOut)
def get_time():
    return _time_out()


@router.post("/time", response_model=DemoTimeOut)
def set_time(body: DemoTimeIn, session: Session = Depends(get_session)):
    if body.now is None:
        clock.clear_override()
    else:
        clock.set_override(body.now)
    evaluate_all_teams(session)
    return _time_out()


@router.post("/reset")
def reset(session: Session = Depends(get_session)):
    """Wipe every table and return the clock to real time."""
    reset_db(session)
    return {"ok": True}


@router.post("/seed", response_model=OverviewOut)
def seed_demo(session: Session = Depends(get_session)):
    """Reset, load the demo story and set the clock to t=0.20. Returns the overview."""
    a = seed(session)
    return get_overview(a.id, session)
