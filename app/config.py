import os
from pathlib import Path


class BaseConfig:
    BASE_DIR = Path(__file__).resolve().parent.parent
    DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "storage" / "data.db")))
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "SQLALCHEMY_DATABASE_URI",
        f"sqlite:///{DB_PATH}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "static" / "uploads")))
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB
    ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif"}
    ALLOWED_UPLOAD_MIMETYPES = {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
    }
    MAX_IMAGE_WIDTH = int(os.getenv("MAX_IMAGE_WIDTH", "8192"))
    MAX_IMAGE_HEIGHT = int(os.getenv("MAX_IMAGE_HEIGHT", "8192"))
    RATE_LIMIT_MUTATIONS = "60 per minute"
    RATE_LIMIT_UPLOADS = "10 per minute"
    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    JSON_SORT_KEYS = False
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    RATELIMIT_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False


def get_config(config_name: str | None = None):
    name = (config_name or os.getenv("APP_ENV") or "development").lower()
    mapping = {
        "development": DevelopmentConfig,
        "testing": TestingConfig,
        "production": ProductionConfig,
    }
    return mapping.get(name, DevelopmentConfig)
