from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model

def prepare_embeddings(chunks):
    """
    Takes structured chunks and adds real embeddings.
    """
    if not chunks:
        return []

    texts = [chunk["text"] for chunk in chunks]

    embeddings = _get_model().encode(texts).tolist()

    prepared_chunks = []
    for chunk, emb in zip(chunks, embeddings):
        # Dynamically copy all metadata attributes (like page) from input chunk
        chunk_copy = chunk.copy()
        chunk_copy["embedding"] = emb
        prepared_chunks.append(chunk_copy)

    return prepared_chunks


def get_query_embedding(query: str):
    """
    Encodes a single query string to list embedding.
    """
    if not query or not query.strip():
        return []
    return _get_model().encode(query).tolist()
