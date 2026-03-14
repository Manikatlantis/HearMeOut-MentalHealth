import sys
import os
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from orchestrator import Orchestrator
from models import ProcessRequest, FeedbackRequest, MeditationRequest
from db import (
    ensure_user, save_session, get_user_sessions, get_session,
    init_db,
)

app = FastAPI()

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    return (FRONTEND_DIR / "index.html").read_text()


@app.get("/audio/{filename}")
def serve_audio(filename: str):
    # eleven_generator saves to output/ relative to CWD (this backend dir)
    backend_dir = Path(__file__).resolve().parent
    file_path = backend_dir / "output" / filename
    if not file_path.exists():
        # Fallback to project root output dir
        file_path = PROJECT_ROOT / "output" / filename
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(file_path, media_type="audio/mpeg")

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active sessions keyed by session ID
sessions: dict[str, Orchestrator] = {}


@app.post("/process")
def process(request: ProcessRequest):
    """Start a new pipeline session from user input."""
    ensure_user(request.user_id)

    # Generate a unique session ID
    session_id = request.session_id
    if session_id == "default":
        session_id = str(uuid.uuid4())[:8]

    orchestrator = Orchestrator(request.text, generator=request.generator)
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
    }


@app.post("/refine")
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
    }


@app.get("/status/{session_id}")
def status(session_id: str = "default"):
    """Get the current state of a pipeline session."""
    orchestrator = sessions.get(session_id)
    if not orchestrator:
        return {"error": f"No active session '{session_id}'."}
    return orchestrator.get_status()


# === MANIK: Download, History, Meditation ===

@app.get("/api/download/{session_id}")
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
    backend_dir = Path(__file__).resolve().parent
    file_path = backend_dir / "output" / audio_filename
    if not file_path.exists():
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


@app.get("/api/history/{user_id}")
def get_history(user_id: str):
    """List past sessions for a user."""
    return get_user_sessions(user_id)


@app.post("/api/meditation")
def meditation(request: MeditationRequest):
    """Generate meditation script + ambient audio."""
    ensure_user(request.user_id)

    from meditation_generator import generate_meditation_script, generate_ambient_music

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


# === SYED: Questionnaire + Ethics + Chatbot ===
# (Syed will add endpoints here)

# === IGOR: Diary ===
# (Igor will add endpoints here)
