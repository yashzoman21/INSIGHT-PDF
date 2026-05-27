# 🧠 InSightPDF: Offline RAG & Interactive Document Intelligence

InSightPDF is a premium, fully local full-stack web application that transforms how you interact with PDF documents. By leveraging a local Retrieval-Augmented Generation (RAG) pipeline, local embedding models, and local LLMs running via Ollama, InSightPDF provides secure, offline chat intelligence, automated document summaries, and interactive hierarchical mind maps without sending any data to external cloud APIs.

---

## ✨ Key Features

### 1. 🔒 100% Offline & Private Local RAG
* **Local Embeddings**: Generates vector representations using Hugging Face's `all-MiniLM-L6-v2` transformer model (runs locally on your CPU/GPU).
* **FAISS Vector Index**: Uses Facebook AI Similarity Search (FAISS) to build high-performance vector indexes stored independently per document to prevent cross-contamination.
* **Local Inference via Ollama**: Connects to your local Ollama instance (tested with `mistral:latest` and configurable for any local model like `qwen2.5-coder` or `deepseek`).

### 2. 🔖 Clickable Citations & Jump-to-Page Navigation
* **Page-Level Chunking**: Extracts and cleans PDF text page-by-page (using `pdfplumber`), preserving page metadata for all text chunks.
* **Inline Citation Badges**: The local LLM cites source pages (e.g. `[Page 2]`) for every statement. The frontend renders these citations as interactive inline badges.
* **Instant Scroll Navigation**: Clicking any citation badge automatically scrolls the PDF preview iframe directly to the corresponding page.
* **Cross-Origin Handling**: Utilizes React `key`-based iframe remounting to bypass cross-origin browser security restrictions (Vite on port 5173, Flask on port 5000) and force the browser's native PDF plugin to scroll.

### 3. 🕸️ Interactive Hierarchical Mind Maps
* **Hierarchical Generation**: Automatically compiles the PDF's primary concepts into a structured JSON tree.
* **Case-Insensitive Parsing**: The parser dynamically processes case-insensitive and capitalized output keys (e.g. `title/Title`, `children/Children`) from local models to ensure flawless rendering.
* **Interactive Concept Explanations**: Uses D3.js and Markmap to render an interactive, zoomable, and collapsible tree diagram. Clicking any node automatically switches views and queries the chat assistant to explain that specific concept.

### 4. 🎛️ Premium Full-Stack Architecture
* **Sleek React UI**: Modern interface built with TailwindCSS, Framer Motion animations, glassmorphism, and responsive sidebars for mobile.
* **Flask REST API**: Modular blueprint-based routing architecture with watchdog-enabled hot-reloading.
* **Database Persistence**: Session-based secure authentication and relational PostgreSQL database storage to persist users, documents, full chat history, and generated mind maps.

---

## 🧠 High-Level Architecture & Data Flow

```mermaid
flowchart TD
    %% Styling Definitions
    classDef frontend fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef backend fill:#7c3aed,stroke:#6d28d9,color:#ffffff,stroke-width:2px;
    classDef storage fill:#059669,stroke:#047857,color:#ffffff,stroke-width:2px;
    classDef localModel fill:#d97706,stroke:#b45309,color:#ffffff,stroke-width:2px;

    subgraph UserInterface["🖥️ Frontend (React & Vite)"]
        UI_Doc[Upload PDF]
        UI_Chat[Ask Q&A Question]
        UI_Click[Click Citation Badge]
        UI_Mindmap[Interactive Mind Map]
    end

    subgraph ServerAPI["⚙️ Backend Server (Flask)"]
        API_Upload[PDF Ingestion & Type Detection]
        API_Process[pdfplumber Page-by-Page Extraction]
        API_Embedding[all-MiniLM-L6-v2 Embeddings Generator]
        API_Query[Query Embedding Vectorizer]
        API_RAG[RAG Retrieval & Context Compiler]
        API_Mindmap[JSON Mind Map Endpoint]
    end

    subgraph StorageData["💾 Local Storage & Database"]
        DB_Meta[PostgreSQL: Users, Chats, Docs, Mindmaps]
        FAISS_Store[FAISS Vector Index per PDF]
    end

    subgraph LocalAI["🤖 Local Offline Models (Ollama)"]
        Ollama_LLM[mistral:latest / Local Inference]
    end

    %% Ingestion Flow
    UI_Doc -->|1. Upload File| API_Upload
    API_Upload -->|2. Store Metadata| DB_Meta
    API_Upload -->|3. Extract Text| API_Process
    API_Process -->|4. Chunk Page Text| API_Embedding
    API_Embedding -->|5. Compute Vectors & Index| FAISS_Store

    %% Chat Q&A Flow
    UI_Chat -->|6. Send Query| API_Query
    API_Query -->|7. Semantic Search| FAISS_Store
    FAISS_Store -->|8. Fetch Top-4 Chunks| API_RAG
    API_RAG -->|9. Build Context & Cite Prompts| Ollama_LLM
    Ollama_LLM -->|10. Generate Answers with 'Page N' tags| UI_Chat
    
    %% Citation Jump & Mind Map Flow
    UI_Click -->|11. Trigger React key-remount| UI_Doc
    UI_Mindmap -->|12. Request Concept Nodes| API_Mindmap
    API_Mindmap -->|13. Build Node Prompt| Ollama_LLM
    Ollama_LLM -->|14. Output JSON Tree| UI_Mindmap

    %% Apply Classes
    class UI_Doc,UI_Chat,UI_Click,UI_Mindmap frontend;
    class API_Upload,API_Process,API_Embedding,API_Query,API_RAG,API_Mindmap backend;
    class DB_Meta,FAISS_Store storage;
    class Ollama_LLM localModel;
```

---

## 📦 Tech Stack

### Frontend (Client)
* **Framework**: React.js with Vite
* **Styling**: Vanilla CSS & TailwindCSS
* **Animation**: Framer Motion
* **Visualization**: D3.js, Markmap, Lucide React Icons

### Backend (Server)
* **Framework**: Flask (Python)
* **PDF Parsing**: `pdfplumber`
* **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2` running locally)
* **Vector Index**: `faiss-cpu`
* **Local Inference**: Ollama API Client
* **Database**: PostgreSQL (via SQLAlchemy)
* **Session Handler**: Secure Session Cookies with Lax configuration

---

## ⚙️ Setup and Installation

### Prerequisites
1. **Python 3.10+** installed.
2. **Node.js 18+** installed.
3. **PostgreSQL** database server running locally.
4. **Ollama** installed locally.

---

### Step 1: Set Up local Ollama & Model
1. Download and run Ollama on your machine.
2. Download the model (default is `mistral:latest`):
   ```bash
   ollama pull mistral:latest
   ```

### Step 2: Set Up Backend
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On MacOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   OLLAMA_MODEL=mistral:latest
   OLLAMA_URL=http://localhost:11434/api/generate
   ```
5. Ensure your PostgreSQL database is running and create a database called `pdf_summarizer`. The default database URI used in `app.py` is:
   ```python
   app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://pdf_user:pdf_password@localhost:5432/pdf_summarizer"
   ```
   Modify this connection string in `backend/app.py` or specify the matching user/password/port on your local PostgreSQL server.

6. Run the database migration/initialization script:
   ```bash
   python db/init_db.py
   ```

7. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend will start running on `http://127.0.0.1:5000`.

---

### Step 3: Set Up Frontend
1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will start running on `http://localhost:5173/`.

---

## 🔗 Primary API Endpoints

### Authentication
* `POST /auth/signup` - Register a new user account.
* `POST /auth/login` - Authenticate credentials and establish session cookies.
* `POST /auth/logout` - Invalidate session cookies.
* `GET /auth/me` - Check current session status and user data.

### PDF Processing
* `POST /pdf/upload-pdf` - Upload a PDF file (stores on disk).
* `POST /pdf/process-pdf` - Extract pages, chunk text, generate embeddings, and build FAISS index.
* `GET /pdf/pdfs` - List uploaded documents for the authenticated user.
* `GET /pdf/pdfs/<document_id>/file` - Stream the raw PDF binary file.
* `DELETE /pdf/pdfs/<document_id>` - Remove document, database entries, vector store, and chat history.

### Intelligence Features
* `POST /chat/chat` - Perform semantic similarity search and get RAG chat answer with citations.
* `GET /chat/history/<document_id>` - Fetch full message log for the document.
* `POST /pdf/summary` - Generate summary bullet points from the document.
* `POST /pdf/mindmap` - Generate hierarchical JSON mindmap nodes.



