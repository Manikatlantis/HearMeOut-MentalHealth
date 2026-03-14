"""Pydantic models for diary endpoints."""

from pydantic import BaseModel
from typing import Optional


class DiaryRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    entry_type: str = "user_note"  # 'user_note', 'auto_summary', 'ai_insight'
    content: str
