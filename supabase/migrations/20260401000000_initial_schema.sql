-- Migração inicial — Sistema de Ponto Eletrônico
-- Aplicada em: 2026-04-01
-- Conformidade: Portaria 671/2021 (MTE) e LGPD

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMs
CREATE TYPE employee_role AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE record_type AS ENUM ('IN', 'OUT');
CREATE TYPE schedule_type AS ENUM ('FIXED', 'VARIABLE', 'SCALE_12_36', 'SCALE_24_48');
CREATE TYPE justification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE justification_type AS ENUM ('MANUAL_ADJUSTMENT', 'MEDICAL_CERTIFICATE', 'ABSENCE', 'OTHER');

-- companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    auth_user_id UUID UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    cpf_hash VARCHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    pis VARCHAR(14),
    registration_number VARCHAR(50),
    role employee_role NOT NULL DEFAULT 'EMPLOYEE',
    department VARCHAR(100),
    work_schedule_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    hired_at DATE,
    terminated_at DATE,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_cpf_hash ON employees(cpf_hash);

-- employee_consents (LGPD)
CREATE TABLE employee_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    term_version VARCHAR(20) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_consents_employee ON employee_consents(employee_id);

-- facial_embeddings (LGPD — AES-256-GCM)
CREATE TABLE facial_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    embedding_encrypted TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    model_name VARCHAR(50) NOT NULL,
    enrolled_by UUID NOT NULL REFERENCES employees(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_facial_employee ON facial_embeddings(employee_id);

-- authorized_devices
CREATE TABLE authorized_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    device_fingerprint TEXT,
    label VARCHAR(100) NOT NULL,
    ip_ranges TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_device_token_hash_active ON authorized_devices(token_hash) WHERE is_active = true;
CREATE INDEX idx_devices_company ON authorized_devices(company_id);

-- work_schedules
CREATE TABLE work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    schedule_type schedule_type NOT NULL,
    daily_hours NUMERIC(4,2) NOT NULL,
    weekly_hours NUMERIC(5,2) NOT NULL,
    work_days INTEGER[],
    entry_time TIME,
    exit_time TIME,
    lunch_start TIME,
    lunch_end TIME,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees
    ADD CONSTRAINT fk_employees_work_schedule
    FOREIGN KEY (work_schedule_id) REFERENCES work_schedules(id);

-- schedule_exceptions
CREATE TABLE schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    is_day_off BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES employees(id)
);

-- attendance_records (IMUTÁVEL após insert — Portaria 671)
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    device_id UUID NOT NULL REFERENCES authorized_devices(id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ NOT NULL,
    record_type record_type NOT NULL,
    facial_confidence NUMERIC(5,4) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    audit_photo_path TEXT,
    is_adjustment BOOLEAN NOT NULL DEFAULT false,
    original_record_id UUID REFERENCES attendance_records(id),
    adjustment_reason TEXT,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_employee_recorded_at ON attendance_records(employee_id, recorded_at);
CREATE INDEX idx_attendance_recorded_at ON attendance_records(recorded_at);

-- Trigger: bloqueia UPDATE/DELETE (imutabilidade legal)
CREATE OR REPLACE FUNCTION prevent_attendance_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'attendance_records é imutável. Use is_adjustment=true com original_record_id.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_no_update
BEFORE UPDATE OR DELETE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION prevent_attendance_mutation();

-- hour_bank_entries
CREATE TABLE hour_bank_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reference_date DATE NOT NULL,
    worked_minutes INTEGER NOT NULL,
    expected_minutes INTEGER NOT NULL,
    balance_minutes INTEGER NOT NULL,
    extra_minutes_50pct INTEGER NOT NULL DEFAULT 0,
    extra_minutes_100pct INTEGER NOT NULL DEFAULT 0,
    intrajornada_discounted INTEGER NOT NULL DEFAULT 0,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hour_bank_entries_employee_date ON hour_bank_entries(employee_id, reference_date);

-- hour_bank_balance
CREATE TABLE hour_bank_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    balance_minutes INTEGER NOT NULL,
    expires_at DATE,
    alerted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hour_bank_balance_employee_period ON hour_bank_balance(employee_id, period_start, period_end);

-- justifications
CREATE TABLE justifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_record_id UUID REFERENCES attendance_records(id),
    justification_type justification_type NOT NULL,
    reference_date DATE NOT NULL,
    description TEXT NOT NULL,
    attachment_path TEXT,
    status justification_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES employees(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- device_access_log
CREATE TABLE device_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID,
    token_hash_attempted VARCHAR(64),
    ip_address VARCHAR(45) NOT NULL,
    was_authorized BOOLEAN NOT NULL,
    reject_reason VARCHAR(100),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_access_log_device ON device_access_log(device_id);
CREATE INDEX idx_device_access_log_attempted_at ON device_access_log(attempted_at);

-- audit_log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    ip_address VARCHAR(45),
    device_id UUID,
    request_id VARCHAR(36),
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- RLS: habilitar em todas as tabelas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE facial_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies: funcionário autenticado lê apenas seus próprios dados
CREATE POLICY "funcionario_le_proprio_ponto"
ON attendance_records FOR SELECT TO authenticated
USING (employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

CREATE POLICY "funcionario_le_proprio_banco_horas"
ON hour_bank_entries FOR SELECT TO authenticated
USING (employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

CREATE POLICY "funcionario_le_proprio_saldo"
ON hour_bank_balance FOR SELECT TO authenticated
USING (employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

CREATE POLICY "funcionario_le_proprias_justificativas"
ON justifications FOR SELECT TO authenticated
USING (employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

CREATE POLICY "funcionario_le_proprio_perfil"
ON employees FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "funcionario_le_proprio_consentimento"
ON employee_consents FOR SELECT TO authenticated
USING (employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid()));
