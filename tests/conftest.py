from pathlib import Path

import pytest

from alembic import command
from alembic.config import Config
from app import create_app


def run_migrations(db_path: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    alembic_ini = root / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(root / "alembic"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    command.upgrade(cfg, "head")


@pytest.fixture()
def app(tmp_path: Path):
    db_path = tmp_path / "test.db"
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    run_migrations(db_path)

    test_app = create_app(
        "testing",
        test_config={
            "DB_PATH": db_path,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            "UPLOAD_DIR": upload_dir,
            "TESTING": True,
            "SECRET_KEY": "test-secret-key",
        },
    )
    return test_app


@pytest.fixture()
def client(app):
    return app.test_client()
