from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas import DemoTimeIn, DemoTimeOut
from app.services import clock
from app.services.checkpoints import evaluate_all_teams

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
