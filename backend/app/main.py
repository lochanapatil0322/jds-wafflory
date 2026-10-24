from fastapi import FastAPI

from .database import Base, engine
from . import models  # noqa: F401  (this import registers the tables)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="JD's Wafflory API")


@app.get("/")
def home():
    return {"message": "JD's Wafflory backend is running"}