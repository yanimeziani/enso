"""Synchronization endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_session
from ..domain.thought import SyncRequest, SyncResponse, utcnow
from ..repositories.thoughts import ThoughtRepository

router = APIRouter(prefix="/sync", tags=["sync"])


def _repository(session: Session = Depends(get_session)) -> ThoughtRepository:
    return ThoughtRepository(session)


@router.post("/thoughts", response_model=SyncResponse)
def sync_thoughts(payload: SyncRequest, repo: ThoughtRepository = Depends(_repository)) -> SyncResponse:
    settings = get_settings()

    for change in payload.changes:
        repo.upsert_sync_payload(change)

    cursor = utcnow()
    since = payload.since or datetime.fromtimestamp(0, tz=timezone.utc)
    limit = settings.sync_page_size
    changes = repo.fetch_changed_since(since, limit + 1)
    has_more = len(changes) > limit
    if has_more:
        changes = changes[:limit]

    return SyncResponse(cursor=cursor, changes=changes, has_more=has_more)

