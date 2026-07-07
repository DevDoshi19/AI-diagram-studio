"""add composite index on user_id and created_at

Revision ID: b9186e194887
Revises: 
Create Date: 2026-07-01 23:50:56.211584
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b9186e194887'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite index for the most common query:
    # WHERE user_id = ? ORDER BY created_at DESC
    op.create_index(
        'ix_diagrams_user_id_created_at',
        'diagrams',
        ['user_id', sa.text('created_at DESC')],
    )


def downgrade() -> None:
    op.drop_index('ix_diagrams_user_id_created_at', table_name='diagrams')