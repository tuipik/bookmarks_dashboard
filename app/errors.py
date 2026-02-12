from flask import jsonify


def error_response(message: str, status: int = 400, details: dict | None = None):
    payload = {"error": {"message": message}}
    if details:
        payload["error"]["details"] = details
    return jsonify(payload), status
