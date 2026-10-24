from fastapi import FastAPI

from .database import Base, engine
from . import models  # noqa: F401
from .routers import admin, auth, menu, orders

Base.metadata.create_all(bind=engine)

app = FastAPI(title="JD's Wafflory API")

app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/")
def home():
    return {"message": "JD's Wafflory backend is running"}