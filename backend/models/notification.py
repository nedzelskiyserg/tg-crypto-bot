"""Model for tracking admin notification messages"""
from sqlalchemy import BigInteger, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OrderNotification(Base):
    """Tracks which Telegram message was sent to which admin for each order.
    Used to edit all admin messages when order status changes."""

    __tablename__ = "order_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    admin_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
