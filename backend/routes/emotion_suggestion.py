"""Emotion suggestion route — uses Claude to analyze facial emotion timeline."""

import os
from fastapi import APIRouter
import anthropic

from backend.models import EmotionSuggestionRequest

router = APIRouter()

SYSTEM_PROMPT = (
    "You are an emotion analyst for a music therapy app. "
    "Given a listener's facial emotion data during song playback plus the song's lyrics "
    "and musical features, write a 2-3 sentence suggestion explaining what the listener's "
    "expressions revealed and how the next version should differ. Be specific — reference "
    "song sections, emotions detected, and musical elements. "
    "Write as direct instructions to a song generator."
)


def _downsample_timeline(timeline: list, window_sec: float = 5.0) -> list:
    """Downsample emotion timeline into ~5-second summary windows."""
    if not timeline:
        return []

    windows = []
    current_window = []
    window_start = timeline[0].get("timestamp", 0) if timeline else 0

    for entry in timeline:
        ts = entry.get("timestamp", 0)
        if ts - window_start >= window_sec and current_window:
            windows.append(_average_window(current_window, window_start))
            window_start = ts
            current_window = []
        current_window.append(entry)

    if current_window:
        windows.append(_average_window(current_window, window_start))

    return windows[:10]  # cap at 10 windows


def _average_window(entries: list, start_time: float) -> dict:
    """Average emotions across entries in a window."""
    emotions = {}
    count = len(entries)
    for entry in entries:
        for emo_key, emo_val in entry.get("emotions", {}).items():
            emotions[emo_key] = emotions.get(emo_key, 0) + emo_val

    averaged = {k: round(v / count, 3) for k, v in emotions.items()}
    dominant = max(averaged, key=averaged.get) if averaged else "neutral"

    return {
        "time": round(start_time, 1),
        "emotions": averaged,
        "dominant": dominant,
    }


@router.post("/api/emotion-suggestion")
def emotion_suggestion(req: EmotionSuggestionRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"suggestion": None}

    try:
        windows = _downsample_timeline(req.emotion_timeline)

        # Build the user prompt
        user_prompt = (
            f"## Emotion Timeline (summarized in {len(windows)} windows)\n"
        )
        for w in windows:
            user_prompt += f"- {w['time']}s: dominant={w['dominant']}, emotions={w['emotions']}\n"

        user_prompt += (
            f"\n## Analysis Highlights\n"
            f"- Overall dominant emotion: {req.analysis.get('overallDominant', 'unknown')}\n"
            f"- Engagement score: {req.analysis.get('engagementScore', 0)}\n"
            f"- Peak moments: {len(req.analysis.get('peakMoments', []))} detected\n"
            f"- Flat moments: {len(req.analysis.get('flatMoments', []))} detected\n"
            f"\n## Song Lyrics (snippet)\n{req.lyrics[:500]}\n"
            f"\n## Narrative\n{req.narrative[:300]}\n"
            f"\n## Musical Features\n{req.musical_features}\n"
        )

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        suggestion = response.content[0].text
        return {"suggestion": suggestion}

    except Exception as e:
        print(f"[emotion-suggestion] Error: {e}")
        return {"suggestion": None}
