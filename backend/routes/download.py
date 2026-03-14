"""Download and audio serving routes."""

from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse

from backend.db import get_session
from backend.routes.pipeline import sessions

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@router.get("/audio/{filename}")
def serve_audio(filename: str):
    """Serve generated audio files."""
    file_path = PROJECT_ROOT / "output" / filename
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(file_path, media_type="audio/mpeg")


@router.get("/api/download/{session_id}")
def download_song(session_id: str):
    """Download the generated MP3 for a session."""
    session = get_session(session_id)
    if not session or not session.get("audio_filename"):
        # Check in-memory sessions too
        orchestrator = sessions.get(session_id)
        if orchestrator and orchestrator.context.audio_file:
            file_path = Path(orchestrator.context.audio_file)
            if not file_path.is_absolute():
                file_path = PROJECT_ROOT / file_path
            if file_path.exists():
                features = orchestrator.context.musical_features
                mood = features.mood or "song"
                genre = features.genre or "ai"
                from datetime import date
                filename = f"hearmeout_{mood}_{genre}_{date.today().isoformat()}.mp3"
                return FileResponse(
                    str(file_path),
                    media_type="audio/mpeg",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                )
        return {"error": "No audio found for this session"}

    audio_filename = session["audio_filename"]
    file_path = PROJECT_ROOT / "output" / audio_filename
    if not file_path.exists():
        return {"error": "Audio file not found on disk"}

    features = session.get("musical_features", {})
    mood = features.get("mood", "song") if features else "song"
    genre = features.get("genre", "ai") if features else "ai"
    from datetime import date
    filename = f"hearmeout_{mood}_{genre}_{date.today().isoformat()}.mp3"

    return FileResponse(
        str(file_path),
        media_type="audio/mpeg",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
