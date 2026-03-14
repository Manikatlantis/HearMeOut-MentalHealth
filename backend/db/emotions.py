"""Emotion data and dashboard operations."""

import json
from backend.db.connection import get_db


def save_emotion_data(session_id: str, emotion_data: list):
    """Store emotion timeline for a session."""
    conn = get_db()
    conn.execute("""
        UPDATE sessions SET emotion_data_json = ? WHERE session_id = ?
    """, (json.dumps(emotion_data), session_id))
    conn.commit()
    conn.close()


def get_dashboard_data(user_id: str):
    """Aggregate data for the wellness dashboard."""
    conn = get_db()

    # Questionnaire trend
    rows = conn.execute("""
        SELECT q.session_id, q.timing, q.total_score, q.created_at
        FROM questionnaire_responses q
        WHERE q.user_id = ?
        ORDER BY q.created_at ASC
    """, (user_id,)).fetchall()

    sessions_map = {}
    for row in rows:
        sid = row["session_id"]
        if sid not in sessions_map:
            sessions_map[sid] = {"session_id": sid, "pre": None, "post": None, "date": row["created_at"]}
        sessions_map[sid][row["timing"]] = row["total_score"]

    questionnaire_trend = list(sessions_map.values())

    # Emotion aggregate from sessions
    emotion_rows = conn.execute("""
        SELECT emotion_data_json FROM sessions
        WHERE user_id = ? AND emotion_data_json IS NOT NULL
    """, (user_id,)).fetchall()

    emotion_totals = {}
    emotion_count = 0
    for row in emotion_rows:
        try:
            timeline = json.loads(row["emotion_data_json"])
            for entry in timeline:
                emotions = entry.get("emotions", {})
                for emo, val in emotions.items():
                    emotion_totals[emo] = emotion_totals.get(emo, 0) + val
                    emotion_count += 1
        except (json.JSONDecodeError, TypeError):
            pass

    # Normalize
    emotion_aggregate = {}
    if emotion_count > 0:
        total = sum(emotion_totals.values())
        if total > 0:
            emotion_aggregate = {k: round(v / total, 3) for k, v in emotion_totals.items()}

    # Session stats
    stats = conn.execute("""
        SELECT COUNT(*) as cnt, MIN(created_at) as first_dt, MAX(created_at) as last_dt
        FROM sessions WHERE user_id = ?
    """, (user_id,)).fetchone()

    conn.close()

    return {
        "session_count": stats["cnt"] if stats else 0,
        "first_session": stats["first_dt"] if stats else None,
        "latest_session": stats["last_dt"] if stats else None,
        "questionnaire_trend": questionnaire_trend,
        "emotion_aggregate": emotion_aggregate,
    }
