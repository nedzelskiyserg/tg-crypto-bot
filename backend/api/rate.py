"""API endpoint for exchange rate (fallback from Google Sheet Settings)."""
from fastapi import APIRouter

from backend.services.rate_loader import get_rates_from_settings

router = APIRouter(prefix="/rate", tags=["rate"])


@router.get("")
async def get_rate():
    """
    Return current Buy/Sell rates from Settings (Google Sheet or defaults).
    Used as fallback when external rate API (e.g. mosca.moscow) is unavailable.
    """
    buy, sell = get_rates_from_settings()
    return {"buy": buy, "sell": sell}
