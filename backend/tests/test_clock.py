from datetime import datetime, timedelta, timezone

from app.services import clock


def test_now_is_real_utc_without_override():
    real = datetime.now(timezone.utc)
    assert abs(clock.now() - real) < timedelta(seconds=5)
    assert not clock.is_overridden()


def test_override_and_clear():
    dt = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
    clock.set_override(dt)
    assert clock.now() == dt
    assert clock.is_overridden()
    clock.clear_override()
    assert clock.now() != dt
    assert not clock.is_overridden()


def test_override_with_offset_is_converted_to_utc():
    clock.set_override(datetime(2026, 1, 15, 14, 0, tzinfo=timezone(timedelta(hours=2))))
    assert clock.now() == datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)


def test_naive_override_is_treated_as_utc():
    clock.set_override(datetime(2026, 1, 15, 12, 0))
    assert clock.now() == datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
