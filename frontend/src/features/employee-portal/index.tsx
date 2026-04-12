import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { AttendanceTab } from "./components/AttendanceTab";
import { HourBankTab } from "./components/HourBankTab";
import { JustificationsTab } from "./components/JustificationsTab";
import { PerfilTab } from "./components/PerfilTab";

type Tab = "attendance" | "hour-bank" | "justifications" | "profile";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "attendance",
    label: "Registros",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    id: "hour-bank",
    label: "Banco de Horas",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    id: "justifications",
    label: "Justificativas",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Meu Perfil",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
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
    return <Navigate to="/login" replace />;
  }

  const isAdmin = ["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(employee.role);
  const initials = employee.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-primary-500 via-primary-600 to-indigo-600" />

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">PontoFácil</h1>
              <p className="text-[11px] text-gray-400 leading-tight">Portal do Funcionário</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
                </svg>
                Admin
              </button>
            )}

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{employee.fullName}</p>
                <p className="text-[11px] text-gray-400 leading-tight">{ROLE_LABELS[employee.role] ?? employee.role}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4">
          <nav className="flex overflow-x-auto scrollbar-hide gap-0" aria-label="Abas">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition-all focus:outline-none whitespace-nowrap
                  ${activeTab === tab.id
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }
                `}
              >
                <span className={`transition-colors ${activeTab === tab.id ? "text-primary-600" : "text-gray-400 group-hover:text-gray-500"}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Conteúdo */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "hour-bank" && <HourBankTab />}
        {activeTab === "justifications" && <JustificationsTab />}
        {activeTab === "profile" && <PerfilTab />}
      </main>
    </div>
  );
}
