"""
Обработчик callback'ов для подтверждения/отклонения заказов.
Edits notification messages for ALL admins when any admin confirms/rejects.
"""
import os
import aiohttp
from aiogram import Router, F
from aiogram.types import CallbackQuery

router = Router()

# API URL для обновления статуса заказа
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api")


async def update_order_status(order_id: int, status: str, admin_id: int) -> dict:
    """Call backend API to update order status. Returns order + notification IDs."""
    url = f"{API_BASE_URL}/orders/admin/{order_id}"
    payload = {"status": status, "admin_id": admin_id}

    async with aiohttp.ClientSession() as session:
        async with session.patch(url, json=payload) as response:
            if response.status == 200:
                return {"ok": True, "data": await response.json()}
            else:
                error = await response.text()
                return {"ok": False, "error": error, "status": response.status}


async def edit_all_admin_messages(
    callback: CallbackQuery,
    notifications: list[dict],
    status_text: str,
    admin_name: str,
) -> None:
    """Edit notification messages for ALL admins, not just the one who clicked."""
    bot = callback.bot
    # Use html_text to preserve <code> tags and other formatting
    original_html = callback.message.html_text or callback.message.text or ""
    new_text = f"{original_html}\n\n{status_text}\nАдмин: {admin_name}"

    current_chat_id = callback.message.chat.id
    current_message_id = callback.message.message_id

    # Edit the message for the admin who clicked (via callback — guaranteed to work)
    try:
        await callback.message.edit_text(new_text, reply_markup=None, parse_mode="HTML")
    except Exception:
        pass

    # Edit messages for all OTHER admins
    for notif in notifications:
        admin_id = notif.get("admin_id")
        message_id = notif.get("message_id")

        # Skip the admin who clicked (already edited above)
        if admin_id == current_chat_id and message_id == current_message_id:
            continue

        try:
            await bot.edit_message_text(
                chat_id=admin_id,
                message_id=message_id,
                text=new_text,
                parse_mode="HTML",
                reply_markup=None,
            )
        except Exception as e:
            print(f"Failed to edit message for admin {admin_id}: {e}")


@router.callback_query(F.data.startswith("order_confirm_"))
async def handle_order_confirm(callback: CallbackQuery) -> None:
    """Handle order confirmation callback"""
    try:
        order_id = int(callback.data.replace("order_confirm_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

    result = await update_order_status(order_id, "confirmed", callback.from_user.id)

    if not result["ok"]:
        if result.get("status") == 403:
            await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        elif result.get("status") == 400:
            await callback.answer("ℹ️ Заказ уже обработан", show_alert=True)
        else:
            await callback.answer(f"❌ Ошибка: {result.get('error', 'unknown')}", show_alert=True)
        return

    admin_name = f"@{callback.from_user.username}" if callback.from_user.username else str(callback.from_user.id)
    notifications = result["data"].get("notifications", [])

    await edit_all_admin_messages(
        callback=callback,
        notifications=notifications,
        status_text="✅ <b>ПОДТВЕРЖДЕНО</b>",
        admin_name=admin_name,
    )

    await callback.answer("✅ Заказ подтвержден!")


@router.callback_query(F.data.startswith("order_reject_"))
async def handle_order_reject(callback: CallbackQuery) -> None:
    """Handle order rejection callback"""
    try:
        order_id = int(callback.data.replace("order_reject_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

    result = await update_order_status(order_id, "rejected", callback.from_user.id)

    if not result["ok"]:
        if result.get("status") == 403:
            await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        elif result.get("status") == 400:
            await callback.answer("ℹ️ Заказ уже обработан", show_alert=True)
        else:
            await callback.answer(f"❌ Ошибка: {result.get('error', 'unknown')}", show_alert=True)
        return

    admin_name = f"@{callback.from_user.username}" if callback.from_user.username else str(callback.from_user.id)
    notifications = result["data"].get("notifications", [])

    await edit_all_admin_messages(
        callback=callback,
        notifications=notifications,
        status_text="❌ <b>ОТКЛОНЕНО</b>",
        admin_name=admin_name,
    )

    await callback.answer("❌ Заказ отклонен!")
