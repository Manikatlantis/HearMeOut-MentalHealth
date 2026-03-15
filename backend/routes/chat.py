"""Chat routes."""

import json
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
        "Your goal is to deeply understand the user's emotional state so the app can generate "
        "a therapeutically personalized song.\n\n"
        "CONVERSATION GUIDELINES:\n"
        "- Have a meaningful conversation of 5-8 exchanges before summarizing.\n"
        "- Ask gentle, open-ended follow-up questions to explore their feelings.\n"
        "- Listen for the SPECIFIC relationship type (platonic friendship, romantic partner, family, colleague, self, community).\n"
        "- Identify the CONCRETE trigger event — what actually happened.\n"
        "- Explore whether this is a recurring pattern or a one-time event.\n"
        "- Listen for self-blame or self-attribution ('maybe it's me', 'I try so hard').\n"
        "- Identify the core wound beneath the surface event.\n"
        "- Understand what specific reassurance would help vs. what would feel dismissive.\n"
        "- Do NOT diagnose, label, or provide medical advice.\n"
        "- Keep each response warm, brief (2-3 sentences), and encouraging.\n\n"
        "DOMAIN CLASSIFICATION — When summarizing, you MUST distinguish between:\n"
        "- Friendship drift vs. romantic breakup (different imagery, different wounds)\n"
        "- Grief (death) vs. anticipatory grief (someone leaving)\n"
        "- Family conflict vs. estrangement vs. abuse\n"
        "- Loneliness (situational) vs. loneliness (chronic/identity)\n"
        "- Self-blame (pattern) vs. guilt (specific act)\n"
        "- Anxiety (future) vs. anxiety (present danger)\n\n"
        "WHEN READY TO SUMMARIZE (after 5+ exchanges):\n"
        "Include BOTH of these sections in your response:\n\n"
        "EMOTIONAL PROFILE:\n"
        '{"relationship_type": "<platonic_friendship|romantic_partner|family|colleague|self|community>",'
        '"relationship_details": "<specific details about the relationship>",'
        '"trigger_event": "<what happened that brought this up>",'
        '"timeline": "<duration and timing context>",'
        '"emotional_domain": "<friendship_loss|romantic_breakup|grief|family_conflict|abandonment|loneliness|self_blame|anxiety|shame|burnout|rejection|estrangement|heartbreak|overwhelm|invisibility|inadequacy|hopelessness>",'
        '"primary_emotion": "<the dominant feeling>",'
        '"secondary_emotions": ["<additional emotions>"],'
        '"recurring_pattern": "<if this has happened before, describe it — or null>",'
        '"self_attribution": "<what the user blames themselves for — or null>",'
        '"core_wound": "<the deepest belief underneath the event>",'
        '"feared_future": "<what they are afraid will happen>",'
        '"therapeutic_need": "<what they actually need emotionally>",'
        '"what_would_help": "<what kind of message would feel seen and safe>",'
        '"what_would_hurt": "<what would feel dismissive, minimizing, or invalidating>",'
        '"concrete_images": ["<specific details from conversation that can become song imagery>"],'
        '"severity": "<mild|moderate|significant>"}\n\n'
        "STORY SUMMARY:\n"
        "<A rich, emotionally detailed summary of their story that would work well as input "
        "for an AI music generator. Weave in the emotional themes naturally. "
        "Include SPECIFIC details from the conversation — concrete events, relationship details, "
        "the user's own words and metaphors. Do NOT generalize or abstract away the specifics.>"
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
        max_tokens=1200,
        system=system_prompt,
        messages=messages,
    )

    reply_text = response.content[0].text

    # Save to DB
    save_chat_message(req.user_id, req.session_id, "user", req.message)
    save_chat_message(req.user_id, req.session_id, "assistant", reply_text)

    # Extract emotional profile if present (with backward compat for therapeutic context)
    emotional_profile = None
    if "EMOTIONAL PROFILE:" in reply_text:
        try:
            ep_parts = reply_text.split("EMOTIONAL PROFILE:")
            ep_text = ep_parts[1].split("STORY SUMMARY:")[0].strip()
            emotional_profile = json.loads(ep_text)
        except (json.JSONDecodeError, IndexError):
            emotional_profile = None
    elif "THERAPEUTIC CONTEXT:" in reply_text:
        try:
            tc_parts = reply_text.split("THERAPEUTIC CONTEXT:")
            tc_text = tc_parts[1].split("STORY SUMMARY:")[0].strip()
            emotional_profile = json.loads(tc_text)
        except (json.JSONDecodeError, IndexError):
            emotional_profile = None

    # Extract summary if present
    summary = None
    if "STORY SUMMARY:" in reply_text:
        parts = reply_text.split("STORY SUMMARY:")
        summary = parts[1].strip()

    return {
        "reply": reply_text,
        "summary": summary,
        "emotional_profile": emotional_profile,
        "therapeutic_context": emotional_profile,  # backward compat
    }


@router.get("/api/chat/history")
def get_chat_history_endpoint(user_id: str):
    """Get chat history for a user."""
    rows = db_get_chat_history(user_id)
    return {"messages": [{"role": r["role"], "content": r["content"]} for r in rows]}
