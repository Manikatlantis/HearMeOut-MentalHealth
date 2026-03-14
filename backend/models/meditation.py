"""Pydantic models for meditation endpoints."""

from pydantic import BaseModel
from typing import Optional


class MeditationRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    mode: str = "standalone"  # 'standalone' or 'story-connected'
    story_context: Optional[str] = None
