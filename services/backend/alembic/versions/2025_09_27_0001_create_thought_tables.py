"""create thought tables"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "2025_09_27_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "thoughts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_thoughts_created_at", "thoughts", ["created_at"])
    op.create_index("ix_thoughts_updated_at", "thoughts", ["updated_at"])
    op.create_index("ix_thoughts_deleted_at", "thoughts", ["deleted_at"])

    op.create_table(
        "thought_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("thought_id", sa.String(length=64), nullable=False),
        sa.Column("tag", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["thought_id"], ["thoughts.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("thought_id", "tag", name="uq_thought_tags"),
    )
    op.create_index("ix_thought_tags_thought_id", "thought_tags", ["thought_id"])

    op.create_table(
        "thought_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["thoughts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["thoughts.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("source_id", "target_id", name="uq_thought_links"),
    )
    op.create_index("ix_thought_links_source_id", "thought_links", ["source_id"])
    op.create_index("ix_thought_links_target_id", "thought_links", ["target_id"])


def downgrade() -> None:
    op.drop_index("ix_thought_links_target_id", table_name="thought_links")
    op.drop_index("ix_thought_links_source_id", table_name="thought_links")
    op.drop_table("thought_links")

    op.drop_index("ix_thought_tags_thought_id", table_name="thought_tags")
    op.drop_table("thought_tags")

    op.drop_index("ix_thoughts_deleted_at", table_name="thoughts")
    op.drop_index("ix_thoughts_updated_at", table_name="thoughts")
    op.drop_index("ix_thoughts_created_at", table_name="thoughts")
    op.drop_table("thoughts")
