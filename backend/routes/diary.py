"""Diary routes — CRUD for user notes and AI insights."""

from fastapi import APIRouter

from backend.models import DiaryRequest
from backend.db import save_diary_entry, get_diary_entries

router = APIRouter()


@router.post("/api/diary")
def save_diary(req: DiaryRequest):
    """Save a diary entry (user note or AI insight)."""
    save_diary_entry(
        user_id=req.user_id,
        session_id=req.session_id,
        entry_type=req.entry_type,
        content=req.content,
    )
    return {"status": "saved"}


@router.get("/api/diary/{user_id}")
def get_diary(user_id: str):
    """Get all diary entries for a user."""
    entries = get_diary_entries(user_id)
    return {"entries": entries}
