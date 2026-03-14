"""Pydantic models for pipeline endpoints."""

from pydantic import BaseModel


class ProcessRequest(BaseModel):
    text: str
    session_id: str = "default"
    generator: str = "eleven"
    user_id: str = "anonymous"


class FeedbackRequest(BaseModel):
    feedback: str
    session_id: str = "default"
    user_id: str = "anonymous"
