"""Pydantic models for emotion and recap endpoints."""

from pydantic import BaseModel


class SessionEmotionData(BaseModel):
    session_id: str
    user_id: str
    emotion_timeline: list  # list of {timestamp, emotions, dominantEmotion}


class SessionRecapRequest(BaseModel):
    user_id: str
    session_id: str
