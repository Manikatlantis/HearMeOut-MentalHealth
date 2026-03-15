"""Pipeline routes: /process, /refine, /status"""

import uuid
from pathlib import Path
from fastapi import APIRouter

from pipeline import Orchestrator
from backend.models import ProcessRequest, FeedbackRequest
from backend.db import ensure_user, save_session

router = APIRouter()

# Store active sessions keyed by session ID
sessions: dict[str, Orchestrator] = {}


@router.post("/process")
def process(request: ProcessRequest):
    """Start a new pipeline session from user input."""
    ensure_user(request.user_id)

    # Generate a unique session ID
    session_id = request.session_id
    if session_id == "default":
        session_id = str(uuid.uuid4())[:8]

    # Prefer emotional_profile, fall back to therapeutic_context for backward compat
    profile = request.emotional_profile or request.therapeutic_context
    orchestrator = Orchestrator(request.text, generator=request.generator, emotional_profile=profile)
    context = orchestrator.run_full_cycle()
    sessions[session_id] = orchestrator

    # Build audio URL for the frontend
    audio_url = None
    audio_filename = None
    if context.audio_file:
        audio_filename = Path(context.audio_file).name
        audio_url = "/audio/" + audio_filename

    # Persist to DB
    save_session(
        session_id=session_id,
        user_id=request.user_id,
        user_input=request.text,
        narrative=context.narrative,
        lyrics=context.lyrics,
        musical_features=context.musical_features.to_dict(),
        audio_filename=audio_filename,
        iteration=context.iteration,
    )

    return {
        "session_id": session_id,
        "iteration": context.iteration,
        "narrative": context.narrative,
        "lyrics": context.lyrics,
        "musical_features": context.musical_features.to_dict(),
        "audio_file": context.audio_file,
        "audio_url": audio_url,
        "pdf_file": context.pdf_file,
        "word_alignment": context.word_alignment,
    }


@router.post("/refine")
def refine(request: FeedbackRequest):
    """Refine an existing session with user feedback."""
    orchestrator = sessions.get(request.session_id)
    if not orchestrator:
        return {"error": f"No active session '{request.session_id}'. Call /process first."}

    context = orchestrator.refine(request.feedback)

    audio_url = None
    audio_filename = None
    if context.audio_file:
        audio_filename = Path(context.audio_file).name
        audio_url = "/audio/" + audio_filename

    # Update DB
    save_session(
        session_id=request.session_id,
        user_id=request.user_id,
        user_input=context.original_input,
        narrative=context.narrative,
        lyrics=context.lyrics,
        musical_features=context.musical_features.to_dict(),
        audio_filename=audio_filename,
        iteration=context.iteration,
    )

    return {
        "session_id": request.session_id,
        "iteration": context.iteration,
        "narrative": context.narrative,
        "lyrics": context.lyrics,
        "musical_features": context.musical_features.to_dict(),
        "audio_file": context.audio_file,
        "audio_url": audio_url,
        "pdf_file": context.pdf_file,
        "word_alignment": context.word_alignment,
    }


@router.get("/status/{session_id}")
def status(session_id: str = "default"):
    """Get the current state of a pipeline session."""
    orchestrator = sessions.get(session_id)
    if not orchestrator:
        return {"error": f"No active session '{session_id}'."}
    return orchestrator.get_status()
