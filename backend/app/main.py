from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import models  # noqa: F401
from .config import settings
from .database import Base, engine
from .routers import admin, auth, menu, orders

Base.metadata.create_all(bind=engine)

is_production = settings.ENVIRONMENT == "production"
if is_production and len(settings.SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY is too short. Use at least 32 random characters.")

app = FastAPI(
    title="JD's Wafflory API",
    # On the real server nobody needs the documentation pages
    docs_url=None if is_production else "/docs",
    redoc_url=None,
    openapi_url=None if is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    # Orders, logins and admin data must never be kept in a browser or proxy cache
    if request.url.path.startswith(("/auth", "/admin", "/orders")):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(OverflowError)
async def number_too_large(request: Request, exc: OverflowError):
    # A safety net: absurdly large numbers get a clean error instead of a crash
    return JSONResponse(status_code=422, content={"detail": "A number in the request is too large."})


app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/")
def home():
    return {"message": "JD's Wafflory backend is running"}