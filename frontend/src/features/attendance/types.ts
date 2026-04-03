export type RecordType = "IN" | "OUT";

export interface AttendanceResponse {
  id: string;
  employee_id: string;
  device_id: string;
  recorded_at: string;
  record_type: RecordType;
  facial_confidence: number;
  is_adjustment: boolean;
  original_record_id: string | null;
  created_at: string;
  employee_name: string | null;
}
