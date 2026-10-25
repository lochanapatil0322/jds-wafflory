from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..ratelimit import AttemptLimiter
from ..security import create_access_token, pwd_context, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])

MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15

# phone -> {"count": failed attempts so far, "locked_until": datetime or None}
failed_logins: dict[str, dict] = {}

# A second wall: one connection may only fail 20 logins in 15 minutes,
# even if it tries a different phone number every time
ip_login_limiter = AttemptLimiter(
    20, 900, "Too many failed logins from this connection. Please try again in 15 minutes."
)

# Used when the phone number does not exist, so a wrong phone number and a wrong
# password take the same time and nobody can learn which phone numbers have accounts
DUMMY_HASH = pwd_context.hash("not-a-real-password")


@router.post("/login")
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip_login_limiter.check(request)

    # The form field is called "username", but we use the phone number as the username
    phone = form.username.strip()
    key = phone[:15]  # keeps the lock list from filling up with huge keys
    now = datetime.now(timezone.utc)

    record = failed_logins.get(key)
    if record and record["locked_until"] and record["locked_until"] > now:
        raise HTTPException(
            status_code=429,
            detail=f"Too many wrong attempts. Please try again after {LOCK_MINUTES} minutes.",
        )

    user = None
    if len(phone) <= 15:
        user = db.query(models.User).filter(models.User.phone == phone).first()

    too_long = len(form.password) > 128
    hash_to_check = user.password_hash if user else DUMMY_HASH
    matches = verify_password("" if too_long else form.password, hash_to_check)

    if not (matches and user is not None and not too_long):
        ip_login_limiter.record_failure(request)
        record = failed_logins.setdefault(key, {"count": 0, "locked_until": None})
        record["count"] += 1
        if record["count"] >= MAX_FAILED_ATTEMPTS:
            record["locked_until"] = now + timedelta(minutes=LOCK_MINUTES)
            record["count"] = 0
        # Same message whether the phone or the password was wrong
        raise HTTPException(status_code=401, detail="Wrong phone number or password.")

    failed_logins.pop(key, None)
    return {
        "access_token": create_access_token(user.id, user.role),
        "token_type": "bearer",
        "name": user.name,
        "role": user.role,
    }


@router.get("/me")
def who_am_i(user: models.User = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "role": user.role, "branch_id": user.branch_id}