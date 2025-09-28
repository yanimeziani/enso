"""SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Thought(Base):
    __tablename__ = "thoughts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    tags: Mapped[list[ThoughtTag]] = relationship("ThoughtTag", back_populates="thought", cascade="all, delete-orphan")
    outgoing_links: Mapped[list[ThoughtLink]] = relationship(
        "ThoughtLink",
        primaryjoin="Thought.id==ThoughtLink.source_id",
        cascade="all, delete-orphan",
        back_populates="source",
    )
    incoming_links: Mapped[list[ThoughtLink]] = relationship(
        "ThoughtLink",
        primaryjoin="Thought.id==ThoughtLink.target_id",
        cascade="all, delete-orphan",
        back_populates="target",
    )


class ThoughtTag(Base):
    __tablename__ = "thought_tags"
    __table_args__ = (UniqueConstraint("thought_id", "tag", name="uq_thought_tags"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    thought_id: Mapped[str] = mapped_column(ForeignKey("thoughts.id", ondelete="CASCADE"), nullable=False, index=True)
    tag: Mapped[str] = mapped_column(String(64), nullable=False)

    thought: Mapped[Thought] = relationship("Thought", back_populates="tags")


class ThoughtLink(Base):
    __tablename__ = "thought_links"
    __table_args__ = (UniqueConstraint("source_id", "target_id", name="uq_thought_links"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("thoughts.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(ForeignKey("thoughts.id", ondelete="CASCADE"), nullable=False, index=True)

    source: Mapped[Thought] = relationship(
        "Thought",
        primaryjoin="Thought.id==ThoughtLink.source_id",
        back_populates="outgoing_links",
    )
    target: Mapped[Thought] = relationship(
        "Thought",
        primaryjoin="Thought.id==ThoughtLink.target_id",
        back_populates="incoming_links",
    )

