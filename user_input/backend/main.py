import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from orchestrator import Orchestrator

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


class ProcessRequest(BaseModel):
    text: str
    session_id: str = "default"
    generator: str = "eleven"


class FeedbackRequest(BaseModel):
    feedback: str
    session_id: str = "default"


@app.post("/process")
def process(request: ProcessRequest):
    """Start a new pipeline session from user input."""
    orchestrator = Orchestrator(request.text, generator=request.generator)
    context = orchestrator.run_full_cycle()
    sessions[request.session_id] = orchestrator

    # Build audio URL for the frontend
    audio_url = None
    if context.audio_file:
        audio_url = "/audio/" + Path(context.audio_file).name

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


@app.post("/refine")
def refine(request: FeedbackRequest):
    """Refine an existing session with user feedback."""
    orchestrator = sessions.get(request.session_id)
    if not orchestrator:
        return {"error": f"No active session '{request.session_id}'. Call /process first."}

    context = orchestrator.refine(request.feedback)

    audio_url = None
    if context.audio_file:
        audio_url = "/audio/" + Path(context.audio_file).name

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
