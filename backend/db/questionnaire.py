"""Questionnaire CRUD operations."""

import json
from backend.db.connection import get_db


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
