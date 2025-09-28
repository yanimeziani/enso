"""REST endpoints for AI-assisted features."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..domain.ai import (
    AIHealthResponse,
    AISearchRequest,
    AISearchResponse,
    AISuggestRequest,
    AISuggestResponse,
    AISummaryRequest,
    AISummaryResponse,
)
from ..services.ai import AIService, ModelUnavailableError, get_ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/health", response_model=AIHealthResponse)
async def health(service: AIService = Depends(get_ai_service)) -> AIHealthResponse:
    return await service.health()


@router.post("/suggest", response_model=AISuggestResponse)
async def suggest(
    payload: AISuggestRequest,
    service: AIService = Depends(get_ai_service)
) -> AISuggestResponse:
    try:
        return await service.suggest(payload)
    except ModelUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.post("/search", response_model=AISearchResponse)
async def search(
    payload: AISearchRequest,
    service: AIService = Depends(get_ai_service)
) -> AISearchResponse:
    try:
        return await service.search(payload)
    except ModelUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.post("/summary", response_model=AISummaryResponse)
async def summary(
    payload: AISummaryRequest,
    service: AIService = Depends(get_ai_service)
) -> AISummaryResponse:
    try:
        return await service.summarize(payload)
    except ModelUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


__all__ = ["router"]
