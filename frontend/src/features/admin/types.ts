export type EmployeeRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";

export interface Employee {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: EmployeeRole;
  department: string | null;
  registration_number: string | null;
  is_active: boolean;
  hired_at: string | null;
  created_at: string;
  has_face: boolean;
  terminal_code: string | null;
}

export interface AdminStats {
  total_employees: number;
  active_employees: number;
  employees_with_face: number;
  today_registrations: number;
  today_employees_present: number;
  pending_justifications: number;
}

export interface AdminAttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string | null;
  device_id: string;
  recorded_at: string;
  record_type: "IN" | "OUT";
  facial_confidence: number;
  is_adjustment: boolean;
  original_record_id: string | null;
  created_at: string;
}

export interface AdminAttendanceListResponse {
  items: AdminAttendanceRecord[];
  total: number;
}

export interface FaceStatus {
  enrolled: boolean;
  enrolled_at?: string;
  photo_b64?: string | null;
}

export interface EmployeeListResponse {
  items: Employee[];
  total: number;
  page: number;
  page_size: number;
}

export interface EmployeeCreatePayload {
  company_id: string;
  full_name: string;
  cpf: string;
  email: string;
  pis?: string;
  registration_number?: string;
  role: EmployeeRole;
  department?: string;
  hired_at?: string;
  password: string;
}

export interface Device {
  id: string;
  company_id: string;
  label: string;
  ip_ranges: string[];
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface DeviceOnboardResponse {
  device: Device;
  token: string;
}

export interface DeviceCreatePayload {
  company_id: string;
  label: string;
  ip_ranges: string[];
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
