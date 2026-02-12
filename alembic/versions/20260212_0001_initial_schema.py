"""initial schema

Revision ID: 20260212_0001
Revises:
Create Date: 2026-02-12 16:30:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260212_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("columns"):
        op.create_table(
            "columns",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.PrimaryKeyConstraint("id"),
        )
    inspector = sa.inspect(bind)
    column_indexes = {idx["name"] for idx in inspector.get_indexes("columns")}
    if "idx_columns_position" not in column_indexes:
        op.create_index("idx_columns_position", "columns", ["position"], unique=False)

    if not inspector.has_table("settings"):
        op.create_table(
            "settings",
            sa.Column("id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "dashboard_title",
                sa.String(length=120),
                nullable=False,
                server_default="Start Dashboard",
            ),
            sa.Column("dashboard_bg_image", sa.String(length=2048), nullable=True),
            sa.Column("cols_per_row", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("column_width", sa.Integer(), nullable=False, server_default="320"),
            sa.Column("card_height", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "column_bg_color",
                sa.String(length=7),
                nullable=False,
                server_default="#ffffff",
            ),
            sa.Column("column_bg_opacity", sa.Float(), nullable=False, server_default="1.0"),
            sa.Column(
                "card_bg_color",
                sa.String(length=7),
                nullable=False,
                server_default="#ffffff",
            ),
            sa.Column("card_bg_opacity", sa.Float(), nullable=False, server_default="1.0"),
            sa.CheckConstraint("id = 1", name="ck_settings_singleton"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not inspector.has_table("cards"):
        op.create_table(
            "cards",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("column_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("link", sa.String(length=2048), nullable=False, server_default=""),
            sa.Column("description", sa.String(length=2000), nullable=False, server_default=""),
            sa.Column("icon", sa.String(length=2048), nullable=False, server_default=""),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.ForeignKeyConstraint(["column_id"], ["columns.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    inspector = sa.inspect(bind)
    card_indexes = {idx["name"] for idx in inspector.get_indexes("cards")}
    if "ix_cards_column_id" not in card_indexes:
        op.create_index("ix_cards_column_id", "cards", ["column_id"], unique=False)
    if "ix_cards_position" not in card_indexes:
        op.create_index("ix_cards_position", "cards", ["position"], unique=False)
    if "idx_cards_column_position" not in card_indexes:
        op.create_index(
            "idx_cards_column_position",
            "cards",
            ["column_id", "position"],
            unique=False,
        )

    columns_count = bind.execute(sa.text("SELECT COUNT(1) FROM columns")).scalar_one()
    if columns_count == 0:
        op.bulk_insert(
            sa.table(
                "columns",
                sa.column("name", sa.String(length=120)),
                sa.column("position", sa.Integer()),
            ),
            [
                {"name": "Work", "position": 0},
                {"name": "Personal", "position": 1},
                {"name": "Tools", "position": 2},
            ],
        )
    settings_count = bind.execute(
        sa.text("SELECT COUNT(1) FROM settings WHERE id = 1")
    ).scalar_one()
    if settings_count == 0:
        op.bulk_insert(
            sa.table("settings", sa.column("id", sa.Integer())),
            [{"id": 1}],
        )


def downgrade() -> None:
    op.drop_index("idx_cards_column_position", table_name="cards")
    op.drop_index("ix_cards_position", table_name="cards")
    op.drop_index("ix_cards_column_id", table_name="cards")
    op.drop_table("cards")
    op.drop_table("settings")
    op.drop_index("idx_columns_position", table_name="columns")
    op.drop_table("columns")
