"""
Сервис получения курсов: сначала внешний API (mosca.moscow),
при недоступности — бэкенд /api/rate (Google Таблица Settings: Buy/Sell).
"""
import os
import aiohttp
from typing import Optional, Tuple

# Внешний API курсов
RATE_API_URL = os.getenv("RATE_API_URL", "https://mosca.moscow/api/v1/rate/")
RATE_API_TOKEN = os.getenv(
    "RATE_API_TOKEN",
    "HZAKlDuHaMD5sRpWgeciz6OxeK8b7h76NJHdeqi_OdurDRJBv1mJy4iuyz53wgZRbEmxCiKTojNYgLmRhIzqlA"
)
# Бэкенд приложения (fallback: курсы из Google Таблицы Settings)
API_BASE_URL = os.getenv("API_BASE_URL", "http://app:8000/api").rstrip("/")

# Cache for rates
_cached_rates: Optional[Tuple[float, float]] = None


def _parse_rates(data: dict) -> Optional[Tuple[float, float]]:
    """Из ответа API извлечь (buy, sell); None если невалидно."""
    try:
        buy = float(data.get("buy") or data.get("buy_rate") or data.get("rate", 0))
        sell = float(data.get("sell") or data.get("sell_rate") or buy)
        if buy > 0:
            return (buy, sell)
    except (TypeError, ValueError):
        pass
    return None


async def fetch_rates_from_api() -> Optional[Tuple[float, float]]:
    """
    Курсы из внешнего API (mosca.moscow).
    Returns (buy_rate, sell_rate) or None.
    """
    global _cached_rates
    try:
        headers = {
            "Authorization": f"Bearer {RATE_API_TOKEN}",
            "Accept": "application/json",
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(RATE_API_URL, headers=headers, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    rates = _parse_rates(data)
                    if rates:
                        _cached_rates = rates
                        return rates
    except Exception as e:
        print(f"[Rates] External API unavailable: {e}")
    return None


async def fetch_rates_from_backend() -> Optional[Tuple[float, float]]:
    """
    Курсы из бэкенда /api/rate (Google Таблица Settings: Buy, Sell).
    Используется, когда внешний API недоступен.
    """
    global _cached_rates
    url = f"{API_BASE_URL}/rate"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    rates = _parse_rates(data)
                    if rates:
                        _cached_rates = rates
                        return rates
    except Exception as e:
        print(f"[Rates] Backend /api/rate unavailable: {e}")
    return None


async def get_rates() -> Tuple[float, float]:
    """
    Текущие курсы (buy, sell).
    1) Внешний API (mosca.moscow)
    2) Бэкенд /api/rate (Google Таблица Settings)
    3) Кэш
    4) (0, 0) — в тексте останутся цифры из таблицы (Курсы).
    """
    rates = await fetch_rates_from_api()
    if rates:
        return rates

    rates = await fetch_rates_from_backend()
    if rates:
        return rates

    if _cached_rates:
        return _cached_rates

    # Не подставляем — в сообщении остаются цифры из текста в Google Таблице
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
