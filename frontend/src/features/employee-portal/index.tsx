import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { AttendanceTab } from "./components/AttendanceTab";
import { HourBankTab } from "./components/HourBankTab";
import { JustificationsTab } from "./components/JustificationsTab";

type Tab = "attendance" | "hour-bank" | "justifications";

const TABS: { id: Tab; label: string }[] = [
  { id: "attendance", label: "Registros de Ponto" },
  { id: "hour-bank", label: "Banco de Horas" },
  { id: "justifications", label: "Justificativas" },
];

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Funcionário",
  MANAGER: "Gestor",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Admin",
};

export default function EmployeePortalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("attendance");
  const navigate = useNavigate();
  const { employee, logout } = useAuthStore();

  if (!employee) {
    navigate("/login", { replace: true });
    return null;
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">Sistema de Ponto</h1>
              <p className="text-xs text-gray-500">Portal do Funcionário</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{employee.fullName}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[employee.role] ?? employee.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4">
          <nav className="flex gap-0" aria-label="Abas">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  border-b-2 px-5 py-3.5 text-sm font-medium transition-colors focus:outline-none
                  ${activeTab === tab.id
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Conteúdo */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "hour-bank" && <HourBankTab />}
        {activeTab === "justifications" && <JustificationsTab />}
      </main>
    </div>
  );
}
