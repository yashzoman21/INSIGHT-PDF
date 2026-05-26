from flask import Blueprint, request, jsonify, session, send_file
import os
import tempfile
import uuid
from werkzeug.utils import secure_filename

from database import db
from models.chat import Chat
from models.document import Document
from models.mindmap import MindMap
from utils.helpers import login_required
from services.pdf_detector import detect_pdf_type
from services.pdf_extractor import extract_text, extract_pages
from services.chunker import chunk_text
from services.embeddings import prepare_embeddings
from services.vector_store import VectorStore
from utils.text_cleaner import clean_text
from services.ollama_client import (
    generate_mindmap as generate_mindmap_service,
    generate_summary as get_summary_service,
)

pdf_bp = Blueprint("pdf", __name__)

# Runtime cache for expensive extracted text/chunks/vector indexes. Database rows
# remain the source of truth, and this cache can be rebuilt from stored PDFs.
documents = {}
vector_stores = {}

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "storage", "uploads")
LEGACY_UPLOAD_DIRS = [
    os.path.join(BACKEND_DIR, "backend", "storage", "uploads"),
    os.path.abspath(os.path.join(os.getcwd(), "backend", "storage", "uploads")),
    os.path.abspath(os.path.join(os.getcwd(), "backend", "backend", "storage", "uploads")),
]


def parse_document_uuid(document_id):
    try:
        return uuid.UUID(str(document_id))
    except (TypeError, ValueError, AttributeError):
        return None


def get_user_document(document_id):
    document_uuid = parse_document_uuid(document_id)
    if not document_uuid:
        return None

    return Document.query.filter_by(
        id=document_uuid,
        user_id=session.get("user_id"),
    ).first()


def _storage_name(filename):
    return secure_filename(filename or "") or "document.pdf"


def _upload_path(document_id, filename):
    return os.path.join(UPLOAD_DIR, f"{document_id}_{_storage_name(filename)}")


def _candidate_upload_paths(document_id, filename):
    names = []
    for name in (_storage_name(filename), filename):
        if name and name not in names:
            names.append(name)

    dirs = []
    for directory in (UPLOAD_DIR, *LEGACY_UPLOAD_DIRS):
        directory = os.path.abspath(directory)
        if directory not in dirs:
            dirs.append(directory)

    return [
        os.path.join(directory, f"{document_id}_{name}")
        for directory in dirs
        for name in names
    ]


def _find_upload_path(document_id, filename):
    for path in _candidate_upload_paths(document_id, filename):
        if os.path.exists(path):
            return path
    return _upload_path(document_id, filename)


def document_to_dict(doc):
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "status": doc.status,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


def _route_error(message, status):
    return {"message": message, "status": status}


def _json_error(error):
    return jsonify({"error": error["message"]}), error["status"]


def _set_document_status(doc, entry, status):
    doc.status = status
    if entry is not None:
        entry["status"] = status
    db.session.commit()


def _process_document_entry(document_id, doc, entry):
    if not os.path.exists(entry["path"]):
        raise FileNotFoundError("Stored PDF file is missing")

    _set_document_status(doc, entry, "processing")

    try:
        doc_type = detect_pdf_type(entry["path"])
        entry["pdf_type"] = doc_type

        if doc_type == "IMAGE_BASED":
            entry["text"] = "OCR_PENDING"
            entry["chunks"] = []
            vector_stores.pop(document_id, None)
            _set_document_status(doc, entry, "ready")
            return {"pdf_type": doc_type, "total_chunks": 0}

        pages = extract_pages(entry["path"])
        structured_chunks = []
        chunk_idx = 1
        full_cleaned_text_list = []

        for page_num, raw_page_text in pages:
            cleaned_page_text = clean_text(raw_page_text)
            if not cleaned_page_text:
                continue
            full_cleaned_text_list.append(cleaned_page_text)
            page_chunks = chunk_text(cleaned_page_text)
            for chunk in page_chunks:
                structured_chunks.append({
                    "chunk_id": chunk_idx,
                    "document_id": document_id,
                    "text": chunk,
                    "page": page_num
                })
                chunk_idx += 1

        cleaned_text = "\n\n".join(full_cleaned_text_list)


        try:
            prepared_chunks = prepare_embeddings(structured_chunks) if structured_chunks else []
        except Exception as exc:
            print(f"Embedding preparation warning for {document_id}: {exc}")
            prepared_chunks = structured_chunks

        if prepared_chunks and prepared_chunks[0].get("embedding"):
            store = VectorStore()
            dim = len(prepared_chunks[0]["embedding"])
            store.create_index(dim)
            store.add_embeddings(prepared_chunks)
            vector_stores[document_id] = store
        else:
            vector_stores.pop(document_id, None)

        entry["text"] = cleaned_text
        entry["chunks"] = prepared_chunks
        _set_document_status(doc, entry, "ready")
        return {"pdf_type": doc_type, "total_chunks": len(prepared_chunks)}
    except Exception:
        _set_document_status(doc, entry, "failed")
        raise


def get_cached_document(document_id, require_processed=False):
    doc = get_user_document(document_id)
    if not doc:
        return None, None, _route_error("Document not found", 404)

    cache_key = str(doc.id)
    entry = documents.get(cache_key)

    if not entry:
        path = _find_upload_path(cache_key, doc.filename)
        if not os.path.exists(path):
            return doc, None, _route_error("Stored PDF file is missing", 404)

        entry = {
            "filename": doc.filename,
            "path": path,
            "uploaded_by": doc.user_id,
            "status": doc.status,
        }
        documents[cache_key] = entry

    needs_processing = (
        require_processed
        and (entry.get("status") != "ready" or "text" not in entry)
    )
    if needs_processing:
        try:
            _process_document_entry(cache_key, doc, entry)
        except Exception as exc:
            print(f"Document processing error for {cache_key}: {exc}")
            return doc, entry, _route_error("Failed to process document", 500)

    return doc, entry, None


@pdf_bp.route("/detect-pdf-type", methods=["POST"])
@login_required
def detect_pdf_type_route():
    file = request.files.get("pdf")
    if not file:
        return jsonify({"error": "No PDF file provided"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        pdf_path = tmp.name

    try:
        pdf_type = detect_pdf_type(pdf_path)
        return jsonify({"pdf_type": pdf_type})
    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


@pdf_bp.route("/upload-pdf", methods=["POST"])
@login_required
def upload_pdf():
    file = request.files.get("pdf")
    if not file:
        return jsonify({"error": "No PDF file provided"}), 400

    user_id = session["user_id"]
    document_uuid = uuid.uuid4()
    document_id = str(document_uuid)
    filename = file.filename or "document.pdf"

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    save_path = _upload_path(document_id, filename)
    file.save(save_path)

    doc = Document(
        id=document_uuid,
        user_id=user_id,
        filename=filename,
        status="uploaded",
    )
    db.session.add(doc)
    db.session.commit()

    documents[document_id] = {
        "filename": filename,
        "path": save_path,
        "uploaded_by": user_id,
        "status": "uploaded",
    }

    return jsonify({
        "document_id": document_id,
        "filename": filename,
        "status": "uploaded",
    }), 201


@pdf_bp.route("/process-pdf", methods=["POST"])
@login_required
def process_pdf():
    data = request.get_json() or {}
    document_id = data.get("document_id")
    doc, entry, error = get_cached_document(document_id)
    if error:
        return _json_error(error)

    try:
        result = _process_document_entry(str(doc.id), doc, entry)
    except Exception as exc:
        print(f"Process route error for {document_id}: {exc}")
        return jsonify({"error": "Failed to process document"}), 500

    return jsonify({
        "document_id": str(doc.id),
        "status": entry["status"],
        **result,
    }), 200


@pdf_bp.route("/summary", methods=["POST"])
@login_required
def generate_summary():
    data = request.get_json() or {}
    document_id = data.get("document_id")
    doc, entry, error = get_cached_document(document_id, require_processed=True)
    if error:
        return _json_error(error)

    text = entry.get("text")
    if not text or text == "OCR_PENDING":
        return jsonify({"error": "Text not available"}), 400

    try:
        summary = get_summary_service(text)
    except Exception as exc:
        print(f"Summary route error: {exc}")
        return jsonify({"error": "Failed to generate summary"}), 502

    return jsonify({
        "document_id": str(doc.id),
        "summary": summary,
    }), 200


@pdf_bp.route("/mindmap", methods=["POST"])
@login_required
def generate_mindmap():
    data = request.get_json() or {}
    document_id = data.get("document_id")
    doc, entry, error = get_cached_document(document_id)
    if error:
        return _json_error(error)

    existing = MindMap.query.filter_by(document_id=doc.id).first()
    if existing:
        return jsonify({
            "document_id": str(doc.id),
            "mindmap": existing.data,
            "cached": True,
        }), 200

    doc, entry, error = get_cached_document(document_id, require_processed=True)
    if error:
        return _json_error(error)

    text = entry.get("text")
    if not text or text == "OCR_PENDING":
        return jsonify({"error": "Text not available"}), 400

    try:
        mindmap_data = generate_mindmap_service(text)
    except Exception as exc:
        print(f"Mindmap route error: {exc}")
        return jsonify({"error": "Failed to generate mindmap"}), 502

    record = MindMap(document_id=doc.id, data=mindmap_data)
    db.session.add(record)
    db.session.commit()

    return jsonify({
        "document_id": str(doc.id),
        "mindmap": mindmap_data,
        "cached": False,
    }), 200


@pdf_bp.route("/pdfs", methods=["GET"])
@login_required
def list_pdfs():
    user_docs = (
        Document.query
        .filter_by(user_id=session["user_id"])
        .order_by(Document.created_at.desc())
        .all()
    )
    return jsonify([document_to_dict(doc) for doc in user_docs]), 200


@pdf_bp.route("/pdfs/<document_id>/file", methods=["GET"])
@login_required
def get_pdf_file(document_id):
    doc, entry, error = get_cached_document(document_id)
    if error:
        return _json_error(error)

    return send_file(
        entry["path"],
        mimetype="application/pdf",
        download_name=doc.filename,
        as_attachment=False,
        conditional=True,
    )


@pdf_bp.route("/pdfs/<document_id>", methods=["DELETE"])
@login_required
def delete_pdf(document_id):
    doc = get_user_document(document_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    cache_key = str(doc.id)
    for path in _candidate_upload_paths(cache_key, doc.filename):
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as exc:
            print(f"File delete error for {path}: {exc}")

    documents.pop(cache_key, None)
    vector_stores.pop(cache_key, None)

    Chat.query.filter_by(document_id=doc.id).delete()
    MindMap.query.filter_by(document_id=doc.id).delete()
    db.session.delete(doc)
    db.session.commit()

    return jsonify({
        "message": "Document deleted successfully",
        "document_id": cache_key,
    }), 200
