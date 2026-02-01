"""Order model"""
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlalchemy import BigInteger, String, DateTime, Numeric, ForeignKey
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class OrderStatus(str, Enum):
    """Order status enum"""
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"


class Order(Base):
    """Exchange order model"""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.telegram_id"), nullable=False
    )
    status: Mapped[OrderStatus] = mapped_column(
        SQLEnum(OrderStatus), default=OrderStatus.pending
    )

    # User info
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Exchange info
    currency_from: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_from: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    currency_to: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_to: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)

    # Wallet
    wallet_address: Mapped[str] = mapped_column(String(255), nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationship to user
    user: Mapped["User"] = relationship("User", back_populates="orders")

    def __repr__(self) -> str:
        return f"<Order #{self.id} {self.status.value}>"
