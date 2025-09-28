"""Service layer that orchestrates AI inference requests."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional, TypeVar

import httpx
from fastapi import Depends

from ..config import Settings, get_settings
from ..domain.ai import (
    AIHealthResponse,
    AISearchRequest,
    AISearchResponse,
    AISearchResult,
    AISuggestRequest,
    AISuggestResponse,
    AISuggestion,
    AISuggestionType,
    AISummaryRequest,
    AISummaryResponse,
)

T = TypeVar("T")


class ModelUnavailableError(RuntimeError):
    """Raised when the underlying model endpoint cannot service a request."""


@dataclass(slots=True)
class AIService:
    settings: Settings
    client_factory: Callable[[], httpx.AsyncClient] | None = None

    async def suggest(self, payload: AISuggestRequest) -> AISuggestResponse:
        if not self.settings.ai_enabled:
            return AISuggestResponse(suggestions=[], source="disabled")

        if self.settings.ai_mode == "stub":
            return self._stub_suggest(payload)

        return await self._post("/suggest", payload, AISuggestResponse)

    async def search(self, payload: AISearchRequest) -> AISearchResponse:
        if not self.settings.ai_enabled:
            return AISearchResponse(results=[], source="disabled")

        if self.settings.ai_mode == "stub":
            return AISearchResponse(results=self._stub_search(payload), source="stub")

        return await self._post("/search", payload, AISearchResponse)

    async def summarize(self, payload: AISummaryRequest) -> AISummaryResponse:
        if not self.settings.ai_enabled:
            return AISummaryResponse(summary="", source="disabled")

        if self.settings.ai_mode == "stub":
            return self._stub_summary(payload)

        return await self._post("/summary", payload, AISummaryResponse)

    async def health(self) -> AIHealthResponse:
        if not self.settings.ai_enabled:
            return AIHealthResponse(status="ok", detail="AI features disabled", mode=self.settings.ai_mode, enabled=False)

        if self.settings.ai_mode == "stub":
            return AIHealthResponse(status="ok", detail="Stub responses", mode="stub", enabled=True)

        try:
            await self._get("/health")
            return AIHealthResponse(status="ok", mode=self.settings.ai_mode, enabled=True)
        except ModelUnavailableError as error:
            return AIHealthResponse(status="unavailable", detail=str(error), mode=self.settings.ai_mode, enabled=True)

    async def _post(self, path: str, payload: object, model: type[T]) -> T:
        client, managed = self._build_client()
        try:
            response = await client.post(path, json=self._dump(payload))
            response.raise_for_status()
            return model.model_validate(response.json())  # type: ignore[attr-defined]
        except httpx.RequestError as exc:
            raise ModelUnavailableError(str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text or f"model responded with {exc.response.status_code}"
            raise ModelUnavailableError(detail) from exc
        finally:
            if managed:
                await client.aclose()

    async def _get(self, path: str) -> None:
        client, managed = self._build_client()
        try:
            response = await client.get(path)
            response.raise_for_status()
        except httpx.RequestError as exc:
            raise ModelUnavailableError(str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text or f"model responded with {exc.response.status_code}"
            raise ModelUnavailableError(detail) from exc
        finally:
            if managed:
                await client.aclose()

    def _build_client(self) -> tuple[httpx.AsyncClient, bool]:
        if self.client_factory:
            return self.client_factory(), False
        if not self.settings.ai_model_url:
            raise ModelUnavailableError("AI_MODEL_URL is not configured")
        base_url = self.settings.ai_model_url.rstrip("/")
        return httpx.AsyncClient(base_url=base_url, timeout=self.settings.ai_timeout_seconds), True

    @staticmethod
    def _dump(payload: object) -> dict[str, object]:
        if hasattr(payload, "model_dump"):
            return payload.model_dump()  # type: ignore[no-any-return]
        if isinstance(payload, dict):
            return payload
        raise TypeError(f"Unsupported payload type: {type(payload)!r}")

    @staticmethod
    def _stub_suggest(payload: AISuggestRequest) -> AISuggestResponse:
        text = payload.content.lower()
        suggestions: list[AISuggestion] = []
        if 'focus' in text and '#focus' not in text:
            suggestions.append(
                AISuggestion(
                    type=AISuggestionType.FOCUS,
                    label="!focus",
                    value="!focus",
                    confidence=0.42,
                    metadata={"source": "stub"},
                )
            )
        for candidate in ('project', 'launch', 'roadmap'):
            if candidate in text:
                suggestions.append(
                    AISuggestion(
                        type=AISuggestionType.PROJECT,
                        label=f"@{candidate}",
                        value=f"@{candidate}",
                        confidence=0.38,
                        metadata={"source": "stub"},
                    )
                )
        return AISuggestResponse(suggestions=suggestions, source="stub")

    @staticmethod
    def _stub_search(payload: AISearchRequest) -> list[AISearchResult]:
        if not payload.query.strip():
            return []
        return [
            AISearchResult(
                id="stub",
                title="Search unavailable",
                snippet="AI search is running in stub mode.",
                score=None,
                metadata={"source": "stub"},
            )
        ]

    @staticmethod
    def _stub_summary(payload: AISummaryRequest) -> AISummaryResponse:
        text = payload.content.strip()
        if not text:
            return AISummaryResponse(summary="", highlights=None, source="stub")
        snippet = text.splitlines()[0:2]
        summary = " ".join(snippet)[:240]
        return AISummaryResponse(summary=summary, highlights=None, source="stub")


def get_ai_service(settings: Settings = Depends(get_settings)) -> AIService:
    return AIService(settings=settings)


__all__ = ["AIService", "ModelUnavailableError", "get_ai_service"]
