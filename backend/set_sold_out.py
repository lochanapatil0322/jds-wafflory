import sys

from app.database import SessionLocal
from app import models

if len(sys.argv) != 4:
    print("Use:  python set_sold_out.py <branch_id> <item_id> <0 or 1>")
    print("0 = sold out, 1 = available")
    sys.exit()

branch_id, item_id, value = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])

db = SessionLocal()
row = db.query(models.BranchAvailability).filter_by(branch_id=branch_id, item_id=item_id).first()
if row is None:
    print("No such branch/item combination.")
else:
    row.is_available = bool(value)
    db.commit()
    print(f"Branch {branch_id}, item {item_id}: {'available' if value else 'SOLD OUT'}")
db.close()