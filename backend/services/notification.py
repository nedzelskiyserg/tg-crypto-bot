"""Notification service - send notifications to admins"""
from decimal import Decimal
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from backend.models.order import Order
from backend.models.user import User
from backend.models.notification import OrderNotification
from backend.services.admin_loader import load_admin_ids
from backend.database import async_session_maker


def format_amount(value: Decimal, decimals: int = 2) -> str:
    """Format decimal amount nicely: 10000.50 -> '10 000,5' or 100.00 -> '100'"""
    num = float(value)
    rounded = round(num, decimals)

    # Remove trailing zeros after decimal point
    if rounded == int(rounded):
        formatted = f"{int(rounded):,}".replace(",", " ")
    else:
        formatted = f"{rounded:,.{decimals}f}".replace(",", " ").replace(".", ",").rstrip("0").rstrip(",")

    return formatted


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

    # Format amounts
    amount_from = format_amount(order.amount_from)
    amount_to = format_amount(order.amount_to)
    rate = format_amount(order.exchange_rate)

    # Build message based on order type (HTML parse_mode for easy copy)
    if is_buy:
        # Buy mode: user sends RUB, receives USDT to wallet
        message = f"""{order_type}
Ордер #{order.id}

👤 Пользователь: {username_display}
📋 ФИО: <code>{order.full_name}</code>
📞 Телефон: <code>{order.phone}</code>
📧 Email: <code>{order.email}</code>

💰 Отдаёт: <code>{amount_from} {order.currency_from}</code>
💎 Получает: <code>{amount_to} {order.currency_to}</code>
📊 Курс: 1 USDT = {rate} RUB

🔐 Кошелёк TRC-20:
<code>{order.wallet_address}</code>"""
    else:
        # Sell mode: user sends USDT, receives RUB
        message = f"""{order_type}
Ордер #{order.id}

👤 Пользователь: {username_display}
📋 ФИО: <code>{order.full_name}</code>
📞 Телефон: <code>{order.phone}</code>
📧 Email: <code>{order.email}</code>

💎 Отдаёт: <code>{amount_from} {order.currency_from}</code>
💰 Получает: <code>{amount_to} {order.currency_to}</code>
📊 Курс: 1 USDT = {rate} RUB"""

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

    # Send to all admins and track message IDs
    sent_notifications = []
    for admin_id in admin_ids:
        try:
            sent_msg = await bot.send_message(
                chat_id=admin_id,
                text=message,
                parse_mode="HTML",
                reply_markup=keyboard
            )
            sent_notifications.append(
                OrderNotification(
                    order_id=order.id,
                    admin_id=admin_id,
                    message_id=sent_msg.message_id
                )
            )
        except Exception as e:
            print(f"Failed to send notification to admin {admin_id}: {e}")

    # Save message IDs to DB for cross-admin message editing
    if sent_notifications:
        try:
            async with async_session_maker() as db:
                db.add_all(sent_notifications)
                await db.commit()
        except Exception as e:
            print(f"Failed to save notification message IDs: {e}")
