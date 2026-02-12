import os
import secrets
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename

from app.errors import error_response
from app.extensions import limiter
from app.repositories import BoardRepository, SettingsRepository
from app.validators import (
    ValidationError,
    list_of_ints,
    optional_float,
    optional_hex_color,
    optional_int,
    optional_string,
    optional_url,
    require_dict,
    require_int,
    require_string,
)

api_bp = Blueprint("api", __name__, url_prefix="/api")

SETTINGS_FIELDS = (
    "dashboard_title",
    "dashboard_bg_image",
    "cols_per_row",
    "column_width",
    "card_height",
    "column_bg_color",
    "column_bg_opacity",
    "card_bg_color",
    "card_bg_opacity",
)

board_repo = BoardRepository()
settings_repo = SettingsRepository()
FORMAT_TO_MIME = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "GIF": "image/gif",
}
FORMAT_TO_EXTS = {
    "PNG": {".png"},
    "JPEG": {".jpg", ".jpeg"},
    "WEBP": {".webp"},
    "GIF": {".gif"},
}


def mutation_limit() -> str:
    return current_app.config["RATE_LIMIT_MUTATIONS"]


def upload_limit() -> str:
    return current_app.config["RATE_LIMIT_UPLOADS"]


@api_bp.errorhandler(ValidationError)
def handle_validation_error(err):
    return error_response(err.message, status=err.status)


@api_bp.route("/state")
def api_state():
    return jsonify(board_repo.get_state())


@api_bp.route("/settings")
def api_get_settings():
    settings = settings_repo.get()
    if not settings:
        return error_response("settings not found", 404)
    return jsonify(settings.to_dict())


@api_bp.route("/settings", methods=["PUT"])
@limiter.limit(mutation_limit)
def api_update_settings():
    data = require_dict(request.get_json(silent=True) or {}, message="invalid settings payload")
    unknown = set(data.keys()) - set(SETTINGS_FIELDS)
    if unknown:
        return error_response("unsupported settings fields", 400, {"fields": sorted(unknown)})

    updates = {}
    title = optional_string(data, "dashboard_title", max_len=120)
    if title is not None:
        updates["dashboard_title"] = title or "Start Dashboard"

    bg_url = optional_url(data, "dashboard_bg_image", max_len=2048)
    if bg_url is not None:
        updates["dashboard_bg_image"] = bg_url

    cols_per_row = optional_int(data, "cols_per_row", min_value=1, max_value=10)
    if cols_per_row is not None:
        updates["cols_per_row"] = cols_per_row

    column_width = optional_int(data, "column_width", min_value=200, max_value=1200)
    if column_width is not None:
        updates["column_width"] = column_width

    card_height = optional_int(data, "card_height", min_value=0, max_value=2000)
    if card_height is not None:
        updates["card_height"] = card_height

    column_bg_color = optional_hex_color(data, "column_bg_color")
    if column_bg_color is not None:
        updates["column_bg_color"] = column_bg_color

    column_bg_opacity = optional_float(data, "column_bg_opacity", min_value=0.0, max_value=1.0)
    if column_bg_opacity is not None:
        updates["column_bg_opacity"] = column_bg_opacity

    card_bg_color = optional_hex_color(data, "card_bg_color")
    if card_bg_color is not None:
        updates["card_bg_color"] = card_bg_color

    card_bg_opacity = optional_float(data, "card_bg_opacity", min_value=0.0, max_value=1.0)
    if card_bg_opacity is not None:
        updates["card_bg_opacity"] = card_bg_opacity

    if not updates:
        return error_response("no fields provided", 400)

    settings = settings_repo.update(updates)
    if not settings:
        return error_response("settings not found", 404)
    return jsonify(settings.to_dict())


@api_bp.route("/card", methods=["POST"])
@limiter.limit(mutation_limit)
def api_add_card():
    data = require_dict(request.get_json(silent=True) or {}, message="invalid card payload")
    title = require_string(data, "title", max_len=200)
    column_id = require_int(data, "column_id", min_value=1)
    link = optional_url(data, "link", max_len=2048) or ""
    description = optional_string(data, "description", max_len=2000) or ""
    icon = optional_url(data, "icon", max_len=2048) or ""

    card = board_repo.add_card(
        title=title,
        column_id=column_id,
        link=link,
        description=description,
        icon=icon,
    )
    if not card:
        return error_response("column not found", 404)
    return jsonify(card.to_dict()), 201


@api_bp.route("/card/<int:card_id>", methods=["PUT", "DELETE"])
@limiter.limit(mutation_limit)
def api_modify_card(card_id):
    if request.method == "DELETE":
        board_repo.delete_card(card_id)
        return ("", 204)

    data = require_dict(request.get_json(silent=True) or {}, message="invalid card payload")
    title = optional_string(data, "title", max_len=200)
    column_id = optional_int(data, "column_id", min_value=1)
    link = optional_url(data, "link", max_len=2048)
    description = optional_string(data, "description", max_len=2000)
    icon = optional_url(data, "icon", max_len=2048)

    card, err = board_repo.update_card(
        card_id,
        title=title,
        column_id=column_id,
        link=link,
        description=description,
        icon=icon,
    )
    if err == "card_not_found":
        return error_response("card not found", 404)
    if err == "column_not_found":
        return error_response("target column not found", 404)
    return jsonify(card.to_dict())


@api_bp.route("/column", methods=["POST"])
@limiter.limit(mutation_limit)
def api_add_column():
    data = require_dict(request.get_json(silent=True) or {}, message="invalid column payload")
    name = require_string(data, "name", max_len=120)
    column = board_repo.add_column(name)
    payload = column.to_dict(include_cards=False)
    payload["cards"] = []
    return jsonify(payload), 201


@api_bp.route("/column/<int:col_id>", methods=["PUT", "DELETE"])
@limiter.limit(mutation_limit)
def api_modify_column(col_id):
    if request.method == "DELETE":
        board_repo.delete_column(col_id)
        return ("", 204)

    data = require_dict(request.get_json(silent=True) or {}, message="invalid column payload")
    name = require_string(data, "name", max_len=120)
    column = board_repo.update_column(col_id, name)
    if not column:
        return error_response("column not found", 404)
    payload = column.to_dict(include_cards=False)
    payload["cards"] = []
    return jsonify(payload)


@api_bp.route("/column/<int:col_id>/reorder-cards", methods=["POST"])
@limiter.limit(mutation_limit)
def api_reorder_cards(col_id):
    data = require_dict(request.get_json(silent=True) or {}, message="invalid reorder payload")
    order = list_of_ints(data, "order")
    _, err = board_repo.reorder_cards(col_id, order)
    if err == "column_not_found":
        return error_response("column not found", 404)
    if err == "duplicate_ids":
        return error_response("order must not contain duplicate ids", 400)
    if err == "incomplete_or_invalid_order":
        return error_response("order must contain all cards in this column exactly once", 400)
    return ("", 204)


@api_bp.route("/column/reorder", methods=["POST"])
@limiter.limit(mutation_limit)
def api_reorder_columns():
    data = require_dict(request.get_json(silent=True) or {}, message="invalid reorder payload")
    order = list_of_ints(data, "order")
    _, err = board_repo.reorder_columns(order)
    if err == "duplicate_ids":
        return error_response("order must not contain duplicate ids", 400)
    if err == "incomplete_or_invalid_order":
        return error_response("order must contain all columns exactly once", 400)
    return ("", 204)


@api_bp.route("/upload-bg", methods=["POST"])
@limiter.limit(upload_limit)
def api_upload_bg():
    if "file" not in request.files:
        return error_response("no file uploaded", 400)

    file = request.files["file"]
    if not file or not file.filename:
        return error_response("empty filename", 400)

    ext = Path(file.filename).suffix.lower()
    allowed_ext = current_app.config["ALLOWED_UPLOAD_EXTENSIONS"]
    allowed_mime = current_app.config["ALLOWED_UPLOAD_MIMETYPES"]
    if ext not in allowed_ext:
        return error_response("unsupported file extension", 400)
    if file.mimetype not in allowed_mime:
        return error_response("unsupported file type", 400)
    image_format, width, height = _inspect_image(file)
    if not image_format:
        return error_response("invalid image content", 400)
    expected_mime = FORMAT_TO_MIME.get(image_format)
    expected_exts = FORMAT_TO_EXTS.get(image_format, set())
    if expected_mime not in allowed_mime:
        return error_response("unsupported image format", 400)
    if file.mimetype != expected_mime:
        return error_response("mime type does not match image content", 400)
    if ext not in expected_exts:
        return error_response("file extension does not match image content", 400)
    if (
        width > current_app.config["MAX_IMAGE_WIDTH"]
        or height > current_app.config["MAX_IMAGE_HEIGHT"]
    ):
        return error_response("image dimensions exceed allowed limit", 400)

    original_name = secure_filename(file.filename)
    stem = Path(original_name).stem[:50] or "bg"
    safe_name = f"{stem}_{secrets.token_hex(8)}{ext}"
    upload_dir = Path(current_app.config["UPLOAD_DIR"])
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination = upload_dir / safe_name
    file.save(destination)
    url = f"/static/uploads/{safe_name}"

    prev_url = settings_repo.set_background(url)
    _remove_old_background_file(prev_url, upload_dir)
    return jsonify({"url": url})


@api_bp.route("/settings/bg", methods=["DELETE"])
@limiter.limit(mutation_limit)
def api_reset_bg():
    upload_dir = Path(current_app.config["UPLOAD_DIR"])
    prev_url = settings_repo.clear_background()
    _remove_old_background_file(prev_url, upload_dir)
    return ("", 204)


def _remove_old_background_file(prev_url: str | None, upload_dir: Path) -> None:
    if not prev_url or not prev_url.startswith("/static/uploads/"):
        return
    prev_name = Path(prev_url).name
    prev_path = upload_dir / prev_name
    if prev_path.exists() and prev_path.is_file():
        os.remove(prev_path)


def _inspect_image(file) -> tuple[str | None, int, int]:
    try:
        file.stream.seek(0)
        with Image.open(file.stream) as img:
            fmt = (img.format or "").upper()
            width, height = img.size
            img.load()
        file.stream.seek(0)
        return fmt, width, height
    except (UnidentifiedImageError, OSError):
        file.stream.seek(0)
        return None, 0, 0
