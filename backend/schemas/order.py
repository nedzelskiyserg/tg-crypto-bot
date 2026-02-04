"""Order schemas"""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field

from backend.models.order import OrderStatus


class OrderCreate(BaseModel):
    """Schema for creating an order"""
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=5, max_length=50)
    email: EmailStr

    currency_from: str = Field(..., min_length=1, max_length=20)
    amount_from: Decimal = Field(..., gt=0)
    currency_to: str = Field(..., min_length=1, max_length=20)
    amount_to: Decimal = Field(..., gt=0)
    exchange_rate: Decimal = Field(..., gt=0)

    # Wallet address for crypto (buy mode) - optional for sell mode
    wallet_address: str = Field(default="", max_length=255)
    # Bank card number for receiving RUB (sell mode) - optional for buy mode
    bank_card: str = Field(default="", max_length=50)


class OrderResponse(BaseModel):
    """Order response schema"""
    id: int
    user_id: int
    username: str | None = None
    status: OrderStatus

    full_name: str
    phone: str
    email: str

    currency_from: str
    amount_from: Decimal
    currency_to: str
    amount_to: Decimal
    exchange_rate: Decimal

    wallet_address: str
    bank_card: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationInfo(BaseModel):
    """Info about a sent admin notification message"""
    admin_id: int
    message_id: int


class AdminOrderUpdateResponse(BaseModel):
    """Response for admin order update - includes notification IDs for cross-admin editing"""
    order: OrderResponse
    notifications: list[NotificationInfo] = []
