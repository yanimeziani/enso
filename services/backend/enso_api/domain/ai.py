"""Pydantic models describing AI interactions."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AISuggestionType(str, Enum):
    TAG = "tag"
    PROJECT = "project"
    FOCUS = "focus"
    SUMMARY = "summary"
    LINK = "link"
    NOTE = "note"


class AISuggestion(BaseModel):
    type: AISuggestionType = Field(default=AISuggestionType.TAG)
    label: str
    value: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    metadata: dict[str, str] | None = None


class AISuggestRequest(BaseModel):
    content: str
    cursor: int | None = None
    tags: list[str] = Field(default_factory=list)
    mode: str = Field(default="auto")
    context: dict[str, object] | None = None


class AISuggestResponse(BaseModel):
    suggestions: list[AISuggestion] = Field(default_factory=list)
    latency_ms: float | None = Field(default=None, ge=0.0)
    source: Optional[str] = None


class AISearchRequest(BaseModel):
    query: str
    limit: int | None = Field(default=5, ge=1, le=50)
    mode: str = Field(default="auto")
    filters: dict[str, str | None] | None = None


class AISearchResult(BaseModel):
    id: Optional[str] = None
    title: str
    snippet: str
    score: float | None = None
    metadata: dict[str, str] | None = None


class AISearchResponse(BaseModel):
    results: list[AISearchResult] = Field(default_factory=list)
    latency_ms: float | None = Field(default=None, ge=0.0)
    source: Optional[str] = None


class AISummaryRequest(BaseModel):
    content: str
    focus: str | None = None
    mode: str = Field(default="auto")
    length: str | None = Field(default=None)


class AISummaryResponse(BaseModel):
    summary: str
    highlights: list[str] | None = None
    latency_ms: float | None = Field(default=None, ge=0.0)
    source: Optional[str] = None


class AIHealthResponse(BaseModel):
    status: str
    detail: str | None = None
    mode: str
    enabled: bool


__all__ = [
    "AISuggestionType",
    "AISuggestion",
    "AISuggestRequest",
    "AISuggestResponse",
    "AISearchRequest",
    "AISearchResponse",
    "AISearchResult",
    "AISummaryRequest",
    "AISummaryResponse",
    "AIHealthResponse",
]
