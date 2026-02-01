"""
Обработчик админ-панели
"""
from aiogram import types
import logging

# Эти переменные будут установлены из bot/main.py
CMS_INSTANCE = None
MENU_KEYBOARD = None
USE_GOOGLE_SHEETS = False
logger = logging.getLogger(__name__)

async def admin_panel_handler(message: types.Message) -> None:
    """Обработчик админ-панели"""
    user_id = message.from_user.id
    
    # Проверяем права админа
    if not (USE_GOOGLE_SHEETS and hasattr(CMS_INSTANCE, 'is_admin') and CMS_INSTANCE.is_admin(user_id)):
        await message.answer("❌ У вас нет доступа к админ-панели")
        return
    
    # Проверяем, какая кнопка была нажата
    button_text = message.text
    
    if button_text == "🔁 Обновить бот":
        try:
            # Перезагружаем меню из Google Sheets
            CMS_INSTANCE.reload_menu()
            await message.answer("✅ Бот успешно обновлен! Меню синхронизировано с Google Sheets.")
        except Exception as e:
            logger.error(f"Ошибка при обновлении бота: {e}")
            await message.answer(f"❌ Ошибка при обновлении бота: {str(e)}")
    elif button_text == "Настройки ⚙️":
        # Показываем меню админ-панели
        from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
        from aiogram.utils.keyboard import ReplyKeyboardBuilder
        
        builder = ReplyKeyboardBuilder()
        builder.row(KeyboardButton(text="🔁 Обновить бот"))
        builder.row(KeyboardButton(text="◀️ Назад"))
        
        admin_keyboard = builder.as_markup(resize_keyboard=True)
        
        await message.answer(
            "⚙️ Настройки\n\nВыберите действие:",
            reply_markup=admin_keyboard
        )
    elif button_text == "◀️ Назад":
        # Возвращаемся к главному меню
        await start_handler(message)


# Импортируем start_handler для возврата в главное меню
from .start import start_handler
