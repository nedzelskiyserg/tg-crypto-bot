"""Admin callback handlers for order confirmation/rejection.
Edits notification messages for ALL admins when any admin confirms/rejects."""
from aiogram import Router, F
from aiogram.types import CallbackQuery
from sqlalchemy import select

from backend.database import async_session_maker
from backend.models.order import Order, OrderStatus
from backend.models.notification import OrderNotification
from backend.services.admin_loader import load_admin_ids

router = Router()


def is_admin(user_id: int) -> bool:
    """Check if user is an admin"""
    admin_ids = load_admin_ids()
    return user_id in admin_ids


async def edit_all_admin_messages(
    callback: CallbackQuery,
    order_id: int,
    status_text: str,
    admin_name: str,
) -> None:
    """Edit notification messages for ALL admins."""
    bot = callback.bot
    original_html = callback.message.html_text or callback.message.text or ""
    new_text = f"{original_html}\n\n{status_text}\nАдмин: {admin_name}"

    current_chat_id = callback.message.chat.id
    current_message_id = callback.message.message_id

    # Edit the message for the admin who clicked
    try:
        await callback.message.edit_text(new_text, reply_markup=None, parse_mode="HTML")
    except Exception:
        pass

    # Get all notification message IDs for this order
    async with async_session_maker() as db:
        result = await db.execute(
            select(OrderNotification).where(OrderNotification.order_id == order_id)
        )
        notifications = result.scalars().all()

    # Edit messages for all OTHER admins
    for notif in notifications:
        if notif.admin_id == current_chat_id and notif.message_id == current_message_id:
            continue
        try:
            await bot.edit_message_text(
                chat_id=notif.admin_id,
                message_id=notif.message_id,
                text=new_text,
                parse_mode="HTML",
                reply_markup=None,
            )
        except Exception as e:
            print(f"Failed to edit message for admin {notif.admin_id}: {e}")


@router.callback_query(F.data.startswith("order_confirm_"))
async def handle_order_confirm(callback: CallbackQuery) -> None:
    """Handle order confirmation callback"""
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        return

    try:
        order_id = int(callback.data.replace("order_confirm_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

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

    admin_name = f"@{callback.from_user.username}" if callback.from_user.username else str(callback.from_user.id)
    await edit_all_admin_messages(callback, order_id, "✅ <b>ПОДТВЕРЖДЕНО</b>", admin_name)
    await callback.answer("✅ Заказ подтвержден!")


@router.callback_query(F.data.startswith("order_reject_"))
async def handle_order_reject(callback: CallbackQuery) -> None:
    """Handle order rejection callback"""
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        return

    try:
        order_id = int(callback.data.replace("order_reject_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

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

    admin_name = f"@{callback.from_user.username}" if callback.from_user.username else str(callback.from_user.id)
    await edit_all_admin_messages(callback, order_id, "❌ <b>ОТКЛОНЕНО</b>", admin_name)
    await callback.answer("❌ Заказ отклонен!")
