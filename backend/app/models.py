from datetime import datetime, time
from sqlalchemy import ForeignKey, String, Integer, Boolean, Time, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(255))
    open_time: Mapped[time] = mapped_column(Time)
    close_time: Mapped[time] = mapped_column(Time)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(15), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))  # "owner" or "staff"
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), nullable=True)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    items: Mapped[list["Item"]] = relationship(back_populates="category")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["Category"] = relationship(back_populates="items")
    variants: Mapped[list["ItemVariant"]] = relationship(back_populates="item")


class ItemVariant(Base):
    __tablename__ = "item_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    label: Mapped[str] = mapped_column(String(50))  # Regular / Personal / Sharing
    price: Mapped[int] = mapped_column(Integer)  # in rupees

    item: Mapped["Item"] = relationship(back_populates="variants")


class BranchAvailability(Base):
    __tablename__ = "branch_availability"
    __table_args__ = (UniqueConstraint("branch_id", "item_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    customer_name: Mapped[str] = mapped_column(String(100))
    customer_phone: Mapped[str] = mapped_column(String(15))
    order_type: Mapped[str] = mapped_column(String(20))  # "dine_in" or "parcel"
    parcel_charge: Mapped[int] = mapped_column(Integer, default=0)
    pickup_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="received")
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")
    total: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["OrderItem"]] = relationship(back_populates="order")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order")
    branch: Mapped["Branch"] = relationship()


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("item_variants.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer)  # price at the time of order

    order: Mapped["Order"] = relationship(back_populates="items")
    order: Mapped["Order"] = relationship(back_populates="items")
    item: Mapped["Item"] = relationship()
    variant: Mapped["ItemVariant"] = relationship()