"""API package"""
from backend.api.orders import router as orders_router
from backend.api.rate import router as rate_router
from backend.api.users import router as users_router

__all__ = ["orders_router", "rate_router", "users_router"]
