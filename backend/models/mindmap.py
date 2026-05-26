from database import db
from sqlalchemy.dialects.postgresql import UUID

class MindMap(db.Model):
    __tablename__ = "mindmaps"

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
