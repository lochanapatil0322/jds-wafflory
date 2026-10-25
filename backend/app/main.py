from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from . import models  # noqa: F401
from .routers import admin, auth, menu, orders

Base.metadata.create_all(bind=engine)

app = FastAPI(title="JD's Wafflory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/")
def home():
    return {"message": "JD's Wafflory backend is running"}