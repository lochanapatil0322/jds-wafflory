from getpass import getpass

from passlib.context import CryptContext

from app.database import SessionLocal
from app import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_user(db, role):
    print(f"\n--- Create {role} account ---")
    name = input("Name: ").strip()
    phone = input("Phone number (used to log in): ").strip()

    if db.query(models.User).filter_by(phone=phone).first():
        print("A user with this phone already exists. Skipped.")
        return

    password = getpass("Password (at least 8 characters): ")
    if len(password) < 8:
        print("Password too short. Skipped.")
        return
    if password != getpass("Type the password again: "):
        print("Passwords did not match. Skipped.")
        return

    branch_id = None
    if role == "staff":
        answer = input("Branch id (1 = Digha Station, 2 = Mindspace, blank = both): ").strip()
        branch_id = int(answer) if answer else None

    db.add(
        models.User(
            name=name,
            phone=phone,
            password_hash=pwd_context.hash(password),
            role=role,
            branch_id=branch_id,
        )
    )
    db.commit()
    print(f"{role.capitalize()} account created.")


def main():
    db = SessionLocal()
    try:
        create_user(db, "owner")
        if input("\nCreate the staff account too? (y/n): ").strip().lower() == "y":
            create_user(db, "staff")
    finally:
        db.close()


if __name__ == "__main__":
    main()