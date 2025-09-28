"""Thought API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..database import get_session
from ..domain.thought import ThoughtCreate, ThoughtPublic, ThoughtUpdate
from ..repositories.thoughts import ThoughtRepository

router = APIRouter(prefix="/thoughts", tags=["thoughts"])


def _repository(session: Session = Depends(get_session)) -> ThoughtRepository:
    return ThoughtRepository(session)


@router.get("/", response_model=list[ThoughtPublic])
def list_thoughts(search: str | None = None, repo: ThoughtRepository = Depends(_repository)) -> list[ThoughtPublic]:
    if search:
        return repo.search(search)
    return repo.list()


@router.post("/", response_model=ThoughtPublic, status_code=status.HTTP_201_CREATED)
def create_thought(payload: ThoughtCreate, repo: ThoughtRepository = Depends(_repository)) -> ThoughtPublic:
    record = repo.create(payload)
    return record


@router.get("/{thought_id}", response_model=ThoughtPublic)
def get_thought(thought_id: str, repo: ThoughtRepository = Depends(_repository)) -> ThoughtPublic:
    record = repo.get(thought_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thought not found")
    return record


@router.patch("/{thought_id}", response_model=ThoughtPublic)
def update_thought(
    thought_id: str,
    payload: ThoughtUpdate,
    repo: ThoughtRepository = Depends(_repository),
) -> ThoughtPublic:
    try:
        record = repo.update(thought_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return record


@router.delete(
    "/{thought_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_thought(thought_id: str, repo: ThoughtRepository = Depends(_repository)) -> Response:
    repo.delete(thought_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{thought_id}/links/{target_id}", response_model=ThoughtPublic)
def link_thought(
    thought_id: str,
    target_id: str,
    repo: ThoughtRepository = Depends(_repository),
) -> ThoughtPublic:
    try:
        record = repo.link(thought_id, target_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return record


@router.delete("/{thought_id}/links/{target_id}", response_model=ThoughtPublic)
def unlink_thought(
    thought_id: str,
    target_id: str,
    repo: ThoughtRepository = Depends(_repository),
) -> ThoughtPublic:
    try:
        record = repo.unlink(thought_id, target_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return record
