from datetime import time

from pydantic import BaseModel


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