from fastapi import APIRouter

from app.schemas import DemoTimeIn, DemoTimeOut
from app.services import clock

router = APIRouter(prefix="/api/demo")


def _time_out() -> DemoTimeOut:
    return DemoTimeOut(now=clock.now(), overridden=clock.is_overridden())


@router.get("/time", response_model=DemoTimeOut)
def get_time():
    return _time_out()


@router.post("/time", response_model=DemoTimeOut)
def set_time(body: DemoTimeIn):
    if body.now is None:
        clock.clear_override()
    else:
        clock.set_override(body.now)
    # B6: run due checkpoint evaluation here.
    return _time_out()
