import re
from urllib.parse import urlparse


class ValidationError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def require_dict(value, message="invalid JSON payload"):
    if not isinstance(value, dict):
        raise ValidationError(message)
    return value


def require_string(data: dict, key: str, max_len: int | None = None, min_len: int = 1) -> str:
    value = data.get(key)
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string")
    value = value.strip()
    if len(value) < min_len:
        raise ValidationError(f"'{key}' is required")
    if max_len is not None and len(value) > max_len:
        raise ValidationError(f"'{key}' exceeds max length {max_len}")
    return value


def optional_string(data: dict, key: str, max_len: int | None = None) -> str | None:
    value = data.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string")
    if max_len is not None and len(value) > max_len:
        raise ValidationError(f"'{key}' exceeds max length {max_len}")
    return value


def require_int(
    data: dict, key: str, min_value: int | None = None, max_value: int | None = None
) -> int:
    value = data.get(key)
    try:
        int_value = int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"'{key}' must be an integer") from None
    if min_value is not None and int_value < min_value:
        raise ValidationError(f"'{key}' must be >= {min_value}")
    if max_value is not None and int_value > max_value:
        raise ValidationError(f"'{key}' must be <= {max_value}")
    return int_value


def optional_int(
    data: dict, key: str, min_value: int | None = None, max_value: int | None = None
) -> int | None:
    if key not in data:
        return None
    return require_int(data, key, min_value=min_value, max_value=max_value)


def optional_float(
    data: dict, key: str, min_value: float | None = None, max_value: float | None = None
) -> float | None:
    if key not in data:
        return None
    value = data.get(key)
    try:
        float_value = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"'{key}' must be a number") from None
    if min_value is not None and float_value < min_value:
        raise ValidationError(f"'{key}' must be >= {min_value}")
    if max_value is not None and float_value > max_value:
        raise ValidationError(f"'{key}' must be <= {max_value}")
    return float_value


def optional_url(data: dict, key: str, max_len: int = 1024) -> str | None:
    value = optional_string(data, key, max_len=max_len)
    if value is None or value == "":
        return value
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        raise ValidationError(f"'{key}' must be an http/https URL")
    if not parsed.netloc:
        raise ValidationError(f"'{key}' must be a valid URL")
    return value


def list_of_ints(data: dict, key: str, max_items: int = 1000) -> list[int]:
    value = data.get(key)
    if not isinstance(value, list):
        raise ValidationError(f"'{key}' must be a list")
    if len(value) > max_items:
        raise ValidationError(f"'{key}' exceeds max size {max_items}")
    items = []
    for item in value:
        try:
            items.append(int(item))
        except (TypeError, ValueError):
            raise ValidationError(f"'{key}' contains non-integer value") from None
    return items


def optional_hex_color(data: dict, key: str) -> str | None:
    if key not in data:
        return None
    value = data.get(key)
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValidationError(f"'{key}' must be a hex color like #ffffff")
    return value.lower()
