from app import models
from app.database import SessionLocal, engine

print("Database:", engine.url.host or "local file on this computer")

db = SessionLocal()
try:
    users = db.query(models.User).order_by(models.User.id).all()
    if not users:
        print("There are no accounts.")
        raise SystemExit

    print("\nAccounts:")
    for u in users:
        print(f"  id {u.id}: {u.name} | phone {u.phone} | {u.role} | branch {u.branch_id}")

    choice = input("\nType the id of the account to delete (or press Enter to cancel): ").strip()
    if not choice.isdigit():
        print("Cancelled.")
        raise SystemExit

    user = db.get(models.User, int(choice))
    if user is None:
        print("No account has that id.")
        raise SystemExit

    owners = [u for u in users if u.role == "owner"]
    if user.role == "owner" and len(owners) == 1:
        print("This is the only owner account, so it cannot be deleted.")
        raise SystemExit

    check = input(f"To delete {user.name} ({user.role}), type their phone number {user.phone} to confirm: ").strip()
    if check != user.phone:
        print("That did not match. Nothing was deleted.")
        raise SystemExit

    db.delete(user)
    db.commit()
    print("Deleted.")
finally:
    db.close()