"""add review fields: images.source_folder, annotations.confidence

Revision ID: 0002_review_fields
Revises: 0001_v1_core
Create Date: 2026-08-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_review_fields"
down_revision: str | None = "0001_v1_core"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("images", sa.Column("source_folder", sa.String(length=500), nullable=True))
    op.create_index(op.f("ix_images_source_folder"), "images", ["source_folder"], unique=False)
    op.add_column("annotations", sa.Column("confidence", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("annotations", "confidence")
    op.drop_index(op.f("ix_images_source_folder"), table_name="images")
    op.drop_column("images", "source_folder")
