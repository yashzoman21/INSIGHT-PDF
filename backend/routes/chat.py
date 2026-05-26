from flask import Blueprint, request, jsonify
from flask_cors import cross_origin

from database import db
from models.chat import Chat
from routes.pdf import get_cached_document, vector_stores
from services.ollama_client import generate_response
from utils.helpers import login_required

chat_bp = Blueprint("chat", __name__)


def _local_document_answer(query, chunks):
    query_terms = {
        word.strip(".,:;!?()[]{}\"'").lower()
        for word in query.split()
        if len(word.strip(".,:;!?()[]{}\"'")) > 2
    }
    scored_sentences = []

    for chunk in chunks[:8]:
        sentences = chunk["text"].replace("\n", " ").split(". ")
        for sentence in sentences:
            cleaned = sentence.strip()
            if len(cleaned) < 40:
                continue

            lower_sentence = cleaned.lower()
            score = sum(1 for term in query_terms if term in lower_sentence)
            if score:
                scored_sentences.append((score, cleaned))

    scored_sentences.sort(key=lambda item: item[0], reverse=True)
    selected = [sentence for _, sentence in scored_sentences[:3]]

    if not selected:
        selected = [
            chunk["text"].replace("\n", " ").strip()[:500]
            for chunk in chunks[:2]
            if chunk.get("text")
        ]

    if not selected:
        return "I could not find searchable text in this document."

    bullets = "\n".join(f"- {sentence.rstrip('.')}" for sentence in selected)
    return (
        "I could not reach the AI model, so I pulled the most relevant text I could "
        f"find from the document instead:\n\n{bullets}"
    )


def _save_chat_response(doc_id, query, answer):
    user_msg = Chat(
        document_id=doc_id,
        role="user",
        message=query,
    )
    db.session.add(user_msg)

    ai_msg = Chat(
        document_id=doc_id,
        role="assistant",
        message=answer,
    )
    db.session.add(ai_msg)
    db.session.commit()


@chat_bp.route("/chat", methods=["POST", "OPTIONS"])
@login_required
@cross_origin(supports_credentials=True)
def chat():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json() or {}
    document_id = data.get("document_id")
    query = data.get("query")

    if not document_id or not query:
        return jsonify({"error": "document_id and query required"}), 400

    doc, entry, error = get_cached_document(document_id, require_processed=True)
    if error:
        return jsonify({"error": error["message"]}), error["status"]

    if entry.get("text") == "OCR_PENDING":
        answer = "This PDF appears to be image-based, and OCR is not available yet. I need selectable text before I can answer questions from it."
        _save_chat_response(doc.id, query, answer)
        return jsonify({"document_id": str(doc.id), "answer": answer}), 200

    chunks = entry.get("chunks", [])
    if not chunks:
        answer = "I could not find searchable text in this document. Try uploading a text-based PDF or adding OCR support for scanned PDFs."
        _save_chat_response(doc.id, query, answer)
        return jsonify({"document_id": str(doc.id), "answer": answer}), 200

    # Retrieve relevant chunks using VectorStore semantic search
    vector_store = vector_stores.get(document_id)
    if vector_store and vector_store.is_initialized:
        from services.embeddings import get_query_embedding
        try:
            query_emb = get_query_embedding(query)
            relevant_chunks = vector_store.search(query_emb, k=4)
        except Exception as exc:
            print(f"Vector search failed: {exc}")
            relevant_chunks = chunks[:4]
    else:
        relevant_chunks = chunks[:4]

    # Format context page-by-page
    context_parts = []
    for chunk in relevant_chunks:
        page_num = chunk.get("page", 1)
        context_parts.append(f"[Page {page_num}]: {chunk['text']}")
    context = "\n\n".join(context_parts)

    prompt = f"""
You are answering STRICTLY from the document below.
If the answer is not present, say: "Not found in the document."

For each fact or piece of information you take from a specific page, cite it by placing "[Page N]" (where N is the page number) at the end of the sentence or statement. You must strictly use the page numbers provided in the format "[Page N]".

Document:
{context}

Question:
{query}
"""


    try:
        answer = generate_response(prompt)
    except Exception as exc:
        print(f"Chat generation error: {exc}")
        answer = _local_document_answer(query, chunks)

    _save_chat_response(doc.id, query, answer)

    return jsonify({
        "document_id": str(doc.id),
        "answer": answer,
    }), 200


@chat_bp.route("/history/<document_id>", methods=["GET"])
@login_required
def get_chat_history(document_id):
    doc, entry, error = get_cached_document(document_id)
    if error:
        return jsonify({"error": error["message"]}), error["status"]

    chats = Chat.query.filter_by(document_id=doc.id).order_by(Chat.created_at.asc()).all()
    history = [
        {"role": chat.role, "text": chat.message}
        for chat in chats
    ]
    return jsonify(history), 200

