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