from __future__ import annotations

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app import create_app
from app.extensions import db
from app.models import Card, Column, Settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Keep Alembic and application pointed to the same DB.
# Priority: environment URL (docker/runtime) -> alembic config URL (tests/cli).
effective_db_url = os.getenv("SQLALCHEMY_DATABASE_URI") or config.get_main_option("sqlalchemy.url")
app = create_app(
    test_config={"SQLALCHEMY_DATABASE_URI": effective_db_url} if effective_db_url else None,
)
_ = (Column, Card, Settings)
target_metadata = db.metadata


def get_url() -> str:
    if effective_db_url:
        return effective_db_url
    with app.app_context():
        return app.config["SQLALCHEMY_DATABASE_URI"]


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
