"""Pydantic models for pipeline endpoints."""

from typing import Optional
from pydantic import BaseModel


class ProcessRequest(BaseModel):
    text: str
    session_id: str = "default"
    generator: str = "eleven"
    user_id: str = "anonymous"
    emotional_profile: Optional[dict] = None
    therapeutic_context: Optional[dict] = None  # backward compat alias
    therapy_profile: Optional[dict] = None


class FeedbackRequest(BaseModel):
    feedback: str
    session_id: str = "default"
    user_id: str = "anonymous"
