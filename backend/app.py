from flask import Flask
from flask_cors import CORS
from database import db
from routes.auth import auth_bp
from routes.pdf import pdf_bp   
from routes.chat import chat_bp
from routes.status import status_bp
from models.document import Document
from models.mindmap import MindMap
from dotenv import load_dotenv
import os

load_dotenv()

# Remove the print statement for security in production, 
# but for now it's fine to verify the key is loaded.
# print("GEMINI_API_KEY =", os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)
app.secret_key = "dev-secret-key"

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://pdf_user:pdf_password@localhost:5432/pdf_summarizer"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

#app.config["SQLALCHEMY_DATABASE_URI"] = (
#    f"postgresql+psycopg2://{os.getenv('DB_USER')}:"
#    f"{os.getenv('DB_PASSWORD')}@"
#    f"{os.getenv('DB_HOST')}:"
#    f"{os.getenv('DB_PORT')}/"
#    f"{os.getenv('DB_NAME')}"
#)


# ✅ CORRECT COOKIE CONFIG FOR LOCALHOST
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",   # ← Correct for localhost
    SESSION_COOKIE_SECURE=False,     # localhost = False (True for HTTPS in production)
)

# ✅ CORRECT CORS CONFIG
CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
)

# Initialize DB
db.init_app(app)

# Register routes WITH PREFIXES (This was the missing part!)
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(pdf_bp, url_prefix='/pdf')
app.register_blueprint(chat_bp, url_prefix='/chat')
app.register_blueprint(status_bp, url_prefix='/status')

if __name__ == "__main__":
    app.run(debug=True, port=5000) 