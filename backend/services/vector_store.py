import faiss
import numpy as np

class VectorStore:
    def __init__(self):
        self.index = None
        self.dimension = None
        self.chunk_map = []
        self.is_initialized = False

    def create_index(self, dim: int):
        self.dimension = dim
        self.index = faiss.IndexFlatL2(dim)

    def add_embeddings(self, chunks: list):
        if self.is_initialized:
            return
        vectors = np.array(
            [chunk["embedding"] for chunk in chunks],
            dtype="float32"
        )

        self.index.add(vectors)
        self.chunk_map.extend(chunks)
        self.is_initialized = True

    def search(self, query_embedding: list, k: int = 5):
        query_vector = np.array([query_embedding], dtype="float32")

        k = min(k , len(self.chunk_map))
        distances, indices = self.index.search(query_vector, k)

        seen = set()
        results = []
        for idx in indices[0]:
            if idx not in seen:
                seen.add(idx)
            results.append(self.chunk_map[idx])

        return results