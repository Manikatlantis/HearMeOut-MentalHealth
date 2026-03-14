"""Session CRUD operations."""

import json
from backend.db.connection import get_db


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
