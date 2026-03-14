"""Pydantic models for questionnaire endpoints."""

from pydantic import BaseModel
from typing import Optional


class QuestionnaireSubmit(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    timing: str  # 'pre' or 'post'
    responses: list  # list of {question: str, score: int}


class QuestionnaireRequest(BaseModel):
    user_id: str
    session_id: str
    phase: str  # "pre" or "post"
    answers: list[int]  # list of 9 scores (0-3)
