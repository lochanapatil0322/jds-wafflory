from datetime import datetime
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