import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Enum, ForeignKey, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


class EmployeeRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(18), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    employees: Mapped[list["Employee"]] = relationship("Employee", back_populates="company")


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    auth_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cpf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    pis: Mapped[str | None] = mapped_column(String(14), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[EmployeeRole] = mapped_column(Enum(EmployeeRole, name="employee_role", create_constraint=False), nullable=False, default=EmployeeRole.EMPLOYEE)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    work_schedule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("work_schedules.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hired_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    terminated_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    terminal_code: Mapped[str | None] = mapped_column(String(6), nullable=True)  # código numérico do terminal
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    company: Mapped["Company"] = relationship("Company", back_populates="employees")
    consents: Mapped[list["EmployeeConsent"]] = relationship("EmployeeConsent", back_populates="employee", foreign_keys="EmployeeConsent.employee_id")
    facial_embedding: Mapped["FacialEmbedding | None"] = relationship("FacialEmbedding", back_populates="employee", foreign_keys="FacialEmbedding.employee_id", uselist=False)


class EmployeeConsent(Base):
    __tablename__ = "employee_consents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    term_version: Mapped[str] = mapped_column(String(20), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="consents", foreign_keys=[employee_id])


# Import circular evitado — FacialEmbedding definido no módulo facial
from app.domain.facial.models import FacialEmbedding  # noqa: E402, F401
