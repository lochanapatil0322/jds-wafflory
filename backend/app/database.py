from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

database_url = settings.DATABASE_URL
# Some hosts write "postgres://", but SQLAlchemy wants "postgresql://"
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

if database_url.startswith("sqlite"):
    # Your local file database
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
else:
    # Neon: check that a connection is alive before using it, because the
    # database goes to sleep when it is idle and drops old connections
    engine = create_engine(database_url, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()