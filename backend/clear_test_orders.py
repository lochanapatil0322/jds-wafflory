from app.database import SessionLocal
from app import models

db = SessionLocal()
db.query(models.OrderItem).delete()
db.query(models.Order).delete()
db.commit()
db.close()
print("All orders deleted.")