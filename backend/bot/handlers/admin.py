"""Admin callback handlers for order confirmation/rejection"""
from aiogram import Router, F
from aiogram.types import CallbackQuery
from sqlalchemy import select

from backend.database import async_session_maker
from backend.models.order import Order, OrderStatus
from backend.services.admin_loader import load_admin_ids

router = Router()


def is_admin(user_id: int) -> bool:
    """Check if user is an admin"""
    admin_ids = load_admin_ids()
    return user_id in admin_ids


@router.callback_query(F.data.startswith("order_confirm_"))
async def handle_order_confirm(callback: CallbackQuery) -> None:
    """Handle order confirmation callback"""
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        return

    # Extract order ID
    try:
        order_id = int(callback.data.replace("order_confirm_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

    # Update order status
    async with async_session_maker() as db:
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()

        if not order:
            await callback.answer("❌ Заказ не найден", show_alert=True)
            return

        if order.status != OrderStatus.pending:
            await callback.answer(
                f"ℹ️ Заказ уже обработан: {order.status.value}",
                show_alert=True
            )
            return

        order.status = OrderStatus.confirmed
        await db.commit()

    # Update message
    original_text = callback.message.text
    new_text = f"{original_text}\n\n✅ <b>ПОДТВЕРЖДЕНО</b>\nАдмин: @{callback.from_user.username or callback.from_user.id}"

    await callback.message.edit_text(new_text, reply_markup=None)
    await callback.answer("✅ Заказ подтвержден!")


@router.callback_query(F.data.startswith("order_reject_"))
async def handle_order_reject(callback: CallbackQuery) -> None:
    """Handle order rejection callback"""
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        return

    # Extract order ID
    try:
        order_id = int(callback.data.replace("order_reject_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

    # Update order status
    async with async_session_maker() as db:
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()

        if not order:
            await callback.answer("❌ Заказ не найден", show_alert=True)
            return

        if order.status != OrderStatus.pending:
            await callback.answer(
                f"ℹ️ Заказ уже обработан: {order.status.value}",
                show_alert=True
            )
            return

        order.status = OrderStatus.rejected
        await db.commit()

    # Update message
    original_text = callback.message.text
    new_text = f"{original_text}\n\n❌ <b>ОТКЛОНЕНО</b>\nАдмин: @{callback.from_user.username or callback.from_user.id}"

    await callback.message.edit_text(new_text, reply_markup=None)
    await callback.answer("❌ Заказ отклонен!")
