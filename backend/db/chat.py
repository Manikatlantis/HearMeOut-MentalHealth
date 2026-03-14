"""Chat CRUD operations."""

from backend.db.connection import get_db


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
