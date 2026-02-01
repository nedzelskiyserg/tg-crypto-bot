"""Bot instance and dispatcher"""
from typing import Optional
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from backend.config import settings

# Create bot instance
bot: Optional[Bot] = None
dp: Optional[Dispatcher] = None


def init_bot() -> tuple[Bot, Dispatcher]:
    """Initialize bot and dispatcher"""
    global bot, dp

    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    # Register handlers
    from backend.bot.handlers import start, admin
    dp.include_router(start.router)
    dp.include_router(admin.router)

    return bot, dp


def get_bot() -> Optional[Bot]:
    """Get bot instance"""
    return bot


def get_dispatcher() -> Optional[Dispatcher]:
    """Get dispatcher instance"""
    return dp
