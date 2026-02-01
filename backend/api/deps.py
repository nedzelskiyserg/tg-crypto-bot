"""FastAPI dependencies"""
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_maker
from backend.models.user import User
from backend.services.telegram_auth import validate_init_data, parse_init_data


async def get_db() -> AsyncSession:
    """Get database session dependency"""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_telegram_init_data: Annotated[Optional[str], Header()] = None,
) -> User:
    """
    Validate Telegram initData and get or create user.

    This dependency:
    1. Validates the initData HMAC signature
    2. Parses user data from initData
    3. Gets existing user or creates new one
    """
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Telegram-Init-Data header"
        )

    # Validate signature
    if not validate_init_data(x_telegram_init_data):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid initData signature"
        )

    # Parse user data
    user_data = parse_init_data(x_telegram_init_data)
    if not user_data or not user_data.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not parse user data from initData"
        )

    telegram_id = user_data["id"]

    # Get or create user
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        # Create new user
        user = User(
            telegram_id=telegram_id,
            username=user_data.get("username"),
            first_name=user_data.get("first_name"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


# Type alias for dependency injection
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
