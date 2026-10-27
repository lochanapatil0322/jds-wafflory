import os
from getpass import getpass

os.environ["DATABASE_URL"] = getpass("Paste the Neon connection string (hidden), then press Enter: ").strip()

from app import models
from app.database import SessionLocal, engine

host = engine.url.host or ""
print("Database:", host)
if not host.endswith("neon.tech"):
    print("This is not the online database, so nothing was changed.")
    raise SystemExit

FIXES = {"DoubleChocolate Strawberry": "Double Chocolate Strawberry"}

db = SessionLocal()
try:
    for old, new in FIXES.items():
        item = db.query(models.Item).filter(models.Item.name == old).first()
        if item is None:
            print(f"Not found: {old}")
        else:
            item.name = new
            print(f"Renamed: {old} -> {new}")
    db.commit()
finally:
    db.close()