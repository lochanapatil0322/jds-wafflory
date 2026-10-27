import os
from getpass import getpass

os.environ["DATABASE_URL"] = getpass("Neon connection string paste kara (disnar nahi), mag Enter: ").strip()

from app import models
from app.database import SessionLocal, engine

host = engine.url.host or ""
print("Database:", host)
if not host.endswith("neon.tech"):
    print("He online database nahi, mhanun kahi delete kele nahi.")
    raise SystemExit

db = SessionLocal()
try:
    count = db.query(models.Order).count()
    print(f"Ya database madhe {count} order(s) aahet.")
    if count == 0:
        raise SystemExit
    if input("Sagle orders delete karayche? DELETE type kara: ").strip() != "DELETE":
        print("Kahi delete kele nahi.")
        raise SystemExit
    db.query(models.OrderItem).delete()
    db.query(models.Order).delete()
    db.commit()
    print("Sagle orders delete jhale.")
finally:
    db.close()