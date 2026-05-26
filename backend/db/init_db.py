import os
import sys

# Add the parent directory of this file to sys.path so we can import app and database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from database import db

# Import all models to ensure SQLAlchemy registers their tables
from models.user import User
from models.document import Document
from models.chat import Chat
from models.mindmap import MindMap

with app.app_context():
    print("Initializing PostgreSQL database tables...")
    try:
        db.create_all()
        print("Database tables initialized successfully!")
    except Exception as e:
        print("Error initializing database tables:", e)
