"""
Главный файл запуска Telegram бота
"""
import sys
import asyncio
from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.types import CallbackQuery

from shared.config import Config
from bot.utils.logger import setup_logger
from bot.utils.process import check_running_processes
from bot.cms import CMS, GoogleSheetsCMS
from bot.keyboards import MenuKeyboard
from bot.handlers import (
    start_handler,
    menu_handler,
    admin_panel_handler,
    reply_button_handler,
    orders_router
)

# Настраиваем логирование
logger = setup_logger(__name__)

# Валидируем конфигурацию
try:
    Config.validate()
except (ValueError, FileNotFoundError) as e:
    logger.error(str(e))
    sys.exit(1)

# Инициализируем CMS и клавиатуры
try:
    if Config.USE_GOOGLE_SHEETS:
        try:
            CMS_INSTANCE = GoogleSheetsCMS()
            logger.info("Используется Google Sheets для меню")
        except Exception as e:
            logger.error(f"Ошибка при инициализации Google Sheets: {e}")
            logger.info("Попытка использовать локальный файл...")
            CMS_INSTANCE = CMS(Config.MENU_FILE)
    else:
        CMS_INSTANCE = CMS(Config.MENU_FILE)
        logger.info("Используется локальный XLSX файл для меню")
    
    MENU_KEYBOARD = MenuKeyboard(CMS_INSTANCE)
    
    # Делаем CMS и клавиатуру доступными для обработчиков
    # Используем глобальные переменные для простоты
    import bot.handlers.start as start_module
    import bot.handlers.menu as menu_module
    import bot.handlers.admin as admin_module
    import bot.handlers.reply_buttons as reply_module
    
    start_module.CMS_INSTANCE = CMS_INSTANCE
    start_module.MENU_KEYBOARD = MENU_KEYBOARD
    start_module.USE_GOOGLE_SHEETS = Config.USE_GOOGLE_SHEETS
    
    menu_module.CMS_INSTANCE = CMS_INSTANCE
    menu_module.MENU_KEYBOARD = MENU_KEYBOARD
    menu_module.USE_GOOGLE_SHEETS = Config.USE_GOOGLE_SHEETS
    
    admin_module.CMS_INSTANCE = CMS_INSTANCE
    admin_module.MENU_KEYBOARD = MENU_KEYBOARD
    admin_module.USE_GOOGLE_SHEETS = Config.USE_GOOGLE_SHEETS
    admin_module.logger = logger
    
    reply_module.CMS_INSTANCE = CMS_INSTANCE
    reply_module.MENU_KEYBOARD = MENU_KEYBOARD
    reply_module.USE_GOOGLE_SHEETS = Config.USE_GOOGLE_SHEETS
    
except Exception as e:
    logger.error(f"Критическая ошибка при инициализации: {e}")
    sys.exit(1)


async def main() -> None:
    """Основная функция запуска бота"""
    # Инициализируем бота и диспетчер
    bot = Bot(token=Config.BOT_TOKEN)
    dp = Dispatcher()
    
    # Очищаем webhook перед запуском polling (избегаем конфликтов)
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("Webhook очищен")
    except Exception as e:
        logger.warning(f"Не удалось очистить webhook: {e}")
    
    # Регистрируем обработчики
    dp.include_router(orders_router)  # Order confirm/reject callbacks
    dp.message.register(start_handler, Command("start"))
    # Обработчик для всех callback_query, начинающихся с "menu_"
    dp.callback_query.register(menu_handler, lambda c: c.data and c.data.startswith("menu_"))
    # Обработчик админ-панели перед общим обработчиком reply кнопок
    dp.message.register(
        admin_panel_handler,
        lambda message: message.text in ["Настройки ⚙️", "🔁 Обновить бот", "◀️ Назад"] and
        Config.USE_GOOGLE_SHEETS and
        hasattr(CMS_INSTANCE, 'is_admin') and
        CMS_INSTANCE.is_admin(message.from_user.id)
    )
    # Обработчик для текстовых сообщений (reply кнопки)
    dp.message.register(reply_button_handler)
    
    logger.info("Бот запущен и готов к работе")
    try:
        await dp.start_polling(bot, drop_pending_updates=True)
    except KeyboardInterrupt:
        logger.info("Получен сигнал остановки")
    except Exception as e:
        logger.error(f"Ошибка при работе бота: {e}")
        raise
    finally:
        await bot.session.close()


if __name__ == '__main__':
    # Проверяем, не запущен ли уже экземпляр бота
    if check_running_processes('bot/main.py'):
        logger.error("Бот уже запущен! Остановите предыдущий экземпляр перед запуском.")
        sys.exit(1)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        sys.exit(1)
