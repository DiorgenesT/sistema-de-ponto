import { useAdminStats } from "../hooks/useAdminStats";

export function DashboardTab() {
  const { data, isLoading, isError, refetch } = useAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Visão Geral</h2>
          <p className="mt-0.5 text-xs text-gray-500">Resumo das atividades da empresa</p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Atualizar
        </button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Erro ao carregar estatísticas.
        </div>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Funcionários ativos"
          value={data?.active_employees}
          sub={data ? `${data.total_employees} no total` : undefined}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          }
          color="blue"
          loading={isLoading}
        />
        <StatCard
          label="Com biometria"
          value={data?.employees_with_face}
          sub={
            data
              ? `${Math.round((data.employees_with_face / Math.max(data.total_employees, 1)) * 100)}% dos funcionários`
              : undefined
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
            </svg>
          }
          color="green"
          loading={isLoading}
        />
        <StatCard
          label="Registros hoje"
          value={data?.today_registrations}
          sub={
            data
              ? `${data.today_employees_present} ${data.today_employees_present === 1 ? "presente" : "presentes"}`
              : undefined
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          color="indigo"
          loading={isLoading}
        />
        <StatCard
          label="Justificativas"
          value={data?.pending_justifications}
          sub={data?.pending_justifications ? "aguardando revisão" : "nenhuma pendente"}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          }
          color={data?.pending_justifications ? "amber" : "gray"}
          loading={isLoading}
        />
      </div>

      {/* Alertas */}
      <div className="space-y-3">
        {data && data.pending_justifications > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {data.pending_justifications}{" "}
                {data.pending_justifications === 1
                  ? "justificativa aguarda revisão"
                  : "justificativas aguardam revisão"}
              </p>
              <p className="mt-0.5 text-xs text-amber-600">Acesse a aba Justificativas para aprovar ou rejeitar.</p>
            </div>
          </div>
        )}

        {data && data.active_employees > 0 && data.employees_with_face < data.active_employees && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {data.active_employees - data.employees_with_face}{" "}
                {data.active_employees - data.employees_with_face === 1
                  ? "funcionário sem biometria cadastrada"
                  : "funcionários sem biometria cadastrada"}
              </p>
              <p className="mt-0.5 text-xs text-blue-600">Acesse Funcionários para cadastrar o reconhecimento facial.</p>
            </div>
          </div>
        )}

        {data && !data.pending_justifications && data.employees_with_face >= data.active_employees && data.active_employees > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Tudo em ordem</p>
              <p className="mt-0.5 text-xs text-green-600">Não há pendências. Todos os funcionários estão com biometria cadastrada.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- StatCard ----------------------------------------------------------------

type Color = "blue" | "green" | "indigo" | "amber" | "gray";

const COLOR_MAP: Record<Color, { icon: string; value: string; sub: string; border: string }> = {
  blue: {
    icon: "bg-blue-100 text-blue-600",
    value: "text-blue-700",
    sub: "text-blue-500",
    border: "border-blue-100",
  },
  green: {
    icon: "bg-green-100 text-green-600",
    value: "text-green-700",
    sub: "text-green-500",
    border: "border-green-100",
  },
  indigo: {
    icon: "bg-indigo-100 text-indigo-600",
    value: "text-indigo-700",
    sub: "text-indigo-500",
    border: "border-indigo-100",
  },
  amber: {
    icon: "bg-amber-100 text-amber-600",
    value: "text-amber-700",
    sub: "text-amber-500",
    border: "border-amber-100",
  },
  gray: {
    icon: "bg-gray-100 text-gray-500",
    value: "text-gray-700",
    sub: "text-gray-400",
    border: "border-gray-100",
  },
};

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  loading,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  icon: React.ReactNode;
  color: Color;
  loading: boolean;
}) {
  const cls = COLOR_MAP[color];
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${cls.border}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cls.icon}`}>
          {icon}
        </div>
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
        </div>
      ) : (
        <div className="mt-3">
          <p className={`text-3xl font-bold tabular-nums ${cls.value}`}>
            {value ?? "—"}
          </p>
          <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
          {sub && (
            <p className={`mt-1 text-xs ${cls.sub}`}>{sub}</p>
          )}
        </div>
      )}
    </div>
  );
}
