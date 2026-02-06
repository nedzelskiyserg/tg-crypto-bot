"""Admin API endpoints - rate settings and order management"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from backend.api.deps import DbSession, CurrentUser
from backend.models.order import Order, OrderStatus
from backend.schemas.order import OrderResponse
from backend.models.rate_settings import RateSettings
from backend.services.admin_loader import load_admin_ids
from backend.services.rate_loader import get_raw_rates, save_markup_settings

router = APIRouter(prefix="/admin", tags=["admin"])


# --- Auth helper ---

def _verify_admin(admin_id: int) -> None:
    """Verify that the given ID is in the admin list."""
    admin_ids = load_admin_ids()
    if admin_id not in admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not an admin",
        )


# --- Admin check via Telegram initData ---

@router.get("/check")
async def check_admin(current_user: CurrentUser):
    """Check if the current Telegram user is an admin. Uses initData auth."""
    admin_ids = load_admin_ids()
    is_admin = current_user.telegram_id in admin_ids
    return {"is_admin": is_admin, "telegram_id": current_user.telegram_id}


# --- Rate Settings ---

class RateSettingsResponse(BaseModel):
    buy_markup_percent: float
    sell_markup_percent: float
    raw_buy_rate: float
    raw_sell_rate: float
    final_buy_rate: float
    final_sell_rate: float
    updated_at: Optional[datetime] = None
    updated_by: str = "system"


class RateSettingsUpdate(BaseModel):
    buy_markup_percent: float
    sell_markup_percent: float
    admin_id: int


@router.get("/rate-settings", response_model=RateSettingsResponse)
async def get_rate_settings(
    db: DbSession,
    admin_id: int = Query(..., description="Admin Telegram ID for auth"),
):
    """Get current rate markup settings and computed rates."""
    _verify_admin(admin_id)

    result = await db.execute(select(RateSettings).where(RateSettings.id == 1))
    rs = result.scalar_one_or_none()

    buy_markup = rs.buy_markup_percent if rs else 0.0
    sell_markup = rs.sell_markup_percent if rs else 0.0
    updated_at = rs.updated_at if rs else None
    updated_by = rs.updated_by if rs else "system"

    raw_buy, raw_sell = get_raw_rates()
    # У Mosca покупка = sell, продажа = buy → наценки применяем так же
    final_buy = round(raw_buy * (1 + sell_markup / 100), 2)
    final_sell = round(raw_sell * (1 + buy_markup / 100), 2)

    return RateSettingsResponse(
        buy_markup_percent=buy_markup,
        sell_markup_percent=sell_markup,
        raw_buy_rate=raw_buy,
        raw_sell_rate=raw_sell,
        final_buy_rate=final_buy,
        final_sell_rate=final_sell,
        updated_at=updated_at,
        updated_by=updated_by,
    )


@router.put("/rate-settings", response_model=RateSettingsResponse)
async def update_rate_settings(
    body: RateSettingsUpdate,
    db: DbSession,
):
    """Update rate markup percentages."""
    _verify_admin(body.admin_id)

    result = await db.execute(select(RateSettings).where(RateSettings.id == 1))
    rs = result.scalar_one_or_none()

    if rs:
        rs.buy_markup_percent = body.buy_markup_percent
        rs.sell_markup_percent = body.sell_markup_percent
        rs.updated_by = str(body.admin_id)
        rs.updated_at = datetime.utcnow()
    else:
        rs = RateSettings(
            id=1,
            buy_markup_percent=body.buy_markup_percent,
            sell_markup_percent=body.sell_markup_percent,
            updated_by=str(body.admin_id),
        )
        db.add(rs)

    await db.commit()
    await db.refresh(rs)

    # Sync to JSON cache for fast sync access from rate_loader
    save_markup_settings(rs.buy_markup_percent, rs.sell_markup_percent)

    raw_buy, raw_sell = get_raw_rates()
    final_buy = round(raw_buy * (1 + rs.sell_markup_percent / 100), 2)
    final_sell = round(raw_sell * (1 + rs.buy_markup_percent / 100), 2)

    return RateSettingsResponse(
        buy_markup_percent=rs.buy_markup_percent,
        sell_markup_percent=rs.sell_markup_percent,
        raw_buy_rate=raw_buy,
        raw_sell_rate=raw_sell,
        final_buy_rate=final_buy,
        final_sell_rate=final_sell,
        updated_at=rs.updated_at,
        updated_by=rs.updated_by,
    )


# --- Orders Management ---

class AdminOrdersResponse(BaseModel):
    orders: list[OrderResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/orders", response_model=AdminOrdersResponse)
async def get_all_orders(
    db: DbSession,
    admin_id: int = Query(..., description="Admin Telegram ID for auth"),
    # Filters
    order_id: Optional[int] = Query(None, description="Filter by order ID"),
    status_filter: Optional[OrderStatus] = Query(None, alias="status", description="Filter by status"),
    amount_min: Optional[float] = Query(None, description="Min amount_from"),
    amount_max: Optional[float] = Query(None, description="Max amount_from"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get all orders with filtering and pagination (admin only)."""
    _verify_admin(admin_id)

    query = select(Order)
    count_query = select(func.count(Order.id))

    # Apply filters
    if order_id is not None:
        query = query.where(Order.id == order_id)
        count_query = count_query.where(Order.id == order_id)

    if status_filter is not None:
        query = query.where(Order.status == status_filter)
        count_query = count_query.where(Order.status == status_filter)

    if amount_min is not None:
        query = query.where(Order.amount_from >= amount_min)
        count_query = count_query.where(Order.amount_from >= amount_min)

    if amount_max is not None:
        query = query.where(Order.amount_from <= amount_max)
        count_query = count_query.where(Order.amount_from <= amount_max)

    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.where(Order.created_at >= dt_from)
            count_query = count_query.where(Order.created_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.where(Order.created_at <= dt_to)
            count_query = count_query.where(Order.created_at <= dt_to)
        except ValueError:
            pass

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply ordering and pagination (join User for username in response)
    query = query.options(joinedload(Order.user)).order_by(Order.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    orders = result.unique().scalars().all()

    total_pages = max(1, (total + page_size - 1) // page_size)
    orders_response = [
        OrderResponse.model_validate(o).model_copy(
            update={"username": o.tg_username or (o.user.username if o.user else None)}
        )
        for o in orders
    ]

    return AdminOrdersResponse(
        orders=orders_response,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
