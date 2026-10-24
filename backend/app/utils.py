from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    return datetime.now(IST)


def is_branch_open(branch, now: datetime | None = None) -> bool:
    current = (now or now_ist()).time()
    opens, closes = branch.open_time, branch.close_time

    if opens < closes:
        # Normal day, for example 10:00 to 22:00
        return opens <= current < closes

    # Closing time is after midnight, for example 18:00 to 00:00
    return current >= opens or current < closes


def closing_datetime(branch, now: datetime | None = None) -> datetime:
    """The exact date and time this branch closes for the current opening period."""
    now = now or now_ist()
    close = now.replace(
        hour=branch.close_time.hour,
        minute=branch.close_time.minute,
        second=0,
        microsecond=0,
    )
    # Shop opens at 18:00 and closes at 00:00, so closing is tomorrow's midnight
    if branch.close_time <= branch.open_time and now.time() >= branch.open_time:
        close += timedelta(days=1)
    return close