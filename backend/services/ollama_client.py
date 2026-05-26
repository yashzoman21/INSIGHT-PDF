import json
import os
import re
from pathlib import Path
import requests
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen2.5-coder")

def _generate_content(prompt, force_json=False):
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1 if force_json else 0.4
        }
    }
    
    # Instruct Ollama to return structured JSON
    if force_json:
        payload["format"] = "json"
        
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        response_text = response.json().get("response", "")
        
        # Clean up deepseek thinking tags if using deepseek model
        if "deepseek" in MODEL_NAME.lower():
            response_text = re.sub(r"<think>.*?</think>", "", response_text, flags=re.DOTALL).strip()
            
        return response_text
    except Exception as e:
        raise RuntimeError(f"Ollama local API error: {e}")

def generate_response(prompt: str) -> str:
    return _generate_content(prompt)

def generate_summary(text: str) -> str:
    prompt = f"Summarize the following document in 5-7 concise bullet points:\n\n{text[:6000]}"
    return _generate_content(prompt)

def generate_mindmap(text: str) -> dict:
    prompt = (
        "Convert the following document into a strictly hierarchical JSON mind map. "
        "Use ONLY keys 'title' and 'children'. Do not include emojis.\n\n"
        f"Document:\n{text[:6000]}"
    )
    response_text = _generate_content(prompt, force_json=True)
    return json.loads(response_text)
