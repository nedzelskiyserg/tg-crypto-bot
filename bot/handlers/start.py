"""
Обработчик команды /start
"""
from aiogram import types

# Эти переменные будут установлены из bot/main.py
CMS_INSTANCE = None
MENU_KEYBOARD = None
USE_GOOGLE_SHEETS = False


async def start_handler(message: types.Message) -> None:
    """Обработчик команды /start"""
    # Получаем приветственное сообщение из CMS (Google Sheets или локальный файл)
    if USE_GOOGLE_SHEETS and hasattr(CMS_INSTANCE, 'get_welcome_message'):
        welcome_message = CMS_INSTANCE.get_welcome_message()
    else:
        # Значение по умолчанию для локального файла
        welcome_message = (
            "Добро пожаловать в Mosca\n\n"
            "📍 Москва, Пресненская набережная 12, Башня Федерация. Восток, этаж 11\n\n"
            "📅 Мы работаем для вас 24/7. Без обеда и выходных.\n\n"
            "💵 Мы работаем только за наличные рубли.\n\n"
            "💹 Самый низкий курс на покупку USDT и лучший курс покупки USDT в Москве.\n\n"
            "🤑 Отсутствие каких либо комиссии на покупку и продажу USDT\n\n"
            "Выберите раздел из меню:"
        )
    
    # Создаем корневое меню из CMS (inline кнопки)
    keyboard = MENU_KEYBOARD.build_menu_keyboard(parent_id=None, back_button=False)
    
    # Создаем reply клавиатуру (кнопки внизу экрана), если есть
    reply_keyboard = MENU_KEYBOARD.build_reply_keyboard(parent_id=None, user_id=message.from_user.id)
    
    # Приоритет: reply-кнопки (если есть), иначе inline-кнопки
    # В Telegram нельзя использовать оба типа одновременно
    if reply_keyboard:
        await message.answer(
            welcome_message,
            reply_markup=reply_keyboard
        )
    else:
        await message.answer(
            welcome_message,
            reply_markup=keyboard
        )
