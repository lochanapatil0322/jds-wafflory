from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])

MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15

# phone -> {"count": failed attempts so far, "locked_until": datetime or None}
failed_logins: dict[str, dict] = {}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # The form field is called "username", but we use the phone number as the username
    phone = form.username.strip()
    now = datetime.now(timezone.utc)

    record = failed_logins.get(phone)
    if record and record["locked_until"] and record["locked_until"] > now:
        raise HTTPException(
            status_code=429,
            detail=f"Too many wrong attempts. Please try again after {LOCK_MINUTES} minutes.",
        )

    user = db.query(models.User).filter(models.User.phone == phone).first()

    if user is None or not verify_password(form.password, user.password_hash):
        record = failed_logins.setdefault(phone, {"count": 0, "locked_until": None})
        record["count"] += 1
        if record["count"] >= MAX_FAILED_ATTEMPTS:
            record["locked_until"] = now + timedelta(minutes=LOCK_MINUTES)
            record["count"] = 0
        # Same message whether the phone or the password was wrong
        raise HTTPException(status_code=401, detail="Wrong phone number or password.")

    failed_logins.pop(phone, None)
    return {
        "access_token": create_access_token(user.id, user.role),
        "token_type": "bearer",
        "name": user.name,
        "role": user.role,
    }


@router.get("/me")
def who_am_i(user: models.User = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "role": user.role, "branch_id": user.branch_id}


@router.get("/owner-check")
def owner_check(user: models.User = Depends(require_roles("owner"))):
    return {"message": f"Welcome, {user.name}. You are the owner."}