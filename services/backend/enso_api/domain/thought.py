from __future__ import annotations

from datetime import datetime, timezone
from secrets import token_urlsafe
from typing import Iterable, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


def utcnow() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def isoformat(value: datetime) -> str:
    """Format a datetime as an ISO-8601 string with UTC designator."""
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def generate_thought_id() -> str:
    token = token_urlsafe(6).replace("-", "a").replace("_", "b")
    stamp = format(int(utcnow().timestamp() * 1000), "x")
    return f"th_{token}{stamp}"


def _normalize_tag(tag: str) -> str:
    return tag.strip().lower()


def _dedupe(items: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _sanitize_links(values: Iterable[str], self_id: Optional[str] = None) -> List[str]:
    sanitized: List[str] = []
    seen: set[str] = set()
    for value in values:
        candidate = value.strip()
        if not candidate:
            continue
        if self_id and candidate == self_id:
            continue
        if candidate in seen:
            continue
        seen.add(candidate)
        sanitized.append(candidate)
    return sanitized


class ThoughtBase(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    tags: List[str] = Field(default_factory=list)
    links: List[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _trim_title(cls, value: str) -> str:
        trimmed = value.strip()
        return trimmed or "Untitled Thought"

    @field_validator("content")
    @classmethod
    def _validate_content(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("content must not be empty")
        return value

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, values: List[str]) -> List[str]:
        normalized = [_normalize_tag(tag) for tag in values if _normalize_tag(tag)]
        return _dedupe(normalized)

    @field_validator("links")
    @classmethod
    def _sanitize_links(cls, values: List[str]) -> List[str]:
        return _sanitize_links(values)


class ThoughtCreate(ThoughtBase):
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def _default_timestamps(cls, data: dict) -> dict:
        created = data.get("created_at")
        updated = data.get("updated_at")
        if not created:
            data["created_at"] = utcnow()
        if not updated:
            data["updated_at"] = data["created_at"]
        return data

    @model_validator(mode="after")
    def _ensure_links(self) -> "ThoughtCreate":
        self.links = _sanitize_links(self.links)
        return self


class ThoughtPublic(ThoughtBase):
    id: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    @model_validator(mode="after")
    def _validate_links(self) -> "ThoughtPublic":
        self.links = _sanitize_links(self.links, self.id)
        return self


class ThoughtRead(ThoughtPublic):
    pass


class ThoughtUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    links: Optional[List[str]] = None
    updated_at: Optional[datetime] = None

    @model_validator(mode="after")
    def _ensure_payload(self) -> "ThoughtUpdate":
        if not any(
            value is not None
            for value in (self.title, self.content, self.tags, self.links)
        ):
            raise ValueError("update requires at least one field")
        return self

    @field_validator("title")
    @classmethod
    def _trim_title(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed

    @field_validator("content")
    @classmethod
    def _trim_content(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("content must not be empty")
        return value

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, values: List[str]) -> List[str]:
        return _dedupe([_normalize_tag(tag) for tag in values if _normalize_tag(tag)])

    @field_validator("links")
    @classmethod
    def _sanitize_links(cls, values: List[str]) -> List[str]:
        return _sanitize_links(values)


class SyncThoughtPayload(ThoughtPublic):
    pass


class SyncRequest(BaseModel):
    client_id: str
    since: Optional[datetime] = None
    changes: List[SyncThoughtPayload] = Field(default_factory=list)


class SyncResponse(BaseModel):
    cursor: datetime
    changes: List[ThoughtPublic]
    has_more: bool = False


def apply_update(thought: ThoughtRead, patch: ThoughtUpdate) -> ThoughtRead:
    updated = ThoughtRead(
        id=thought.id,
        title=patch.title or thought.title,
        content=patch.content or thought.content,
        tags=patch.tags if patch.tags is not None else thought.tags,
        links=_sanitize_links(patch.links if patch.links is not None else thought.links, thought.id),
        created_at=thought.created_at,
        updated_at=patch.updated_at or utcnow(),
        deleted_at=thought.deleted_at,
    )
    return updated


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def reconcile_change(existing: Optional[ThoughtRead], incoming: SyncThoughtPayload) -> ThoughtRead:
    incoming_updated = _to_utc(incoming.updated_at) or utcnow()
    incoming_created = _to_utc(incoming.created_at) or incoming_updated

    if existing is None:
        return ThoughtRead(
            id=incoming.id or generate_thought_id(),
            title=incoming.title,
            content=incoming.content,
            tags=incoming.tags,
            links=_sanitize_links(incoming.links, incoming.id),
            created_at=incoming_created,
            updated_at=incoming_updated,
            deleted_at=_to_utc(incoming.deleted_at),
        )

    existing_updated = _to_utc(existing.updated_at) or incoming_updated

    if incoming_updated <= existing_updated:
        return existing

    return ThoughtRead(
        id=existing.id,
        title=incoming.title,
        content=incoming.content,
        tags=incoming.tags,
        links=_sanitize_links(incoming.links, existing.id),
        created_at=existing.created_at,
        updated_at=incoming_updated,
        deleted_at=_to_utc(incoming.deleted_at),
    )


__all__ = [
    "ThoughtCreate",
    "ThoughtPublic",
    "ThoughtRead",
    "ThoughtUpdate",
    "SyncRequest",
    "SyncResponse",
    "SyncThoughtPayload",
    "apply_update",
    "reconcile_change",
    "generate_thought_id",
    "utcnow",
]
