"""Start command handler"""
from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    """Handle /start command"""
    # You can customize the WebApp URL here
    webapp_url = "https://your-webapp-url.ngrok-free.app"

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="💱 Открыть обменник",
                    web_app=WebAppInfo(url=webapp_url)
                )
            ]
        ]
    )

    await message.answer(
        "👋 Добро пожаловать в криптообменник!\n\n"
        "Нажмите кнопку ниже, чтобы открыть мини-приложение и создать заявку на обмен.",
        reply_markup=keyboard
    )
