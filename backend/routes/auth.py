from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from models.user import User
from database import db

auth_bp = Blueprint("auth", __name__)

MIN_PASSWORD_LENGTH = 6

# -----------------------------
# SIGNUP
# -----------------------------
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password)
    )

    db.session.add(user)
    db.session.commit()

    session["user_id"] = user.id

    return jsonify(user.to_dict()), 201

# -----------------------------
# LOGIN
# -----------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user.id

    return jsonify(user.to_dict()), 200

# -----------------------------
# LOGOUT
# -----------------------------
@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200

# -----------------------------
# SESSION CHECK
# -----------------------------
@auth_bp.route("/session-check", methods=["GET"])
def session_check():
    if "user_id" in session:
        return jsonify({"authenticated": True}), 200
    return jsonify({"authenticated": False}), 401

# -----------------------------
# GET CURRENT USER
# -----------------------------
@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user.to_dict()), 200
