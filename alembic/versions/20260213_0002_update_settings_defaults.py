"""update settings defaults

Revision ID: 20260213_0002
Revises: 20260212_0001
Create Date: 2026-02-13 12:05:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260213_0002"
down_revision = "20260212_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("settings"):
        return

    # Preserve user customizations: update only legacy defaults.
    bind.execute(sa.text("UPDATE settings SET card_height = 100 WHERE id = 1 AND card_height = 0"))
    bind.execute(
        sa.text(
            "UPDATE settings SET column_bg_opacity = 0.5 WHERE id = 1 AND column_bg_opacity = 1.0"
        )
    )
    bind.execute(
        sa.text("UPDATE settings SET card_bg_opacity = 0.5 WHERE id = 1 AND card_bg_opacity = 1.0")
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("settings"):
        return

    bind.execute(sa.text("UPDATE settings SET card_height = 0 WHERE id = 1 AND card_height = 100"))
    bind.execute(
        sa.text(
            "UPDATE settings SET column_bg_opacity = 1.0 WHERE id = 1 AND column_bg_opacity = 0.5"
        )
    )
    bind.execute(
        sa.text("UPDATE settings SET card_bg_opacity = 1.0 WHERE id = 1 AND card_bg_opacity = 0.5")
    )
