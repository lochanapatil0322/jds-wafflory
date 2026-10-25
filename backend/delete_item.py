import sys

from app.database import SessionLocal
from app import models

if len(sys.argv) != 2:
    print("Use:  python delete_item.py <item_id>")
    sys.exit()

item_id = int(sys.argv[1])
db = SessionLocal()
item = db.get(models.Item, item_id)

if item is None:
    print("No such item.")
elif db.query(models.OrderItem).filter_by(item_id=item_id).first():
    print("This item is in an order, so it cannot be deleted. Hide it instead.")
else:
    db.query(models.BranchAvailability).filter_by(item_id=item_id).delete()
    db.query(models.ItemVariant).filter_by(item_id=item_id).delete()
    db.delete(item)
    db.commit()
    print(f"Deleted item {item_id}: {item.name}")
db.close()