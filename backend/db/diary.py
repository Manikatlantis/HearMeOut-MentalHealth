"""Diary CRUD operations."""

import json
from backend.db.connection import get_db


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
