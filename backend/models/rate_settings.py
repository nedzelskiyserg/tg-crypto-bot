"""Rate settings model - stores markup percentages for exchange rate formula"""
from sqlalchemy import Integer, Float, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from backend.database import Base


class RateSettings(Base):
    """Stores rate markup settings.

    Final rate formula:
        buy_rate  = api_buy_rate  * (1 + buy_markup_percent / 100)
        sell_rate = api_sell_rate * (1 + sell_markup_percent / 100)

    Negative markup = discount, positive = surcharge.
    Only one row (id=1) is used (singleton).
    """

    __tablename__ = "rate_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    buy_markup_percent: Mapped[float] = mapped_column(Float, default=0.0)
    sell_markup_percent: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    updated_by: Mapped[str] = mapped_column(String(100), default="system")
