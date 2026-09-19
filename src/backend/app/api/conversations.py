"""
NaviOps Copilot — Conversation persistence router.

Endpoints:
  GET    /api/copilot/conversations            — list user's conversations
  POST   /api/copilot/conversations            — create new conversation
  GET    /api/copilot/conversations/{id}       — get conversation + messages
  PATCH  /api/copilot/conversations/{id}/title — rename conversation
  DELETE /api/copilot/conversations/{id}       — delete conversation

All endpoints enforce authentication.  Ownership is always checked server-side
using the authenticated user's ID — never the frontend-supplied value.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.models.schemas import (
    UserResponse,
    ConversationSummary,
    ConversationDetail,
    ConversationCreateRequest,
    ConversationTitleUpdate,
    MessageResponse,
)
from app.services.conversation_repo import (
    ConversationDBError,
    create_conversation,
    get_conversation,
    list_conversations,
    update_conversation_title,
    delete_conversation,
    get_messages,
)

logger = logging.getLogger("naviops.copilot.conversations.api")

router = APIRouter(prefix="/api/copilot/conversations", tags=["Bob AI – Conversations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _not_found() -> HTTPException:
    """Return a safe 404 that does not reveal whether the resource exists for another user."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Conversation not found.",
    )


def _db_error(exc: ConversationDBError) -> HTTPException:
    logger.error("Conversation DB error: %s", exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Conversation history is temporarily unavailable. Your chat still works.",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ConversationSummary])
def list_user_conversations(
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Return lightweight conversation summaries for the authenticated user,
    most-recently-updated first.  Messages are NOT included in this response.
    """
    try:
        rows = list_conversations(user_id=current_user.id, limit=30)
    except ConversationDBError as exc:
        raise _db_error(exc)
    return [
        ConversationSummary(
            id=r["id"],
            title=r["title"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


@router.post("", response_model=ConversationSummary, status_code=status.HTTP_201_CREATED)
def create_user_conversation(
    payload: ConversationCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Create a new conversation for the authenticated user.
    Returns the conversation summary (without messages).
    """
    title = (payload.title or "New conversation").strip() or "New conversation"
    try:
        row = create_conversation(user_id=current_user.id, title=title)
    except ConversationDBError as exc:
        raise _db_error(exc)
    return ConversationSummary(
        id=row["id"],
        title=row["title"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_user_conversation(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Return a single conversation with its messages, only if owned by the
    authenticated user.  Returns 404 for missing or unauthorised conversations.
    """
    try:
        conv = get_conversation(conversation_id=conversation_id, user_id=current_user.id)
        if conv is None:
            raise _not_found()
        msgs = get_messages(conversation_id=conversation_id)
    except ConversationDBError as exc:
        raise _db_error(exc)

    return ConversationDetail(
        id=conv["id"],
        title=conv["title"],
        created_at=conv["created_at"],
        updated_at=conv["updated_at"],
        messages=[
            MessageResponse(
                id=m["id"],
                conversation_id=m["conversation_id"],
                role=m["role"],
                content=m["content"],
                created_at=m["created_at"],
            )
            for m in msgs
        ],
    )


@router.patch("/{conversation_id}/title", response_model=ConversationSummary)
def rename_conversation(
    conversation_id: str,
    payload: ConversationTitleUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Rename a conversation owned by the authenticated user."""
    try:
        updated = update_conversation_title(
            conversation_id=conversation_id,
            user_id=current_user.id,
            title=payload.title.strip(),
        )
        if not updated:
            raise _not_found()
        conv = get_conversation(conversation_id=conversation_id, user_id=current_user.id)
        if conv is None:
            raise _not_found()
    except ConversationDBError as exc:
        raise _db_error(exc)

    return ConversationSummary(
        id=conv["id"],
        title=conv["title"],
        created_at=conv["created_at"],
        updated_at=conv["updated_at"],
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_conversation(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Delete a conversation (and all its messages via CASCADE) only if owned
    by the authenticated user.  Returns 404 for missing or unauthorised.
    """
    try:
        deleted = delete_conversation(
            conversation_id=conversation_id,
            user_id=current_user.id,
        )
        if not deleted:
            raise _not_found()
    except ConversationDBError as exc:
        raise _db_error(exc)
