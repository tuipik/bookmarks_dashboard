from pathlib import Path

from flask import Flask
from werkzeug.exceptions import HTTPException

import app.models  # noqa: F401
from app.config import get_config
from app.errors import error_response
from app.extensions import db, limiter
from app.routes.api import api_bp
from app.routes.pages import pages_bp
from app.security import register_security


def create_app(config_name: str | None = None, test_config: dict | None = None) -> Flask:
    base_dir = Path(__file__).resolve().parent.parent
    app = Flask(
        __name__,
        static_folder=str(base_dir / "static"),
        template_folder=str(base_dir / "templates"),
    )
    app.config.from_object(get_config(config_name))
    if test_config:
        app.config.update(test_config)
    if "SQLALCHEMY_DATABASE_URI" not in app.config:
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{app.config['DB_PATH']}"
    elif test_config and "DB_PATH" in test_config and "SQLALCHEMY_DATABASE_URI" not in test_config:
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{app.config['DB_PATH']}"

    Path(app.config["UPLOAD_DIR"]).mkdir(parents=True, exist_ok=True)
    db.init_app(app)
    limiter.init_app(app)

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp)
    register_security(app)
    register_error_handlers(app)

    return app


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(413)
    def too_large(_err):
        return error_response("file too large", 413)

    @app.errorhandler(404)
    def not_found(_err):
        return error_response("not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(_err):
        return error_response("method not allowed", 405)

    @app.errorhandler(Exception)
    def internal_error(err):
        if isinstance(err, HTTPException):
            return error_response(err.description, err.code or 500)
        app.logger.exception("Unhandled server error: %s", err)
        return error_response("internal server error", 500)
