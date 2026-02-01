"""User schemas"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserSchema(BaseModel):
    """User response schema"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
