"""FastAPI application — mounts frontend, includes all routers."""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv(override=True)

app = FastAPI()

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    return (FRONTEND_DIR / "index.html").read_text()


# Import and include all routers
from backend.routes.pipeline import router as pipeline_router
from backend.routes.download import router as download_router
from backend.routes.history import router as history_router
from backend.routes.meditation import router as meditation_router
from backend.routes.questionnaire import router as questionnaire_router
from backend.routes.chat import router as chat_router
from backend.routes.diary import router as diary_router
from backend.routes.emotion_suggestion import router as emotion_suggestion_router

app.include_router(pipeline_router)
app.include_router(download_router)
app.include_router(history_router)
app.include_router(meditation_router)
app.include_router(questionnaire_router)
app.include_router(chat_router)
app.include_router(diary_router)
app.include_router(emotion_suggestion_router)

# Mount static files last (catch-all)
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
