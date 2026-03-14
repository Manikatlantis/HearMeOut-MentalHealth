"""Database layer — re-exports all public functions."""

from backend.db.connection import get_db, init_db
from backend.db.users import ensure_user
from backend.db.sessions import save_session, get_user_sessions, get_session
from backend.db.questionnaire import save_questionnaire, get_questionnaire_comparison
from backend.db.chat import save_chat_message, get_chat_history
from backend.db.diary import save_diary_entry, get_diary_entries
from backend.db.emotions import save_emotion_data, get_dashboard_data

# Initialize DB on import
init_db()
