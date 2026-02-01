"""User model"""
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class User(Base):
    """Telegram user model"""

    __tablename__ = "users"

    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationship to orders
    orders: Mapped[list["Order"]] = relationship(
        "Order", back_populates="user", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User {self.telegram_id} @{self.username}>"
