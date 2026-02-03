"""API endpoint for exchange rate with markup formula applied."""
from fastapi import APIRouter

from backend.services.rate_loader import get_rates_from_settings

router = APIRouter(prefix="/rate", tags=["rate"])


@router.get("")
async def get_rate():
    """
    Return current Buy/Sell rates with markup formula applied.

    The formula is:  final_rate = api_rate * (1 + markup_percent / 100)
    Markup percentages are configured by admins via /api/admin/rate-settings.
    """
    buy, sell = get_rates_from_settings()
    return {"buy": buy, "sell": sell}
