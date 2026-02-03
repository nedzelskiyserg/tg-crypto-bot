"""Main application entry point - FastAPI backend"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings, MINIAPP_DIR, BASE_DIR
from backend.database import create_tables, async_session_maker
from backend.api import orders_router, rate_router, users_router, admin_router
from backend.bot.bot import init_bot_for_notifications


async def _sync_markup_cache():
    """Sync rate markup settings from DB to JSON cache on startup."""
    from sqlalchemy import select
    from backend.models.rate_settings import RateSettings
    from backend.services.rate_loader import save_markup_settings

    try:
        async with async_session_maker() as session:
            result = await session.execute(select(RateSettings).where(RateSettings.id == 1))
            rs = result.scalar_one_or_none()
            if rs:
                save_markup_settings(rs.buy_markup_percent, rs.sell_markup_percent)
                print(f"Rate markup synced: buy={rs.buy_markup_percent}%, sell={rs.sell_markup_percent}%")
            else:
                print("No rate markup settings in DB, using defaults (0%, 0%)")
    except Exception as e:
        print(f"Warning: Could not sync markup cache: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events"""
    # Startup
    settings.validate()

    # Create database tables
    await create_tables()
    print("Database tables created")

    # Sync rate markup settings from DB to JSON cache
    await _sync_markup_cache()

    # Initialize bot instance for sending notifications (no polling)
    init_bot_for_notifications()
    print("Bot initialized for notifications")

    yield

    # Shutdown
    from backend.bot.bot import close_bot
    await close_bot()
    print("Bot session closed")


# Create FastAPI app
app = FastAPI(
    title="Crypto Exchange TMA API",
    description="API for Telegram Mini App cryptocurrency exchange",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS (origins from env: CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(orders_router, prefix=settings.API_PREFIX)
app.include_router(rate_router, prefix=settings.API_PREFIX)
app.include_router(users_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint (for load balancer / monitoring)"""
    return {"status": "healthy"}


# Serve Mini App static files at / (production: one server for API + frontend)
if MINIAPP_DIR.exists():
    app.mount("/", StaticFiles(directory=str(MINIAPP_DIR), html=True), name="miniapp")
else:
    @app.get("/")
    async def root():
        return {"status": "ok", "message": "Crypto Exchange TMA API", "miniapp": "not mounted"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
