import sys
from datetime import time

from app.database import SessionLocal
from app import models

mode = sys.argv[1] if len(sys.argv) > 1 else ""

if mode == "test":
    opens, closes = time(0, 0), time(23, 59)
elif mode == "normal":
    opens, closes = time(18, 0), time(0, 0)
else:
    print("Use:  python set_hours.py test    or    python set_hours.py normal")
    sys.exit()

db = SessionLocal()
for branch in db.query(models.Branch).all():
    branch.open_time = opens
    branch.close_time = closes
db.commit()
db.close()
print(f"Both branches now open {opens:%H:%M} to {closes:%H:%M}  ({mode} mode)")