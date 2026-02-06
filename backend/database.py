"""Database setup with SQLAlchemy async"""
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from backend.config import settings


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def create_tables():
    """Create all database tables and apply simple migrations."""
    async with engine.begin() as conn:
        # Create missing tables
        await conn.run_sync(Base.metadata.create_all)

        # Apply simple, backward-compatible migrations (no drops/renames).
        def _run_simple_migrations(sync_conn):
            inspector = inspect(sync_conn)

            # --- orders.tg_username ---
            # Older databases may not have this column yet; add it if missing.
            if "orders" in inspector.get_table_names():
                columns = {col["name"] for col in inspector.get_columns("orders")}
                if "tg_username" not in columns:
                    # Nullable column, backend always sends explicit value,
                    # so DEFAULT is not strictly required.
                    sync_conn.execute(
                        text("ALTER TABLE orders ADD COLUMN tg_username VARCHAR(255)")
                    )
                    print("Applied DB migration: added orders.tg_username column")

        await conn.run_sync(_run_simple_migrations)


async def get_async_session() -> AsyncSession:
    """Get async database session"""
    async with async_session_maker() as session:
        yield session
