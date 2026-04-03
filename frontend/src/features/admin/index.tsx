import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { FuncionariosTab } from "./components/FuncionariosTab";
import { DispositivosTab } from "./components/DispositivosTab";
import { JustificativasTab } from "./components/JustificativasTab";
import { RelatoriosTab } from "./components/RelatoriosTab";

type Tab = "employees" | "devices" | "justifications" | "reports";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Funcionário",
  MANAGER: "Gestor",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Admin",
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { employee, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("employees");

  if (!employee) {
    return <Navigate to="/login" replace />;
  }

  const isPrivileged = ["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(employee.role);
  if (!isPrivileged) {
    return <Navigate to="/portal" replace />;
  }

  const TABS: { id: Tab; label: string; roles: string[] }[] = [
    { id: "employees", label: "Funcionários", roles: ["MANAGER", "ADMIN", "SUPER_ADMIN"] },
    { id: "devices", label: "Dispositivos", roles: ["ADMIN", "SUPER_ADMIN"] },
    { id: "justifications", label: "Justificativas", roles: ["MANAGER", "ADMIN", "SUPER_ADMIN"] },
    { id: "reports", label: "Relatórios", roles: ["SUPER_ADMIN"] },
  ];

  const visibleTabs = TABS.filter((t) => t.roles.includes(employee.role));

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
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
                  d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">Sistema de Ponto</h1>
              <p className="text-xs text-gray-500">Painel Administrativo</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/portal")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Portal do funcionário
            </button>
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
        <div className="mx-auto max-w-6xl px-4">
          <nav className="flex gap-0" aria-label="Abas do painel">
            {visibleTabs.map((tab) => (
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
      <main className="mx-auto max-w-6xl px-4 py-6">
        {activeTab === "employees" && <FuncionariosTab />}
        {activeTab === "devices" && <DispositivosTab />}
        {activeTab === "justifications" && <JustificativasTab />}
        {activeTab === "reports" && <RelatoriosTab />}
      </main>
    </div>
  );
}
