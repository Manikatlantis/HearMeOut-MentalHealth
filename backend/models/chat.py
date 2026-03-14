"""Pydantic models for chat endpoints."""

from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    message: str
    history: Optional[list] = None
