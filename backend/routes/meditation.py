"""Meditation route."""

import uuid
from pathlib import Path
from fastapi import APIRouter

from backend.models import MeditationRequest
from backend.db import ensure_user

router = APIRouter()


@router.post("/api/meditation")
def meditation(request: MeditationRequest):
    """Generate meditation script + TTS narration."""
    ensure_user(request.user_id)

    from pipeline.meditation_generator import generate_meditation_script, generate_narration

    script = generate_meditation_script(
        story_context=request.story_context,
        mode=request.mode,
    )

    # Generate TTS narration (voice-guided meditation)
    label = request.session_id or str(uuid.uuid4())[:8]
    narration_url = None
    try:
        narration_path = generate_narration(
            segments=script["segments"],
            session_label=label,
        )
        narration_url = "/audio/" + Path(narration_path).name
    except Exception as e:
        print(f"Meditation narration generation failed: {e}")

    return {
        "title": script["title"],
        "segments": script["segments"],
        "duration_estimate": script["duration_estimate"],
        "narration_url": narration_url,
        "audio_url": narration_url,  # backward compat
    }
