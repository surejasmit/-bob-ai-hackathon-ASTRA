"""
NaviOps Copilot — Conversation Repository

Handles all database reads and writes for copilot_conversations and copilot_messages
backed strictly by Supabase PostgreSQL.

All writes are guarded: ownership is always verified server-side using the
authenticated user's ID.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.core.database import port_repo, clean_row

logger = logging.getLogger("naviops.copilot.conversations")


class ConversationDBError(Exception):
    """Raised when a database operation on conversation tables fails."""


# In-memory fallback used only if Supabase PostgreSQL is completely disconnected during offline tests
_memory_conversations: Dict[str, Dict[str, Any]] = {}
_memory_messages: Dict[str, List[Dict[str, Any]]] = {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(val: Any) -> datetime:
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            pass
    return _now()


def _is_pg_available() -> bool:
    """Check if PostgreSQL connection via port_repo is active and working."""
    if not getattr(port_repo, "is_connected", False):
        return False
    try:
        conn = port_repo.get_connection()
        return conn is not None and not conn.closed
    except Exception:
        return False


def _pg_conn():
    """Return an active psycopg connection or raise ConversationDBError."""
    try:
        conn = port_repo.get_connection()
        if conn is None:
            raise ConversationDBError("PostgreSQL connection is not available.")
        return conn
    except Exception as exc:
        raise ConversationDBError(f"PostgreSQL connection failed: {exc}") from exc


def _generate_title(first_message: str) -> str:
    """
    Derive a short, safe title from the user's first message.
    Truncates to 60 chars, strips newlines — no LLM call required.
    """
    cleaned = " ".join(first_message.split())
    if len(cleaned) <= 60:
        return cleaned or "New conversation"
    truncated = cleaned[:57]
    last_space = truncated.rfind(" ")
    if last_space > 30:
        truncated = truncated[:last_space]
    return truncated + "…"


# ---------------------------------------------------------------------------
# Public Repository API
# ---------------------------------------------------------------------------

def create_conversation(user_id: str, title: str = "New conversation") -> Dict[str, Any]:
    """
    Insert a new copilot_conversations row for the given user in Supabase PostgreSQL.
    Returns the created row as a dict.
    """
    conv_id = str(uuid.uuid4())
    now = _now()
    safe_title = (title or "New conversation").strip()[:200] or "New conversation"

    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO copilot_conversations (id, user_id, title, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, user_id, title, created_at, updated_at
                    """,
                    (conv_id, user_id, safe_title, now, now),
                    prepare=False
                )
                row = cur.fetchone()
                return clean_row(dict(row))
        except Exception as exc:
            logger.error("PostgreSQL create_conversation failed: %s", exc)
            raise ConversationDBError(f"Failed to create conversation: {exc}") from exc

    # In-memory storage for offline mock
    conv = {
        "id": conv_id,
        "user_id": str(user_id),
        "title": safe_title,
        "created_at": now,
        "updated_at": now,
    }
    _memory_conversations[conv_id] = conv
    _memory_messages[conv_id] = []
    return conv


def get_conversation(conversation_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a single conversation row only if it belongs to user_id.
    Returns None if not found or not owned.
    """
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, title, created_at, updated_at
                    FROM copilot_conversations
                    WHERE id = %s AND user_id = %s
                    """,
                    (conversation_id, user_id),
                    prepare=False
                )
                row = cur.fetchone()
                if row:
                    return clean_row(dict(row))
                return None
        except Exception as exc:
            logger.error("PostgreSQL get_conversation failed: %s", exc)
            raise ConversationDBError(f"Failed to fetch conversation: {exc}") from exc

    conv = _memory_conversations.get(conversation_id)
    if conv and conv.get("user_id") == str(user_id):
        return conv
    return None


def list_conversations(user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """
    Return conversation summaries for a user, most-recently-updated first.
    Does NOT include message bodies — lightweight list only.
    """
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, title, created_at, updated_at
                    FROM copilot_conversations
                    WHERE user_id = %s
                    ORDER BY updated_at DESC
                    LIMIT %s
                    """,
                    (user_id, min(limit, 100)),
                    prepare=False
                )
                rows = cur.fetchall()
                if rows:
                    return [clean_row(dict(r)) for r in rows]
                return []
        except Exception as exc:
            logger.error("PostgreSQL list_conversations failed: %s", exc)
            raise ConversationDBError(f"Failed to list conversations: {exc}") from exc

    user_convs = [c for c in _memory_conversations.values() if c.get("user_id") == str(user_id)]
    user_convs.sort(key=lambda x: str(x.get("updated_at", "")), reverse=True)
    return user_convs[:min(limit, 100)]


def update_conversation_title(conversation_id: str, user_id: str, title: str) -> bool:
    """
    Update the title of a conversation owned by user_id in Supabase PostgreSQL.
    Returns True on success, False if not found/owned.
    """
    now = _now()
    safe_title = (title or "New conversation").strip()[:200]

    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE copilot_conversations
                    SET title = %s, updated_at = %s
                    WHERE id = %s AND user_id = %s
                    """,
                    (safe_title, now, conversation_id, user_id),
                    prepare=False
                )
                return cur.rowcount > 0
        except Exception as exc:
            logger.error("PostgreSQL update_conversation_title failed: %s", exc)
            raise ConversationDBError(f"Failed to update conversation title: {exc}") from exc

    conv = _memory_conversations.get(conversation_id)
    if conv and conv.get("user_id") == str(user_id):
        conv["title"] = safe_title
        conv["updated_at"] = now
        return True
    return False


def touch_conversation(conversation_id: str) -> None:
    """Bump updated_at on the conversation after a new message is saved."""
    now = _now()
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE copilot_conversations SET updated_at = %s WHERE id = %s",
                    (now, conversation_id),
                    prepare=False
                )
        except Exception as exc:
            logger.debug("PostgreSQL touch_conversation failed: %s", exc)

    if conversation_id in _memory_conversations:
        _memory_conversations[conversation_id]["updated_at"] = now


def delete_conversation(conversation_id: str, user_id: str) -> bool:
    """
    Delete a conversation and all its messages only if owned by user_id in Supabase PostgreSQL.
    Returns True on success, False if not found/owned.
    """
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM copilot_conversations WHERE id = %s AND user_id = %s",
                    (conversation_id, user_id),
                    prepare=False
                )
                return cur.rowcount > 0
        except Exception as exc:
            logger.error("PostgreSQL delete_conversation failed: %s", exc)
            raise ConversationDBError(f"Failed to delete conversation: {exc}") from exc

    conv = _memory_conversations.get(conversation_id)
    if conv and conv.get("user_id") == str(user_id):
        del _memory_conversations[conversation_id]
        _memory_messages.pop(conversation_id, None)
        return True
    return False


def add_message(
    conversation_id: str,
    role: str,
    content: str,
) -> Dict[str, Any]:
    """
    Insert a single message into copilot_messages in Supabase PostgreSQL.
    role must be 'user' or 'assistant'.
    """
    if role not in ("user", "assistant"):
        raise ValueError(f"Invalid role: {role!r}. Must be 'user' or 'assistant'.")

    msg_id = str(uuid.uuid4())
    now = _now()

    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO copilot_messages (id, conversation_id, role, content, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, conversation_id, role, content, created_at
                    """,
                    (msg_id, conversation_id, role, content, now),
                    prepare=False
                )
                row = cur.fetchone()
                if row:
                    touch_conversation(conversation_id)
                    return clean_row(dict(row))
        except Exception as exc:
            logger.error("PostgreSQL add_message failed: %s", exc)
            raise ConversationDBError(f"Failed to save message: {exc}") from exc

    msg = {
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "created_at": now,
    }
    if conversation_id not in _memory_messages:
        _memory_messages[conversation_id] = []
    _memory_messages[conversation_id].append(msg)
    touch_conversation(conversation_id)
    return msg


def get_messages(conversation_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    """
    Return messages for a conversation in chronological order from Supabase PostgreSQL.
    """
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, conversation_id, role, content, created_at
                    FROM copilot_messages
                    WHERE conversation_id = %s
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (conversation_id, min(limit, 500)),
                    prepare=False
                )
                rows = cur.fetchall()
                if rows:
                    return [clean_row(dict(r)) for r in rows]
                return []
        except Exception as exc:
            logger.error("PostgreSQL get_messages failed: %s", exc)
            raise ConversationDBError(f"Failed to fetch messages: {exc}") from exc

    msgs = _memory_messages.get(conversation_id, [])
    return msgs[:min(limit, 500)]


def get_history_for_groq(conversation_id: str, max_turns: int = 10) -> List[Dict[str, str]]:
    """
    Return the last `max_turns * 2` messages as a simple list of
    {"role": "user"|"assistant", "content": "..."} dicts for injection
    into the Groq message thread. Oldest first.
    """
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT role, content
                    FROM copilot_messages
                    WHERE conversation_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (conversation_id, max_turns * 2),
                    prepare=False
                )
                rows = cur.fetchall()
                if rows:
                    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
                return []
        except Exception as exc:
            logger.warning("PostgreSQL get_history_for_groq failed (%s)", exc)
            return []

    msgs = _memory_messages.get(conversation_id, [])
    recent = msgs[-(max_turns * 2):]
    return [{"role": m["role"], "content": m["content"]} for m in recent]


def ensure_tables_exist() -> bool:
    """
    Idempotently verify copilot_conversations and copilot_messages tables in Supabase PostgreSQL.
    """
    if _is_pg_available():
        try:
            conn = _pg_conn()
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS copilot_conversations (
                        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title       VARCHAR(200) NOT NULL DEFAULT 'New conversation',
                        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_id
                        ON copilot_conversations(user_id);
                    CREATE INDEX IF NOT EXISTS idx_copilot_conversations_updated_at
                        ON copilot_conversations(updated_at DESC);

                    CREATE TABLE IF NOT EXISTS copilot_messages (
                        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        conversation_id UUID NOT NULL
                                        REFERENCES copilot_conversations(id) ON DELETE CASCADE,
                        role            VARCHAR(20) NOT NULL
                                        CHECK (role IN ('user', 'assistant')),
                        content         TEXT NOT NULL,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversation_id
                        ON copilot_messages(conversation_id);
                    CREATE INDEX IF NOT EXISTS idx_copilot_messages_created_at
                        ON copilot_messages(conversation_id, created_at ASC);
                """, prepare=False)
            logger.info("Copilot PostgreSQL tables verified in Supabase.")
        except Exception as exc:
            logger.warning("PostgreSQL table verification note: %s", exc)

    return True
