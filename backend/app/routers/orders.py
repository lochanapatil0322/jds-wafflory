import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..ratelimit import AttemptLimiter, KeyedAttemptLimiter, RateLimiter
from ..utils import closing_datetime, is_branch_open, now_ist

router = APIRouter(prefix="/orders", tags=["Orders"])

order_limiter = RateLimiter(
    30, 600, "Too many orders from this connection. Please wait a few minutes and try again."
)
lookup_limiter = AttemptLimiter(10, 900, "Too many wrong lookups. Please try again in 15 minutes.")
order_lookup_limiter = KeyedAttemptLimiter(
    8, 900, "Too many wrong tries for this order. Please try again in 15 minutes."
)

PARCEL_CHARGE = 10  # rupees, per order
MAX_ACTIVE_ORDERS_PER_PHONE = 3
ACTIVE_STATUSES = ("received", "preparing", "ready")


def build_order_out(order: models.Order) -> schemas.OrderOut:
    lines = [
        schemas.OrderLineOut(
            item_name=line.item.name,
            variant_label=line.variant.label,
            quantity=line.quantity,
            unit_price=line.unit_price,
            line_total=line.unit_price * line.quantity,
        )
        for line in order.items
    ]
    return schemas.OrderOut(
        id=order.id,
        branch_name=order.branch.name,
        customer_name=order.customer_name,
        order_type=order.order_type,
        status=order.status,
        payment_status=order.payment_status,
        pickup_time=order.pickup_time,
        created_at=order.created_at,
        items=lines,
        parcel_charge=order.parcel_charge,
        total=order.total,
    )


@router.post(
    "", response_model=schemas.OrderOut, status_code=201, dependencies=[Depends(order_limiter)]
)
def place_order(data: schemas.OrderCreate, db: Session = Depends(get_db)):
    # 1. The branch must exist
    branch = db.get(models.Branch, data.branch_id)
    if branch is None or not branch.is_active:
        raise HTTPException(status_code=404, detail="Branch not found")

    # 2. The branch must be open right now
    now = now_ist()
    if not is_branch_open(branch, now):
        raise HTTPException(
            status_code=400,
            detail=(
                f"{branch.name} is closed right now. "
                f"We are open from {branch.open_time:%I:%M %p} to {branch.close_time:%I:%M %p}."
            ),
        )

    # 3. The pickup time must be before closing
    pickup_time = now + timedelta(minutes=data.pickup_in_minutes)
    if pickup_time > closing_datetime(branch, now):
        raise HTTPException(
            status_code=400,
            detail="That pickup time is after closing time. Please choose an earlier pickup.",
        )

    # 4. Protection against spam orders from one phone number
    active_orders = (
        db.query(models.Order)
        .filter(
            models.Order.customer_phone == data.customer_phone,
            models.Order.status.in_(ACTIVE_STATUSES),
        )
        .count()
    )
    if active_orders >= MAX_ACTIVE_ORDERS_PER_PHONE:
        raise HTTPException(
            status_code=429,
            detail="You already have 3 active orders. Please collect them before ordering again.",
        )

    # 5. Load the real prices from the database
    variant_ids = {line.variant_id for line in data.items}
    variants = {
        v.id: v
        for v in db.query(models.ItemVariant)
        .options(selectinload(models.ItemVariant.item))
        .filter(models.ItemVariant.id.in_(variant_ids))
    }
    availability = {
        row.item_id: row.is_available
        for row in db.query(models.BranchAvailability).filter_by(branch_id=branch.id)
    }

    # 6. Check every line and calculate the total on the server
    order_lines = []
    subtotal = 0
    for line in data.items:
        variant = variants.get(line.variant_id)
        if variant is None or variant.item_id != line.item_id or not variant.item.is_active:
            raise HTTPException(status_code=400, detail="One of the items is not on the menu.")
        if not availability.get(variant.item_id, True):
            raise HTTPException(
                status_code=400,
                detail=f"{variant.item.name} is sold out at {branch.name}.",
            )
        subtotal += variant.price * line.quantity
        order_lines.append((variant, line.quantity))

    parcel_charge = PARCEL_CHARGE if data.order_type == "parcel" else 0

    # 7. Save the order and its items
    order = models.Order(
        branch_id=branch.id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        order_type=data.order_type,
        parcel_charge=parcel_charge,
        pickup_time=pickup_time.replace(tzinfo=None),  # stored as Indian time
        status="received",
        payment_status="unpaid",
        total=subtotal + parcel_charge,
        created_at=now.replace(tzinfo=None),  # stored as Indian time
    )
    db.add(order)
    db.flush()  # gives the order its id

    for variant, quantity in order_lines:
        db.add(
            models.OrderItem(
                order_id=order.id,
                item_id=variant.item_id,
                variant_id=variant.id,
                quantity=quantity,
                unit_price=variant.price,  # the price at the time of the order
            )
        )

    db.commit()
    db.refresh(order)
    return build_order_out(order)


@router.get("/{order_id}", response_model=schemas.OrderOut)
def track_order(
    order_id: int,
    request: Request,
    phone: str = Query(..., max_length=15),
    db: Session = Depends(get_db),
):
    lookup_limiter.check(request)
    order_lookup_limiter.check(order_id)

    order = db.get(models.Order, order_id)
    # compare_digest compares in constant time, so the time taken reveals nothing
    phone_matches = order is not None and secrets.compare_digest(
        order.customer_phone.encode(), phone.strip().encode()
    )
    # The same message for "no such order" and "wrong phone", so nobody can use
    # this route to find out which order numbers exist
    if not phone_matches:
        lookup_limiter.record_failure(request)
        order_lookup_limiter.record_failure(order_id)
        raise HTTPException(status_code=404, detail="Order not found")
    return build_order_out(order)