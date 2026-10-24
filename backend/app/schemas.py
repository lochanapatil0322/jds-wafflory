from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Menu ----------

class BranchOut(BaseModel):
    id: int
    name: str
    address: str
    open_time: time
    close_time: time
    is_open: bool


class VariantOut(BaseModel):
    id: int
    label: str
    price: int


class ItemOut(BaseModel):
    id: int
    name: str
    description: str | None
    image_url: str | None
    is_available: bool
    variants: list[VariantOut]


class CategoryOut(BaseModel):
    id: int
    name: str
    items: list[ItemOut]


class MenuOut(BaseModel):
    branch_id: int
    is_open: bool
    categories: list[CategoryOut]


# ---------- Orders ----------

class OrderLineIn(BaseModel):
    item_id: int
    variant_id: int
    quantity: int = Field(ge=1, le=20)


class OrderCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    branch_id: int
    customer_name: str = Field(min_length=2, max_length=100)
    customer_phone: str = Field(pattern=r"^[6-9][0-9]{9}$")  # 10-digit Indian mobile
    order_type: Literal["dine_in", "parcel"]
    pickup_in_minutes: Literal[10, 15, 20, 30, 45, 60]
    items: list[OrderLineIn] = Field(min_length=1, max_length=30)


class OrderLineOut(BaseModel):
    item_name: str
    variant_label: str
    quantity: int
    unit_price: int
    line_total: int


class OrderOut(BaseModel):
    id: int
    branch_name: str
    customer_name: str
    order_type: str
    status: str
    payment_status: str
    pickup_time: datetime | None
    created_at: datetime
    items: list[OrderLineOut]
    parcel_charge: int
    total: int
class OrderStatusUpdate(BaseModel):
    status: Literal["preparing", "ready", "completed", "cancelled"]


class AdminOrderOut(OrderOut):
    branch_id: int
    customer_phone: str