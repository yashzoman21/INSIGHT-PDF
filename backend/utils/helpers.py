from functools import wraps
from flask import session, jsonify, request

def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        # ✅ allow preflight
        if request.method == "OPTIONS":
            return "", 200

        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401

        return func(*args, **kwargs)
    return wrapper