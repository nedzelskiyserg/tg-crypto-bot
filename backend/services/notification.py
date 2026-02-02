"""Notification service - send notifications to admins"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from backend.models.order import Order
from backend.models.user import User
from backend.services.admin_loader import load_admin_ids


async def notify_admins_new_order(bot, order: Order, user: User) -> None:
    """
    Send notification about new order to all admins.
    Supports both BUY (RUB -> USDT) and SELL (USDT -> RUB) modes.
    """
    admin_ids = load_admin_ids()

    if not admin_ids:
        print("Warning: No admin IDs found, notification not sent")
        return

    # Format username
    username_display = f"@{user.username}" if user.username else "не указан"

    # Determine order type
    is_buy = str(order.currency_from).upper() == "RUB"
    order_type = "🟢 ПОКУПКА USDT" if is_buy else "🔴 ПРОДАЖА USDT"

    # Build message based on order type
    if is_buy:
        # Buy mode: user sends RUB, receives USDT to wallet
        message = f"""{order_type}
Ордер #{order.id}

👤 Пользователь: {username_display}
📋 ФИО: {order.full_name}
📞 Телефон: {order.phone}
📧 Email: {order.email}

💰 Отдаёт: {order.amount_from} {order.currency_from}
💎 Получает: {order.amount_to} {order.currency_to}
📊 Курс: 1 USDT = {order.exchange_rate} RUB

🔐 Кошелёк TRC-20:
{order.wallet_address}"""
    else:
        # Sell mode: user sends USDT, receives RUB to bank card
        message = f"""{order_type}
Ордер #{order.id}

👤 Пользователь: {username_display}
📋 ФИО: {order.full_name}
📞 Телефон: {order.phone}
📧 Email: {order.email}

💎 Отдаёт: {order.amount_from} {order.currency_from}
💰 Получает: {order.amount_to} {order.currency_to}
📊 Курс: 1 USDT = {order.exchange_rate} RUB

💳 Карта для получения:
{order.bank_card or 'не указана'}"""

    # Create inline keyboard with Confirm/Reject buttons
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Подтвердить",
                    callback_data=f"order_confirm_{order.id}"
                ),
                InlineKeyboardButton(
                    text="❌ Отклонить",
                    callback_data=f"order_reject_{order.id}"
                ),
            ]
        ]
    )

    # Send to all admins
    for admin_id in admin_ids:
        try:
            await bot.send_message(
                chat_id=admin_id,
                text=message,
                reply_markup=keyboard
            )
        except Exception as e:
            print(f"Failed to send notification to admin {admin_id}: {e}")
