"""Bot instance for sending notifications (no polling)"""
from typing import Optional
from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from backend.config import settings

# Bot instance (for sending notifications only, polling handled by /bot)
bot: Optional[Bot] = None


def init_bot_for_notifications() -> Bot:
    """Initialize bot instance for sending notifications (no polling)"""
    global bot

    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    return bot


def get_bot() -> Optional[Bot]:
    """Get bot instance for sending messages"""
    return bot


async def close_bot() -> None:
    """Close bot session"""
    global bot
    if bot:
        await bot.session.close()
        bot = None
