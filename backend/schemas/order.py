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

    wallet_address: str = Field(..., min_length=10, max_length=255)


class OrderResponse(BaseModel):
    """Order response schema"""
    id: int
    user_id: int
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
    created_at: datetime

    class Config:
        from_attributes = True
