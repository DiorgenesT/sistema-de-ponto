"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-31

Schema completo do sistema de ponto:
- companies, employees, employee_consents
- facial_embeddings
- work_schedules, schedule_exceptions
- attendance_records (IMUTÁVEL após insert)
- hour_bank_entries, hour_bank_balance
- justifications
- authorized_devices, device_access_log
- audit_log
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- Extensões ---------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ---- ENUMs -------------------------------------------------------------
    op.execute("""
        CREATE TYPE employee_role AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN')
    """)
    op.execute("""
        CREATE TYPE record_type AS ENUM ('IN', 'OUT')
    """)
    op.execute("""
        CREATE TYPE schedule_type AS ENUM ('FIXED', 'VARIABLE', 'SCALE_12_36', 'SCALE_24_48')
    """)
    op.execute("""
        CREATE TYPE justification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED')
    """)
    op.execute("""
        CREATE TYPE justification_type AS ENUM ('MANUAL_ADJUSTMENT', 'MEDICAL_CERTIFICATE', 'ABSENCE', 'OTHER')
    """)

    # ---- companies ---------------------------------------------------------
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("cnpj", sa.String(18), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # ---- employees ---------------------------------------------------------
    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=True, unique=True),  # Supabase Auth UID
        # Dados pessoais (criptografados via Supabase Vault em produção)
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("cpf_hash", sa.String(64), nullable=False),          # SHA-256 — nunca CPF em plain text
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("pis", sa.String(14), nullable=True),                 # PIS/PASEP para AFD
        sa.Column("registration_number", sa.String(50), nullable=True), # matrícula
        sa.Column("role", postgresql.ENUM("EMPLOYEE", "MANAGER", "ADMIN", "SUPER_ADMIN", name="employee_role", create_type=False), nullable=False, server_default="EMPLOYEE"),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("work_schedule_id", postgresql.UUID(as_uuid=True), nullable=True),  # FK adicionada depois
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("hired_at", sa.Date(), nullable=True),
        sa.Column("terminated_at", sa.Date(), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),      # login local (fallback)
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("idx_employees_company", "employees", ["company_id"])
    op.create_index("idx_employees_cpf_hash", "employees", ["cpf_hash"])

    # ---- employee_consents (LGPD) ------------------------------------------
    op.create_table(
        "employee_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("term_version", sa.String(20), nullable=False),        # ex: "1.0.0"
        sa.Column("granted_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("idx_consents_employee", "employee_consents", ["employee_id"])

    # ---- facial_embeddings (LGPD — AES-256-GCM) ----------------------------
    op.create_table(
        "facial_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("embedding_encrypted", sa.Text(), nullable=False),    # AES-256-GCM base64
        sa.Column("iv", sa.String(32), nullable=False),                 # nonce GCM
        sa.Column("model_name", sa.String(50), nullable=False),         # ex: "ArcFace", "DeepFace"
        sa.Column("enrolled_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("enrolled_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        # Dados biométricos NUNCA trafegam em logs — ver CLAUDE.md
    )
    op.create_index("idx_facial_employee", "facial_embeddings", ["employee_id"])

    # ---- authorized_devices ------------------------------------------------
    op.create_table(
        "authorized_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),          # SHA-256 do device token
        sa.Column("device_fingerprint", sa.Text(), nullable=True),       # canvas + UA fingerprint
        sa.Column("label", sa.String(100), nullable=False),              # ex: "Recepção - PC 01"
        sa.Column("ip_ranges", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),  # CIDRs autorizados
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_device_token_hash_active",
        "authorized_devices",
        ["token_hash"],
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_index("idx_devices_company", "authorized_devices", ["company_id"])

    # ---- work_schedules ----------------------------------------------------
    op.create_table(
        "work_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("schedule_type", postgresql.ENUM("FIXED", "VARIABLE", "SCALE_12_36", "SCALE_24_48", name="schedule_type", create_type=False), nullable=False),
        sa.Column("daily_hours", sa.Numeric(4, 2), nullable=False),      # ex: 8.00
        sa.Column("weekly_hours", sa.Numeric(5, 2), nullable=False),     # ex: 44.00
        sa.Column("work_days", postgresql.ARRAY(sa.Integer()), nullable=True),  # [1,2,3,4,5] = seg-sex
        sa.Column("entry_time", sa.Time(), nullable=True),
        sa.Column("exit_time", sa.Time(), nullable=True),
        sa.Column("lunch_start", sa.Time(), nullable=True),
        sa.Column("lunch_end", sa.Time(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # FK de employees para work_schedules (após criar a tabela)
    op.create_foreign_key(
        "fk_employees_work_schedule",
        "employees", "work_schedules",
        ["work_schedule_id"], ["id"],
    )

    # ---- schedule_exceptions -----------------------------------------------
    op.create_table(
        "schedule_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=True),  # NULL = vale para toda empresa
        sa.Column("exception_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),        # ex: "Feriado Nacional"
        sa.Column("is_holiday", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_day_off", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
    )

    # ---- attendance_records (IMUTÁVEL após insert — Portaria 671) ----------
    op.create_table(
        "attendance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("authorized_devices.id", ondelete="RESTRICT"), nullable=False),
        # Timestamp NTP — NUNCA datetime.now() ou timestamp do cliente
        sa.Column("recorded_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("record_type", postgresql.ENUM("IN", "OUT", name="record_type", create_type=False), nullable=False),
        sa.Column("facial_confidence", sa.Numeric(5, 4), nullable=False),  # 0.0000 – 1.0000
        sa.Column("ip_address", sa.String(45), nullable=False),
        # Auditoria de foto (URL assinada gerada on-demand — não armazenada)
        sa.Column("audit_photo_path", sa.Text(), nullable=True),         # path no Supabase Storage
        # Campos de ajuste (imutabilidade via novo registro)
        sa.Column("is_adjustment", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("original_record_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attendance_records.id"), nullable=True),
        sa.Column("adjustment_reason", sa.Text(), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("approved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        # Metadados imutáveis
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index(
        "idx_attendance_employee_date",
        "attendance_records",
        ["employee_id", sa.text("DATE(recorded_at)")],
    )
    op.create_index("idx_attendance_recorded_at", "attendance_records", ["recorded_at"])

    # Trigger para BLOQUEAR UPDATE/DELETE em attendance_records
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_attendance_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'attendance_records é imutável. Use is_adjustment=true com original_record_id.';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_attendance_no_update
        BEFORE UPDATE OR DELETE ON attendance_records
        FOR EACH ROW EXECUTE FUNCTION prevent_attendance_mutation();
    """)

    # ---- hour_bank_entries -------------------------------------------------
    op.create_table(
        "hour_bank_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference_date", sa.Date(), nullable=False),
        sa.Column("worked_minutes", sa.Integer(), nullable=False),       # minutos efetivamente trabalhados
        sa.Column("expected_minutes", sa.Integer(), nullable=False),     # minutos esperados pela escala
        sa.Column("balance_minutes", sa.Integer(), nullable=False),      # worked - expected (negativo = débito)
        sa.Column("extra_minutes_50pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("extra_minutes_100pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("intrajornada_discounted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_holiday", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("calculated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_hour_bank_entries_employee_date", "hour_bank_entries", ["employee_id", "reference_date"])

    # ---- hour_bank_balance -------------------------------------------------
    op.create_table(
        "hour_bank_balance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("balance_minutes", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=True),               # 6 meses — Portaria 671
        sa.Column("alerted_at", sa.TIMESTAMP(timezone=True), nullable=True),  # quando gestor foi alertado
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index(
        "idx_hour_bank_balance_employee_period",
        "hour_bank_balance",
        ["employee_id", "period_start", "period_end"],
    )

    # ---- justifications (ajustes / atestados) ------------------------------
    op.create_table(
        "justifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attendance_record_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attendance_records.id"), nullable=True),
        sa.Column("justification_type", postgresql.ENUM("MANUAL_ADJUSTMENT", "MEDICAL_CERTIFICATE", "ABSENCE", "OTHER", name="justification_type", create_type=False), nullable=False),
        sa.Column("reference_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("attachment_path", sa.Text(), nullable=True),          # path no Supabase Storage
        sa.Column("status", postgresql.ENUM("PENDING", "APPROVED", "REJECTED", name="justification_status", create_type=False), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ---- device_access_log -------------------------------------------------
    op.create_table(
        "device_access_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),   # NULL se token inválido
        sa.Column("token_hash_attempted", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("was_authorized", sa.Boolean(), nullable=False),
        sa.Column("reject_reason", sa.String(100), nullable=True),
        sa.Column("attempted_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_device_access_log_device", "device_access_log", ["device_id"])
    op.create_index("idx_device_access_log_attempted_at", "device_access_log", ["attempted_at"])

    # ---- audit_log ---------------------------------------------------------
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),    # quem fez (NULL = sistema)
        sa.Column("action", sa.String(100), nullable=False),                    # ex: "employee.created"
        sa.Column("resource_type", sa.String(50), nullable=False),              # ex: "employee"
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", sa.String(36), nullable=True),
        sa.Column("changes", postgresql.JSONB(), nullable=True),                # diff antes/depois
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_audit_log_actor", "audit_log", ["actor_id"])
    op.create_index("idx_audit_log_resource", "audit_log", ["resource_type", "resource_id"])
    op.create_index("idx_audit_log_created_at", "audit_log", ["created_at"])


def downgrade() -> None:
    # Remover trigger antes das tabelas
    op.execute("DROP TRIGGER IF EXISTS trg_attendance_no_update ON attendance_records")
    op.execute("DROP FUNCTION IF EXISTS prevent_attendance_mutation()")

    # Remover FK circular antes das tabelas
    op.drop_constraint("fk_employees_work_schedule", "employees", type_="foreignkey")

    for table in [
        "audit_log",
        "device_access_log",
        "justifications",
        "hour_bank_balance",
        "hour_bank_entries",
        "attendance_records",
        "schedule_exceptions",
        "work_schedules",
        "authorized_devices",
        "facial_embeddings",
        "employee_consents",
        "employees",
        "companies",
    ]:
        op.drop_table(table)

    for enum in ["justification_status", "justification_type", "schedule_type", "record_type", "employee_role"]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")
