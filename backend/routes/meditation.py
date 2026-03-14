"""Meditation route."""

import uuid
from pathlib import Path
from fastapi import APIRouter

from backend.models import MeditationRequest
from backend.db import ensure_user

router = APIRouter()


@router.post("/api/meditation")
def meditation(request: MeditationRequest):
    """Generate meditation script + ambient audio."""
    ensure_user(request.user_id)

    from pipeline.meditation_generator import generate_meditation_script, generate_ambient_music

    script = generate_meditation_script(
        story_context=request.story_context,
        mode=request.mode,
    )

    # Generate ambient music
    label = request.session_id or str(uuid.uuid4())[:8]
    try:
        audio_path = generate_ambient_music(
            duration_seconds=script["duration_estimate"],
            session_label=label,
        )
        audio_url = "/audio/" + Path(audio_path).name
    except Exception as e:
        print(f"Meditation audio generation failed: {e}")
        audio_url = None

    return {
        "title": script["title"],
        "segments": script["segments"],
        "duration_estimate": script["duration_estimate"],
        "audio_url": audio_url,
    }
