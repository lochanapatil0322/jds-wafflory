from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..deps import require_roles
from .orders import ACTIVE_STATUSES, build_order_out

router = APIRouter(prefix="/admin", tags=["Admin"])

# For each current status, which statuses it is allowed to move to
ALLOWED_CHANGES = {
    "received": {"preparing", "cancelled"},
    "preparing": {"ready", "cancelled"},
    "ready": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def to_admin_out(order: models.Order) -> schemas.AdminOrderOut:
    base = build_order_out(order)
    return schemas.AdminOrderOut(
        **base.model_dump(),
        branch_id=order.branch_id,
        customer_phone=order.customer_phone,
    )


def get_order_for_user(db: Session, order_id: int, user: models.User) -> models.Order:
    order = db.get(models.Order, order_id)
    # A staff member tied to one branch can only touch that branch's orders.
    # We say "not found" rather than "not allowed" so nothing is revealed.
    if order is None or (
        user.role == "staff" and user.branch_id is not None and order.branch_id != user.branch_id
    ):
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/orders", response_model=list[schemas.AdminOrderOut])
def list_orders(
    status: Literal["received", "preparing", "ready", "completed", "cancelled"] | None = None,
    branch_id: int | None = None,
    user: models.User = Depends(require_roles("owner", "staff")),
    db: Session = Depends(get_db),
):
    query = db.query(models.Order).options(
        selectinload(models.Order.items).selectinload(models.OrderItem.item),
        selectinload(models.Order.items).selectinload(models.OrderItem.variant),
        selectinload(models.Order.branch),
    )

    # Staff tied to one branch only ever see that branch
    if user.role == "staff" and user.branch_id is not None:
        branch_id = user.branch_id
    if branch_id is not None:
        query = query.filter(models.Order.branch_id == branch_id)

    if status:
        query = query.filter(models.Order.status == status)
        query = query.order_by(models.Order.created_at.desc())
    else:
        # Default view: orders still to be made or collected, oldest first
        query = query.filter(models.Order.status.in_(ACTIVE_STATUSES))
        query = query.order_by(models.Order.created_at.asc())

    return [to_admin_out(order) for order in query.all()]


@router.patch("/orders/{order_id}/status", response_model=schemas.AdminOrderOut)
def update_status(
    order_id: int,
    data: schemas.OrderStatusUpdate,
    user: models.User = Depends(require_roles("owner", "staff")),
    db: Session = Depends(get_db),
):
    order = get_order_for_user(db, order_id, user)

    if data.status not in ALLOWED_CHANGES[order.status]:
        raise HTTPException(
            status_code=400,
            detail=f"An order that is '{order.status}' cannot be changed to '{data.status}'.",
        )

    order.status = data.status
    db.commit()
    db.refresh(order)
    return to_admin_out(order)


@router.patch("/orders/{order_id}/paid", response_model=schemas.AdminOrderOut)
def mark_paid(
    order_id: int,
    user: models.User = Depends(require_roles("owner", "staff")),
    db: Session = Depends(get_db),
):
    order = get_order_for_user(db, order_id, user)

    if order.status == "cancelled":
        raise HTTPException(status_code=400, detail="A cancelled order cannot be marked as paid.")

    order.payment_status = "paid"
    db.commit()
    db.refresh(order)
    return to_admin_out(order)
# ---------- Menu management ----------

def to_item_out(item: models.Item, db: Session) -> schemas.AdminItemOut:
    rows = (
        db.query(models.BranchAvailability)
        .filter_by(item_id=item.id)
        .order_by(models.BranchAvailability.branch_id)
        .all()
    )
    return schemas.AdminItemOut(
        id=item.id,
        category_id=item.category_id,
        category_name=item.category.name,
        name=item.name,
        description=item.description,
        is_active=item.is_active,
        variants=[
            schemas.VariantOut(id=v.id, label=v.label, price=v.price)
            for v in sorted(item.variants, key=lambda v: v.price)
        ],
        availability=[
            schemas.BranchAvailabilityOut(branch_id=r.branch_id, is_available=r.is_available)
            for r in rows
        ],
    )


@router.get("/menu", response_model=list[schemas.AdminItemOut])
def admin_menu(
    user: models.User = Depends(require_roles("owner", "staff")),
    db: Session = Depends(get_db),
):
    items = (
        db.query(models.Item)
        .options(selectinload(models.Item.variants), selectinload(models.Item.category))
        .order_by(models.Item.category_id, models.Item.id)
        .all()
    )
    return [to_item_out(item, db) for item in items]


@router.patch("/availability", response_model=schemas.BranchAvailabilityOut)
def set_availability(
    data: schemas.AvailabilityUpdate,
    user: models.User = Depends(require_roles("owner", "staff")),
    db: Session = Depends(get_db),
):
    # Staff tied to one branch can only change that branch
    if user.role == "staff" and user.branch_id is not None and data.branch_id != user.branch_id:
        raise HTTPException(status_code=403, detail="You can only change your own branch.")

    row = (
        db.query(models.BranchAvailability)
        .filter_by(branch_id=data.branch_id, item_id=data.item_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Branch or item not found")

    row.is_available = data.is_available
    db.commit()
    return schemas.BranchAvailabilityOut(branch_id=row.branch_id, is_available=row.is_available)


@router.patch("/variants/{variant_id}/price", response_model=schemas.VariantOut)
def update_price(
    variant_id: int,
    data: schemas.PriceUpdate,
    user: models.User = Depends(require_roles("owner")),
    db: Session = Depends(get_db),
):
    variant = db.get(models.ItemVariant, variant_id)
    if variant is None:
        raise HTTPException(status_code=404, detail="Size not found")

    variant.price = data.price
    db.commit()
    return schemas.VariantOut(id=variant.id, label=variant.label, price=variant.price)


@router.post("/items", response_model=schemas.AdminItemOut, status_code=201)
def create_item(
    data: schemas.ItemCreate,
    user: models.User = Depends(require_roles("owner")),
    db: Session = Depends(get_db),
):
    if db.get(models.Category, data.category_id) is None:
        raise HTTPException(status_code=404, detail="Category not found")

    labels = [v.label.lower() for v in data.variants]
    if len(set(labels)) != len(labels):
        raise HTTPException(status_code=400, detail="Two sizes cannot have the same name.")

    item = models.Item(
        category_id=data.category_id, name=data.name, description=data.description
    )
    db.add(item)
    db.flush()  # gives the item its id

    for v in data.variants:
        db.add(models.ItemVariant(item_id=item.id, label=v.label, price=v.price))

    # A new item starts as available at every branch
    for branch in db.query(models.Branch).all():
        db.add(
            models.BranchAvailability(branch_id=branch.id, item_id=item.id, is_available=True)
        )

    db.commit()
    db.refresh(item)
    return to_item_out(item, db)


@router.patch("/items/{item_id}", response_model=schemas.AdminItemOut)
def update_item(
    item_id: int,
    data: schemas.ItemUpdate,
    user: models.User = Depends(require_roles("owner")),
    db: Session = Depends(get_db),
):
    item = db.get(models.Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field != "description":
            continue  # a blank name or blank is_active is ignored
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return to_item_out(item, db)