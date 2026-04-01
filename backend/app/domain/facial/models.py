import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


class FacialEmbedding(Base):
    __tablename__ = "facial_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, unique=True)
    embedding_encrypted: Mapped[str] = mapped_column(Text, nullable=False)  # AES-256-GCM base64
    iv: Mapped[str] = mapped_column(String(32), nullable=False)             # nonce GCM
    model_name: Mapped[str] = mapped_column(String(50), nullable=False)
    enrolled_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="facial_embedding", foreign_keys=[employee_id])  # type: ignore[name-defined]  # noqa: F821
