"""
Сервис получения курсов из API
"""
import os
import aiohttp
from typing import Optional, Tuple

# API Configuration
RATE_API_URL = os.getenv("RATE_API_URL", "https://mosca.moscow/api/v1/rate/")
RATE_API_TOKEN = os.getenv(
    "RATE_API_TOKEN",
    "HZAKlDuHaMD5sRpWgeciz6OxeK8b7h76NJHdeqi_OdurDRJBv1mJy4iuyz53wgZRbEmxCiKTojNYgLmRhIzqlA"
)

# Cache for rates
_cached_rates: Optional[Tuple[float, float]] = None


async def fetch_rates_from_api() -> Optional[Tuple[float, float]]:
    """
    Fetch buy and sell rates from API.
    Returns tuple (buy_rate, sell_rate) or None if failed.
    """
    global _cached_rates

    try:
        headers = {
            "Authorization": f"Bearer {RATE_API_TOKEN}",
            "Accept": "application/json"
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(RATE_API_URL, headers=headers, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    # Extract rates from API response
                    # Adjust based on actual API response structure
                    buy_rate = float(data.get("buy") or data.get("buy_rate") or data.get("rate", 0))
                    sell_rate = float(data.get("sell") or data.get("sell_rate") or buy_rate)

                    if buy_rate > 0:
                        _cached_rates = (buy_rate, sell_rate)
                        return _cached_rates
    except Exception as e:
        print(f"[Rates] Error fetching rates: {e}")

    return None


async def get_rates() -> Tuple[float, float]:
    """
    Get current buy and sell rates.
    Returns (buy_rate, sell_rate).
    Falls back to cached rates or defaults if API unavailable.
    """
    rates = await fetch_rates_from_api()

    if rates:
        return rates

    # Fallback to cached rates
    if _cached_rates:
        return _cached_rates

    # Default fallback (will be replaced by values from Google Sheets text)
    return (0.0, 0.0)


def format_rate(rate: float) -> str:
    """
    Format rate for display: 97.5 -> "97,50"
    """
    if rate <= 0:
        return "—"
    # Round to 2 decimals
    rounded = round(rate, 2)
    # Format with comma as decimal separator
    if rounded == int(rounded):
        return f"{int(rounded)},00"
    return f"{rounded:.2f}".replace(".", ",")
