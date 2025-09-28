"""Repository implementation for thoughts."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..domain.thought import (
    ThoughtCreate,
    ThoughtPublic,
    ThoughtRead,
    ThoughtUpdate,
    SyncThoughtPayload,
    apply_update,
    generate_thought_id,
    reconcile_change,
    utcnow,
)
from ..models import Thought, ThoughtLink, ThoughtTag


class ThoughtRepository:
    """Persist and retrieve thought records."""

    def __init__(self, session: Session):
        self.session = session

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------
    def list(self, include_deleted: bool = False) -> list[ThoughtRead]:
        query = select(Thought).order_by(Thought.updated_at.desc())
        if not include_deleted:
            query = query.where(Thought.deleted_at.is_(None))
        results = self.session.scalars(query).all()
        return [self._to_domain(row) for row in results]

    def search(self, query_text: str) -> list[ThoughtRead]:
        normalized = query_text.strip().lower()
        if not normalized:
            return self.list()

        pattern = f"%{normalized}%"
        query = (
            select(Thought)
            .where(
                Thought.deleted_at.is_(None),
                or_(
                    func.lower(Thought.title).like(pattern),
                    func.lower(Thought.content).like(pattern),
                    Thought.tags.any(ThoughtTag.tag.like(pattern)),
                ),
            )
            .order_by(Thought.updated_at.desc())
        )
        results = self.session.scalars(query).all()
        return [self._to_domain(row) for row in results]

    def get(self, thought_id: str) -> Optional[ThoughtRead]:
        row = self.session.get(Thought, thought_id)
        if not row:
            return None
        return self._to_domain(row)

    def create(self, draft: ThoughtCreate) -> ThoughtRead:
        thought_id = draft.id or generate_thought_id()
        entity = Thought(
            id=thought_id,
            title=draft.title,
            content=draft.content,
            created_at=draft.created_at,
            updated_at=draft.updated_at,
            deleted_at=None,
        )
        self.session.add(entity)
        self.session.flush()
        self._replace_tags(entity, draft.tags)
        self._replace_links(entity, draft.links)
        self.session.flush()
        return self._to_domain(entity)

    def update(self, thought_id: str, patch: ThoughtUpdate) -> ThoughtRead:
        existing = self.session.get(Thought, thought_id)
        if not existing:
            raise ValueError(f"Thought {thought_id} not found")

        domain_existing = self._to_domain(existing)
        next_value = apply_update(domain_existing, patch)

        existing.title = next_value.title
        existing.content = next_value.content
        existing.updated_at = next_value.updated_at
        existing.deleted_at = next_value.deleted_at

        self._replace_tags(existing, next_value.tags)
        self._replace_links(existing, next_value.links)
        self.session.flush()
        return self._to_domain(existing)

    def delete(self, thought_id: str) -> None:
        existing = self.session.get(Thought, thought_id)
        if not existing:
            return

        stamp = utcnow()
        existing.deleted_at = stamp
        existing.updated_at = stamp
        # remove incoming links referencing this thought
        self.session.query(ThoughtLink).filter(ThoughtLink.target_id == thought_id).delete(synchronize_session=False)
        self.session.flush()

    def purge(self, thought_id: str) -> None:
        existing = self.session.get(Thought, thought_id)
        if not existing:
            return
        self.session.delete(existing)
        self.session.flush()

    # ------------------------------------------------------------------
    # Linking helpers
    # ------------------------------------------------------------------
    def link(self, source_id: str, target_id: str) -> ThoughtRead:
        if source_id == target_id:
            raise ValueError("cannot link a thought to itself")

        source = self.session.get(Thought, source_id)
        target = self.session.get(Thought, target_id)
        if not source or not target:
            raise ValueError("source or target thought not found")

        self._ensure_link(source, target_id)
        self.session.flush()
        return self._to_domain(source)

    def unlink(self, source_id: str, target_id: str) -> ThoughtRead:
        source = self.session.get(Thought, source_id)
        if not source:
            raise ValueError("source thought not found")

        self.session.query(ThoughtLink).filter(
            ThoughtLink.source_id == source_id,
            ThoughtLink.target_id == target_id,
        ).delete(synchronize_session=False)
        self.session.flush()
        return self._to_domain(source)

    # ------------------------------------------------------------------
    # Sync operations
    # ------------------------------------------------------------------
    def upsert_sync_payload(self, payload: SyncThoughtPayload) -> ThoughtRead:
        lookup_id = payload.id or generate_thought_id()
        existing = self.session.get(Thought, lookup_id)
        domain_existing = self._to_domain(existing) if existing else None
        merged = reconcile_change(domain_existing, payload)

        entity = existing or self.session.get(Thought, merged.id)

        if entity is None:
            entity = Thought(
                id=merged.id,
                title=merged.title,
                content=merged.content,
                created_at=merged.created_at,
                updated_at=merged.updated_at,
                deleted_at=merged.deleted_at,
            )
            self.session.add(entity)
            self.session.flush()
        else:
            entity.title = merged.title
            entity.content = merged.content
            entity.created_at = merged.created_at
            entity.updated_at = merged.updated_at
            entity.deleted_at = merged.deleted_at

        self._replace_tags(entity, merged.tags)
        self._replace_links(entity, merged.links)
        self.session.flush()
        return self._to_domain(entity)

    def fetch_changed_since(self, since: datetime, limit: int) -> list[ThoughtRead]:
        query = (
            select(Thought)
            .where(Thought.updated_at > since)
            .order_by(Thought.updated_at.asc())
            .limit(limit)
        )
        return [self._to_domain(row) for row in self.session.scalars(query).all()]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _replace_tags(self, entity: Thought, tags: Iterable[str]) -> None:
        existing = {tag.tag: tag for tag in entity.tags}
        next_values = {tag: None for tag in tags}

        # delete removed tags
        for tag_value, tag_obj in list(existing.items()):
            if tag_value not in next_values:
                self.session.delete(tag_obj)

        # add new tags
        for tag_value in tags:
            if tag_value not in existing:
                entity.tags.append(ThoughtTag(tag=tag_value))

    def _replace_links(self, entity: Thought, target_ids: Iterable[str]) -> None:
        normalized = {target_id for target_id in target_ids if target_id != entity.id}
        existing = {(link.target_id): link for link in entity.outgoing_links}

        # remove stale links
        for target_id, link in list(existing.items()):
            if target_id not in normalized:
                self.session.delete(link)

        # add new ones
        for target_id in normalized:
            self._ensure_link(entity, target_id)

    def _ensure_link(self, entity: Thought, target_id: str) -> None:
        if target_id == entity.id:
            return

        for link in entity.outgoing_links:
            if link.target_id == target_id:
                return

        # ensure the target exists before creating link
        target = self.session.get(Thought, target_id)
        if not target:
            raise ValueError(f"Target thought {target_id} not found")

        entity.outgoing_links.append(ThoughtLink(target_id=target_id))

    def _to_domain(self, entity: Thought | None) -> ThoughtRead | None:
        if entity is None:
            return None

        return ThoughtRead(
            id=entity.id,
            title=entity.title,
            content=entity.content,
            tags=sorted(tag.tag for tag in entity.tags),
            links=sorted(link.target_id for link in entity.outgoing_links),
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            deleted_at=entity.deleted_at,
        )


__all__ = ["ThoughtRepository"]
