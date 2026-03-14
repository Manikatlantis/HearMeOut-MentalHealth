"""SQLite database layer — schema init, connection helper, CRUD functions."""

import json
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "hearmeout.db"


def get_db() -> sqlite3.Connection:
    """Get a SQLite connection with Row factory enabled."""
    os.makedirs(DB_PATH.parent, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            created_at TEXT DEFAULT (datetime('now')),
            preferences_json TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS questionnaire_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id TEXT,
            timing TEXT NOT NULL,
            responses_json TEXT NOT NULL,
            total_score INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_input TEXT NOT NULL,
            narrative TEXT,
            lyrics TEXT,
            musical_features_json TEXT,
            audio_filename TEXT,
            emotion_data_json TEXT,
            iteration INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS diary_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id TEXT,
            entry_type TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


# === User CRUD ===

def ensure_user(user_id: str):
    """Create user row if it doesn't exist."""
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO users (user_id) VALUES (?)",
        (user_id,)
    )
    conn.commit()
    conn.close()


# === Session CRUD ===

def save_session(session_id: str, user_id: str, user_input: str,
                 narrative: str = None, lyrics: str = None,
                 musical_features: dict = None, audio_filename: str = None,
                 iteration: int = 0):
    """Insert or update a session record."""
    conn = get_db()
    features_json = json.dumps(musical_features) if musical_features else None
    conn.execute("""
        INSERT INTO sessions (session_id, user_id, user_input, narrative, lyrics,
                              musical_features_json, audio_filename, iteration, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(session_id) DO UPDATE SET
            narrative=excluded.narrative,
            lyrics=excluded.lyrics,
            musical_features_json=excluded.musical_features_json,
            audio_filename=excluded.audio_filename,
            iteration=excluded.iteration,
            updated_at=datetime('now')
    """, (session_id, user_id, user_input, narrative, lyrics,
          features_json, audio_filename, iteration))
    conn.commit()
    conn.close()


def get_user_sessions(user_id: str, limit: int = 50):
    """Get past sessions for a user, newest first."""
    conn = get_db()
    rows = conn.execute("""
        SELECT session_id, user_input, narrative, lyrics,
               musical_features_json, audio_filename, iteration,
               created_at, updated_at
        FROM sessions WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
    """, (user_id, limit)).fetchall()
    conn.close()

    results = []
    for row in rows:
        entry = dict(row)
        if entry["musical_features_json"]:
            entry["musical_features"] = json.loads(entry["musical_features_json"])
        else:
            entry["musical_features"] = None
        del entry["musical_features_json"]
        results.append(entry)
    return results


def get_session(session_id: str):
    """Get a single session by ID."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM sessions WHERE session_id = ?",
        (session_id,)
    ).fetchone()
    conn.close()
    if row:
        entry = dict(row)
        if entry.get("musical_features_json"):
            entry["musical_features"] = json.loads(entry["musical_features_json"])
        return entry
    return None


# === Questionnaire CRUD ===

def save_questionnaire(user_id: str, session_id: str, timing: str,
                       responses: list, total_score: int):
    """Save a questionnaire response."""
    conn = get_db()
    conn.execute("""
        INSERT INTO questionnaire_responses (user_id, session_id, timing, responses_json, total_score)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, session_id, timing, json.dumps(responses), total_score))
    conn.commit()
    conn.close()


def get_questionnaire_comparison(user_id: str, session_id: str):
    """Get pre/post questionnaire comparison for a session."""
    conn = get_db()
    rows = conn.execute("""
        SELECT timing, responses_json, total_score, created_at
        FROM questionnaire_responses
        WHERE user_id = ? AND session_id = ?
        ORDER BY created_at
    """, (user_id, session_id)).fetchall()
    conn.close()

    result = {"pre": None, "post": None, "delta": None}
    for row in rows:
        data = dict(row)
        data["responses"] = json.loads(data["responses_json"])
        del data["responses_json"]
        result[data["timing"]] = data

    if result["pre"] and result["post"]:
        result["delta"] = result["post"]["total_score"] - result["pre"]["total_score"]
    return result


# === Chat CRUD ===

def save_chat_message(user_id: str, session_id: str, role: str, content: str):
    """Save a chat message."""
    conn = get_db()
    conn.execute("""
        INSERT INTO chat_messages (user_id, session_id, role, content)
        VALUES (?, ?, ?, ?)
    """, (user_id, session_id, role, content))
    conn.commit()
    conn.close()


def get_chat_history(user_id: str, limit: int = 100):
    """Get chat history for a user."""
    conn = get_db()
    rows = conn.execute("""
        SELECT role, content, created_at
        FROM chat_messages WHERE user_id = ?
        ORDER BY created_at ASC LIMIT ?
    """, (user_id, limit)).fetchall()
    conn.close()
    return [dict(row) for row in rows]


# === Diary CRUD ===

def save_diary_entry(user_id: str, session_id: str, entry_type: str,
                     content: str, metadata: dict = None):
    """Save a diary entry."""
    conn = get_db()
    conn.execute("""
        INSERT INTO diary_entries (user_id, session_id, entry_type, content, metadata_json)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, session_id, entry_type, content,
          json.dumps(metadata) if metadata else None))
    conn.commit()
    conn.close()


def get_diary_entries(user_id: str, limit: int = 100):
    """Get all diary entries for a user."""
    conn = get_db()
    rows = conn.execute("""
        SELECT id, session_id, entry_type, content, metadata_json, created_at
        FROM diary_entries WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
    """, (user_id, limit)).fetchall()
    conn.close()

    results = []
    for row in rows:
        entry = dict(row)
        if entry["metadata_json"]:
            entry["metadata"] = json.loads(entry["metadata_json"])
        else:
            entry["metadata"] = None
        del entry["metadata_json"]
        results.append(entry)
    return results


# === Emotion Data ===

def save_emotion_data(session_id: str, emotion_data: list):
    """Store emotion timeline for a session."""
    conn = get_db()
    conn.execute("""
        UPDATE sessions SET emotion_data_json = ? WHERE session_id = ?
    """, (json.dumps(emotion_data), session_id))
    conn.commit()
    conn.close()


# Initialize DB on import
init_db()
