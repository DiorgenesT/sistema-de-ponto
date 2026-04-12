import { api } from "@/shared/lib/api";

export interface ValidatedEmployee {
  employee_id: string;
  full_name: string;
}

export async function validateTerminalCode(code: string): Promise<ValidatedEmployee> {
  const { data } = await api.get<ValidatedEmployee>("/attendance/validate-code", {
    params: { code },
  });
  return data;
}
