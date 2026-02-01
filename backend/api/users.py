"""User API endpoints"""
from fastapi import APIRouter

from backend.api.deps import CurrentUser
from backend.schemas.user import UserSchema

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: CurrentUser) -> UserSchema:
    """Get current user information"""
    return current_user
