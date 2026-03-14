"""Chat routes."""

import os
from fastapi import APIRouter
import anthropic

from backend.models import ChatRequest
from backend.db import save_chat_message, get_chat_history as db_get_chat_history

router = APIRouter()


@router.post("/api/chat")
def chat(req: ChatRequest):
    """Send a message to the Claude chatbot and get a response."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"reply": "Chat service is currently unavailable.", "summary": None}

    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        "You are a compassionate music therapy assistant for the app 'Hear Me Out'. "
        "Help the user articulate their emotions and story for music generation. "
        "Ask gentle follow-up questions to understand their feelings deeply. "
        "When you feel you have enough context (after 2-3 exchanges), summarize their story "
        "in a way that would work well as input for an AI music generator. "
        "When you provide a summary, prefix it with 'STORY SUMMARY:' on its own line. "
        "Do NOT provide medical advice, diagnoses, or clinical recommendations. "
        "Keep responses warm, brief (2-3 sentences), and encouraging."
    )

    # Build message history for Claude
    messages = []
    if req.history:
        for msg in req.history[-18:]:
            if msg.get("role") in ("user", "assistant"):
                messages.append({"role": msg["role"], "content": msg["content"]})

    # Ensure the last message is the user's new message
    if not messages or messages[-1]["content"] != req.message:
        messages.append({"role": "user", "content": req.message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=system_prompt,
        messages=messages,
    )

    reply_text = response.content[0].text

    # Save to DB
    save_chat_message(req.user_id, req.session_id, "user", req.message)
    save_chat_message(req.user_id, req.session_id, "assistant", reply_text)

    # Extract summary if present
    summary = None
    if "STORY SUMMARY:" in reply_text:
        parts = reply_text.split("STORY SUMMARY:")
        summary = parts[1].strip()

    return {"reply": reply_text, "summary": summary}


@router.get("/api/chat/history")
def get_chat_history_endpoint(user_id: str):
    """Get chat history for a user."""
    rows = db_get_chat_history(user_id)
    return {"messages": [{"role": r["role"], "content": r["content"]} for r in rows]}
