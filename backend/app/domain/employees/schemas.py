import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.domain.employees.models import EmployeeRole


class EmployeeCreateRequest(BaseModel):
    company_id: uuid.UUID
    full_name: str = Field(..., min_length=2, max_length=255)
    cpf: str = Field(..., pattern=r"^\d{11}$", description="CPF sem formatação")
    email: EmailStr
    pis: str | None = Field(None, pattern=r"^\d{11}$")
    registration_number: str | None = None
    role: EmployeeRole = EmployeeRole.EMPLOYEE
    department: str | None = None
    work_schedule_id: uuid.UUID | None = None
    hired_at: date | None = None
    password: str = Field(..., min_length=8)


class EmployeeUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None
    role: EmployeeRole | None = None
    department: str | None = None
    work_schedule_id: uuid.UUID | None = None
    is_active: bool | None = None


class EmployeeResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    full_name: str
    email: str
    role: EmployeeRole
    department: str | None
    registration_number: str | None
    is_active: bool
    hired_at: date | None
    created_at: datetime
    has_face: bool = False

    model_config = {"from_attributes": True}


class EmployeeListResponse(BaseModel):
    items: list[EmployeeResponse]
    total: int
    page: int
    page_size: int
