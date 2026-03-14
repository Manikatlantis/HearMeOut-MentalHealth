"""History route."""

from fastapi import APIRouter
from backend.db import get_user_sessions

router = APIRouter()


@router.get("/api/history/{user_id}")
def get_history(user_id: str):
    """List past sessions for a user."""
    return get_user_sessions(user_id)
