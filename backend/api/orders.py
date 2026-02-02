"""Order API endpoints"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.api.deps import DbSession, CurrentUser
from backend.bot.bot import get_bot
from backend.models.order import Order, OrderStatus
from backend.schemas.order import OrderCreate, OrderResponse
from backend.services.notification import notify_admins_new_order

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> Order:
    """
    Create a new exchange order.

    - Validates user via Telegram initData
    - Creates order in database
    - Notifies all admins with inline buttons
    """
    # Create order
    order = Order(
        user_id=current_user.telegram_id,
        full_name=order_data.full_name,
        phone=order_data.phone,
        email=order_data.email,
        currency_from=order_data.currency_from,
        amount_from=order_data.amount_from,
        currency_to=order_data.currency_to,
        amount_to=order_data.amount_to,
        exchange_rate=order_data.exchange_rate,
        wallet_address=order_data.wallet_address,
    )

    db.add(order)
    await db.commit()
    await db.refresh(order)

    # Notify admins
    bot = get_bot()
    if bot:
        await notify_admins_new_order(bot, order, current_user)

    return order


@router.get("", response_model=list[OrderResponse])
async def get_user_orders(
    db: DbSession,
    current_user: CurrentUser,
) -> list[Order]:
    """Get all orders for the current user"""
    from sqlalchemy import select

    result = await db.execute(
        select(Order)
        .where(Order.user_id == current_user.telegram_id)
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


class OrderStatusUpdate(BaseModel):
    """Schema for order status update (cancel)"""
    status: OrderStatus


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Order:
    """
    Update order status (e.g. cancel by user).
    Only the order owner can cancel; only pending orders can be cancelled.
    """
    from sqlalchemy import select

    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.user_id == current_user.telegram_id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if body.status == OrderStatus.cancelled:
        if order.status != OrderStatus.pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending orders can be cancelled",
            )
        order.status = OrderStatus.cancelled
        await db.commit()
        await db.refresh(order)
        return order

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only status=cancelled is supported")
