"""Notification service - send notifications to admins"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from backend.models.order import Order
from backend.models.user import User
from backend.services.admin_loader import load_admin_ids


async def notify_admins_new_order(bot, order: Order, user: User) -> None:
    """
    Send notification about new order to all admins.

    Message format (as specified):
    Ордер #{order_id}
    Имя пользователя в Telegram
    (никнейм) : @{username}
    Имя и Фамилия : {full_name}
    Номер телефона : {phone}
    Адрес электронной почты :
    {email}
    Что у меня есть (нета) : {currency_to}
    Сколько нужно (монета ) : {amount_to}
    Курс : {exchange_rate}
    Кошелек для получения :
    {wallet_address}
    """
    admin_ids = load_admin_ids()

    if not admin_ids:
        print("Warning: No admin IDs found, notification not sent")
        return

    # Format username
    username_display = f"@{user.username}" if user.username else "не указан"

    # Build message
    message = f"""Ордер #{order.id}
Имя пользователя в Telegram
(никнейм) : {username_display}
Имя и Фамилия : {order.full_name}
Номер телефона : {order.phone}
Адрес электронной почты :
{order.email}
Что у меня есть (нета) : {order.currency_from} {order.amount_from}
Сколько нужно (монета ) : {order.currency_to} {order.amount_to}
Курс : {order.exchange_rate}
Кошелек для получения :
{order.wallet_address}"""

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
