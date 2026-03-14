"""User CRUD operations."""

from backend.db.connection import get_db


def ensure_user(user_id: str):
    """Create user row if it doesn't exist."""
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO users (user_id) VALUES (?)",
        (user_id,)
    )
    conn.commit()
    conn.close()
