"""
Обработчик callback'ов для подтверждения/отклонения заказов
"""
import os
import aiohttp
from aiogram import Router, F
from aiogram.types import CallbackQuery

router = Router()

# API URL для обновления статуса заказа
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api")


async def update_order_status(order_id: int, status: str, admin_id: int) -> dict:
    """Call backend API to update order status"""
    url = f"{API_BASE_URL}/orders/admin/{order_id}"
    payload = {"status": status, "admin_id": admin_id}

    async with aiohttp.ClientSession() as session:
        async with session.patch(url, json=payload) as response:
            if response.status == 200:
                return {"ok": True, "data": await response.json()}
            else:
                error = await response.text()
                return {"ok": False, "error": error, "status": response.status}


@router.callback_query(F.data.startswith("order_confirm_"))
async def handle_order_confirm(callback: CallbackQuery) -> None:
    """Handle order confirmation callback"""
    # Extract order ID
    try:
        order_id = int(callback.data.replace("order_confirm_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

    # Call API to update status
    result = await update_order_status(order_id, "confirmed", callback.from_user.id)

    if not result["ok"]:
        if result.get("status") == 403:
            await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        elif result.get("status") == 400:
            await callback.answer("ℹ️ Заказ уже обработан", show_alert=True)
        else:
            await callback.answer(f"❌ Ошибка: {result.get('error', 'unknown')}", show_alert=True)
        return

    # Update message
    original_text = callback.message.text or ""
    admin_name = f"@{callback.from_user.username}" if callback.from_user.username else str(callback.from_user.id)
    new_text = f"{original_text}\n\n✅ <b>ПОДТВЕРЖДЕНО</b>\nАдмин: {admin_name}"

    try:
        await callback.message.edit_text(new_text, reply_markup=None, parse_mode="HTML")
    except Exception:
        pass  # Message might be too old to edit

    await callback.answer("✅ Заказ подтвержден!")


@router.callback_query(F.data.startswith("order_reject_"))
async def handle_order_reject(callback: CallbackQuery) -> None:
    """Handle order rejection callback"""
    # Extract order ID
    try:
        order_id = int(callback.data.replace("order_reject_", ""))
    except ValueError:
        await callback.answer("❌ Неверный ID заказа", show_alert=True)
        return

    # Call API to update status
    result = await update_order_status(order_id, "rejected", callback.from_user.id)

    if not result["ok"]:
        if result.get("status") == 403:
            await callback.answer("❌ У вас нет прав для этого действия", show_alert=True)
        elif result.get("status") == 400:
            await callback.answer("ℹ️ Заказ уже обработан", show_alert=True)
        else:
            await callback.answer(f"❌ Ошибка: {result.get('error', 'unknown')}", show_alert=True)
        return

    # Update message
    original_text = callback.message.text or ""
    admin_name = f"@{callback.from_user.username}" if callback.from_user.username else str(callback.from_user.id)
    new_text = f"{original_text}\n\n❌ <b>ОТКЛОНЕНО</b>\nАдмин: {admin_name}"

    try:
        await callback.message.edit_text(new_text, reply_markup=None, parse_mode="HTML")
    except Exception:
        pass  # Message might be too old to edit

    await callback.answer("❌ Заказ отклонен!")
