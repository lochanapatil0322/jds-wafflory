from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..utils import is_branch_open

router = APIRouter(tags=["Menu"])


@router.get("/branches", response_model=list[schemas.BranchOut])
def list_branches(db: Session = Depends(get_db)):
    branches = (
        db.query(models.Branch)
        .filter(models.Branch.is_active.is_(True))
        .order_by(models.Branch.id)
        .all()
    )
    return [
        schemas.BranchOut(
            id=b.id,
            name=b.name,
            address=b.address,
            open_time=b.open_time,
            close_time=b.close_time,
            is_open=is_branch_open(b),
        )
        for b in branches
    ]


@router.get("/menu", response_model=schemas.MenuOut)
def get_menu(branch_id: int, db: Session = Depends(get_db)):
    branch = db.get(models.Branch, branch_id)
    if branch is None or not branch.is_active:
        raise HTTPException(status_code=404, detail="Branch not found")

    availability = {
        row.item_id: row.is_available
        for row in db.query(models.BranchAvailability).filter_by(branch_id=branch_id)
    }

    categories = (
        db.query(models.Category)
        .options(selectinload(models.Category.items).selectinload(models.Item.variants))
        .order_by(models.Category.display_order)
        .all()
    )

    result = []
    for category in categories:
        items = [
            schemas.ItemOut(
                id=item.id,
                name=item.name,
                description=item.description,
                image_url=item.image_url,
                is_available=availability.get(item.id, True),
                variants=[
                    schemas.VariantOut(id=v.id, label=v.label, price=v.price)
                    for v in sorted(item.variants, key=lambda v: v.price)
                ],
            )
            for item in sorted(category.items, key=lambda i: i.id)
            if item.is_active
        ]
        result.append(schemas.CategoryOut(id=category.id, name=category.name, items=items))

    return schemas.MenuOut(branch_id=branch.id, is_open=is_branch_open(branch), categories=result)