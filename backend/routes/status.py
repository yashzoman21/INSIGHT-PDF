from flask import Blueprint, jsonify, session

from models.document import Document
from routes.pdf import parse_document_uuid
from utils.helpers import login_required

status_bp = Blueprint("status", __name__)


@status_bp.route("/status/<document_id>", methods=["GET"])
@login_required
def get_status(document_id):
    document_uuid = parse_document_uuid(document_id)
    if not document_uuid:
        return jsonify({"error": "Document not found"}), 404

    doc = Document.query.filter_by(
        id=document_uuid,
        user_id=session["user_id"],
    ).first()
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    return jsonify({
        "document_id": str(doc.id),
        "status": doc.status,
    }), 200
