"""Shared Pydantic request/response models for all API endpoints."""

from pydantic import BaseModel
from typing import Optional


# === Existing (moved from main.py) ===

class ProcessRequest(BaseModel):
    text: str
    session_id: str = "default"
    generator: str = "eleven"
    user_id: str = "anonymous"


class FeedbackRequest(BaseModel):
    feedback: str
    session_id: str = "default"
    user_id: str = "anonymous"


# === MANIK: Meditation ===

class MeditationRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    mode: str = "standalone"  # 'standalone' or 'story-connected'
    story_context: Optional[str] = None


# === SYED: Questionnaire + Chatbot ===

class QuestionnaireSubmit(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    timing: str  # 'pre' or 'post'
    responses: list  # list of {question: str, score: int}


class ChatRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    message: str
    history: Optional[list] = None


# === IGOR: Diary ===

class DiaryRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    entry_type: str = "user_note"  # 'user_note', 'auto_summary', 'ai_insight'
    content: str


class SessionEmotionData(BaseModel):
    session_id: str
    user_id: str
    emotion_timeline: list  # list of {timestamp, emotions, dominantEmotion}


class SessionRecapRequest(BaseModel):
    user_id: str
    session_id: str
