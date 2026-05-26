from database import db
from sqlalchemy.dialects.postgresql import UUID
import uuid

class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    filename = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="uploaded")
    created_at = db.Column(db.DateTime, server_default=db.func.now())