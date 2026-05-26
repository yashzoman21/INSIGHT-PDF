"""
chunker.py
-----------
Responsible for splitting extracted PDF text into overlapping chunks
before embeddings are created.

Chunking Strategy:
- Chunk size: ~500 tokens (approximated using words)
- Overlap: ~50 tokens
- Order preserved

👉 Jaisa bola tha vhai rule follow kiya
"""

from typing import List

WORDS_PER_TOKEN = 0.75

CHUNK_SIZE_TOKENS = 120
OVERLAP_TOKENS = 20

CHUNK_SIZE_WORDS = int(CHUNK_SIZE_TOKENS / WORDS_PER_TOKEN)
OVERLAP_WORDS = int(OVERLAP_TOKENS / WORDS_PER_TOKEN)


def chunk_text(text: str) -> List[str]:
    
    if not text or not text.strip():
        return []

    
    text = " ".join(text.split())

   
    words = text.split(" ")

    chunks = []
    start = 0
    total_words = len(words)

    
    while start < total_words:
        end = start + CHUNK_SIZE_WORDS
        chunk_words = words[start:end]

        chunk_text = " ".join(chunk_words)
        chunks.append(chunk_text)

        
        start = end - OVERLAP_WORDS

        
        if start < 0:
            start = 0

    return chunks
