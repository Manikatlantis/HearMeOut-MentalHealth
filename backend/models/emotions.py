"""Pydantic models for emotion and recap endpoints."""

from pydantic import BaseModel


class SessionEmotionData(BaseModel):
    session_id: str
    user_id: str
    emotion_timeline: list  # list of {timestamp, emotions, dominantEmotion}


class SessionRecapRequest(BaseModel):
    user_id: str
    session_id: str


class EmotionSuggestionRequest(BaseModel):
    session_id: str
    user_id: str
    emotion_timeline: list      # raw timeline from frontend
    analysis: dict              # {peakMoments, flatMoments, overallDominant, engagementScore}
    lyrics: str
    narrative: str
    musical_features: dict      # {genre, mood, tempo, key, ...}
