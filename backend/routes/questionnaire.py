"""Questionnaire routes."""

import os
import json
from fastapi import APIRouter
import anthropic

from backend.models import QuestionnaireRequest, SessionEmotionData, SessionRecapRequest
from backend.db import (
    save_questionnaire, get_questionnaire_comparison,
    save_emotion_data, get_session, get_dashboard_data,
)

router = APIRouter()


@router.post("/api/questionnaire")
def submit_questionnaire(req: QuestionnaireRequest):
    """Save pre or post questionnaire responses."""
    total_score = sum(req.answers)

    save_questionnaire(
        user_id=req.user_id,
        session_id=req.session_id,
        timing=req.phase,
        responses=req.answers,
        total_score=total_score,
    )

    result = {"status": "saved", "phase": req.phase, "total_score": total_score}

    # If this is a post-questionnaire, compute delta from pre
    if req.phase == "post":
        comparison = get_questionnaire_comparison(req.user_id, req.session_id)
        if comparison.get("delta") is not None:
            result["delta"] = comparison["delta"]
            result["pre_score"] = comparison["pre"]["total_score"]
            result["post_score"] = comparison["post"]["total_score"]

    return result


@router.get("/api/questionnaire/{user_id}/{session_id}")
def get_questionnaire(user_id: str, session_id: str):
    """Get pre/post comparison for a session."""
    return get_questionnaire_comparison(user_id, session_id)


@router.post("/api/emotion-data")
def save_emotion(req: SessionEmotionData):
    """Store emotion timeline for a session."""
    save_emotion_data(req.session_id, req.emotion_timeline)
    return {"status": "saved"}


@router.post("/api/session-recap")
def session_recap(req: SessionRecapRequest):
    """Generate an AI therapeutic reflection for a completed session."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "Recap service unavailable"}

    session = get_session(req.session_id)
    comparison = get_questionnaire_comparison(req.user_id, req.session_id)

    # Build context for Claude
    story = session.get("user_input", "") if session else ""
    narrative = session.get("narrative", "") if session else ""
    features = session.get("musical_features", {}) if session else {}
    emotion_data = None
    if session and session.get("emotion_data_json"):
        try:
            emotion_data = json.loads(session["emotion_data_json"])
        except (json.JSONDecodeError, TypeError):
            pass

    pre_score = comparison.get("pre", {}).get("total_score") if comparison.get("pre") else None
    post_score = comparison.get("post", {}).get("total_score") if comparison.get("post") else None
    delta = comparison.get("delta")

    context_parts = []
    context_parts.append(f"User's story: {story}")
    if narrative:
        context_parts.append(f"AI narrative: {narrative}")
    if features:
        genre = features.get("genre", "unknown")
        mood = features.get("mood", "unknown")
        instruments = ", ".join(features.get("instruments", [])) if isinstance(features.get("instruments"), list) else ""
        context_parts.append(f"Musical choices: {genre} genre, {mood} mood, instruments: {instruments}")
    if emotion_data and len(emotion_data) > 0:
        dominant_emotions = {}
        for entry in emotion_data:
            dom = entry.get("dominantEmotion", "neutral")
            dominant_emotions[dom] = dominant_emotions.get(dom, 0) + 1
        top_emotions = sorted(dominant_emotions.items(), key=lambda x: -x[1])[:3]
        context_parts.append(f"Emotional response during playback: {', '.join(f'{e[0]} ({e[1]} moments)' for e in top_emotions)}")
    if pre_score is not None and post_score is not None:
        context_parts.append(f"Wellness score: pre={pre_score}/27, post={post_score}/27, change={delta:+d}")
    elif pre_score is not None:
        context_parts.append(f"Pre-session wellness score: {pre_score}/27")

    session_context = "\n".join(context_parts)

    system_prompt = (
        "You are a compassionate music therapist reflecting on a client's session with the app 'Hear Me Out'. "
        "The app generates personalized songs based on the user's emotional story. "
        "Generate a warm, insightful therapeutic reflection. "
        "Return ONLY valid JSON with these fields:\n"
        '- "headline": A poetic 4-8 word title for the session (e.g., "A Journey From Tension to Release")\n'
        '- "reflection": 2-3 sentences tying together the story, the music choice, and the therapeutic value\n'
        '- "emotion_insight": 1-2 sentences about their emotional response during playback (ONLY if emotion data is provided, otherwise set to null)\n'
        '- "score_insight": 1-2 sentences interpreting their wellness score change (ONLY if score data is provided, otherwise set to null)\n'
        '- "next_step": One encouraging suggestion for their next session\n'
        '- "recommended_exercise": A personalized therapeutic exercise object with fields: '
        '"name" (short title), "description" (1 sentence why this helps), '
        '"steps" (array of 3-4 simple instruction strings), "duration" (e.g. "2-3 minutes"). '
        "Choose from evidence-based techniques: grounding (5-4-3-2-1 senses), box breathing, "
        "progressive muscle relaxation, gratitude journaling, body scan, self-compassion meditation, "
        "or emotional labeling. Match the exercise to their emotional state and session outcome.\n"
        "Be warm but not saccharine. Be specific to their story, not generic."
    )

    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": session_context}],
        )
        recap_text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if recap_text.startswith("```"):
            recap_text = recap_text.split("\n", 1)[1] if "\n" in recap_text else recap_text[3:]
            if recap_text.endswith("```"):
                recap_text = recap_text[:-3].strip()
        recap = json.loads(recap_text)
    except (json.JSONDecodeError, Exception) as e:
        print(f"[session-recap] Error: {type(e).__name__}: {e}")
        recap = {
            "headline": "Your Musical Journey",
            "reflection": "Thank you for sharing your story through music. Each session is a step toward deeper self-understanding.",
            "emotion_insight": None,
            "score_insight": f"Your wellness score changed by {delta:+d} points." if delta is not None else None,
            "next_step": "Consider exploring a different mood or genre in your next session to discover new emotional landscapes."
        }

    recap["pre_score"] = pre_score
    recap["post_score"] = post_score
    recap["delta"] = delta
    return recap


@router.get("/api/dashboard/{user_id}")
def get_dashboard(user_id: str):
    """Get aggregated dashboard data for a user."""
    return get_dashboard_data(user_id)
