from datetime import time

from app.database import Base, SessionLocal, engine
from app import models

# (name, price) -> one price
# (name, personal_price, sharing_price) -> bowls with two sizes
MENU = {
    "Waffle Pop": [
        ("Dark Chocolate Pop", 59),
        ("White Chocolate Pop", 59),
        ("Milk Chocolate Pop", 59),
        ("Triple Chocolate Pop", 69),
        ("Butterscotch Pop", 69),
        ("KitKat Chocolate Pop", 79),
        ("Oreo Chocolate Pop", 79),
        ("Nutella Chocolate Pop", 89),
        ("Belgian Hazelnut Pop", 99),
        ("Lotus Biscoff Pop", 99),
    ],
    "Waffle Chocolate Sandwich": [
        ("Dark Chocolate Sandwich", 99),
        ("White Chocolate Sandwich", 109),
        ("Milk Chocolate Sandwich", 109),
        ("Butterscotch Sandwich", 119),
        ("Double Chocolate Sandwich", 129),
        ("Triple Chocolate Sandwich", 139),
        ("Oreo Chocolate Sandwich", 149),
        ("KitKat Chocolate Sandwich", 149),
        ("Cookie Crunchy Sandwich", 159),
        ("KitKat Nutella Sandwich", 179),
        ("Hazelnut Sandwich", 189),
        ("Lotus Biscoff Sandwich", 199),
    ],
    "Chocolate Cake Bowl": [
        ("Dark Chocolate Bowl", 69, 129),
        ("Milk Chocolate Bowl", 69, 129),
        ("Double Chocolate Bowl", 79, 139),
        ("Triple Chocolate Bowl", 89, 159),
        ("Oreo Chocolate Bowl", 89, 159),
        ("KitKat Chocolate Bowl", 99, 169),
        ("Nutella KitKat Bowl", 109, 189),
        ("Lotus Biscoff Bowl", 119, 219),
        ("Strawberry Loaded Bowl", 119, 219),
    ],
    "Strawberry Chocolate Glass": [
        ("Milk Chocolate Strawberry", 119),
        ("Dark Chocolate Strawberry", 119),
        ("White Chocolate Strawberry", 119),
        ("Double Chocolate Strawberry", 149),
        ("KitKat Chocolate Strawberry", 159),
        ("Triple Chocolate Strawberry", 169),
    ],
}


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.Branch).first():
            print("Database already has data. Nothing was added.")
            return

        branches = [
            models.Branch(
                name="Digha Station",
                address="Near Digha Railway Station, Navi Mumbai - 400708",
                open_time=time(18, 0),
                close_time=time(0, 0),
            ),
            models.Branch(
                name="Mindspace",
                address="Outside Mindspace, Navi Mumbai - 400708",
                open_time=time(18, 0),
                close_time=time(0, 0),
            ),
        ]
        db.add_all(branches)
        db.flush()  # gives each branch its id

        item_count = 0
        variant_count = 0

        for position, (category_name, rows) in enumerate(MENU.items(), start=1):
            category = models.Category(name=category_name, display_order=position)
            db.add(category)
            db.flush()

            for row in rows:
                item = models.Item(category_id=category.id, name=row[0])
                db.add(item)
                db.flush()
                item_count += 1

                if len(row) == 2:
                    variants = [("Regular", row[1])]
                else:
                    variants = [("Personal", row[1]), ("Sharing", row[2])]

                for label, price in variants:
                    db.add(models.ItemVariant(item_id=item.id, label=label, price=price))
                    variant_count += 1

                for branch in branches:
                    db.add(
                        models.BranchAvailability(
                            branch_id=branch.id, item_id=item.id, is_available=True
                        )
                    )

        db.commit()
        print(f"Done: 2 branches, {len(MENU)} categories, {item_count} items, {variant_count} variants.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()