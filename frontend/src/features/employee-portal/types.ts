export type RecordType = "IN" | "OUT";

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  device_id: string;
  recorded_at: string;
  record_type: RecordType;
  facial_confidence: number;
  is_adjustment: boolean;
  original_record_id: string | null;
  created_at: string;
}

export interface AttendanceListResponse {
  items: AttendanceRecord[];
  total: number;
}

export interface HourBankEntry {
  id: string;
  reference_date: string;
  worked_minutes: number;
  expected_minutes: number;
  balance_minutes: number;
  extra_minutes_50pct: number;
  extra_minutes_100pct: number;
  intrajornada_discounted: number;
  is_holiday: boolean;
  calculated_at: string;
}

export interface HourBankBalance {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  balance_minutes: number;
  balance_hours: number;
  expires_at: string | null;
  updated_at: string;
}

export interface HourBankSummary {
  employee_id: string;
  total_balance_minutes: number;
  total_balance_hours: number;
  entries: HourBankEntry[];
  balances: HourBankBalance[];
}

export type JustificationType =
  | "MANUAL_ADJUSTMENT"
  | "MEDICAL_CERTIFICATE"
  | "ABSENCE"
  | "OTHER";

export type JustificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Justification {
  id: string;
  employee_id: string;
  attendance_record_id: string | null;
  justification_type: JustificationType;
  reference_date: string;
  description: string;
  status: JustificationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface JustificationCreatePayload {
  attendance_record_id?: string;
  justification_type: JustificationType;
  reference_date: string;
  description: string;
}
