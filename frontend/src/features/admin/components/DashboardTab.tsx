import { useAdminStats } from "../hooks/useAdminStats";

export function DashboardTab() {
  const { data, isLoading, isError, refetch } = useAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Visão Geral</h2>
        <button
          onClick={() => void refetch()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Atualizar
        </button>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          Erro ao carregar estatísticas.
        </div>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Funcionários ativos"
          value={data?.active_employees}
          sub={`${data?.total_employees ?? "—"} total`}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          label="Biometria cadastrada"
          value={data?.employees_with_face}
          sub={
            data
              ? `${Math.round((data.employees_with_face / Math.max(data.total_employees, 1)) * 100)}% dos funcionários`
              : undefined
          }
          color="green"
          loading={isLoading}
        />
        <StatCard
          label="Registros hoje"
          value={data?.today_registrations}
          sub={
            data
              ? `${data.today_employees_present} ${data.today_employees_present === 1 ? "funcionário presente" : "funcionários presentes"}`
              : undefined
          }
          color="indigo"
          loading={isLoading}
        />
        <StatCard
          label="Justificativas pendentes"
          value={data?.pending_justifications}
          color={data?.pending_justifications ? "amber" : "gray"}
          loading={isLoading}
        />
      </div>

      {/* Alerta de justificativas */}
      {data && data.pending_justifications > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="mt-0.5 text-amber-500">⚠</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {data.pending_justifications}{" "}
              {data.pending_justifications === 1
                ? "justificativa aguarda revisão"
                : "justificativas aguardam revisão"}
            </p>
            <p className="text-xs text-amber-600">Acesse a aba Justificativas para aprovar ou rejeitar.</p>
          </div>
        </div>
      )}

      {/* Indicador de biometria incompleta */}
      {data && data.active_employees > 0 && data.employees_with_face < data.active_employees && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-200">
          <span className="mt-0.5 text-blue-500">ℹ</span>
          <div>
            <p className="text-sm font-medium text-blue-800">
              {data.active_employees - data.employees_with_face}{" "}
              {data.active_employees - data.employees_with_face === 1
                ? "funcionário sem biometria"
                : "funcionários sem biometria cadastrada"}
            </p>
            <p className="text-xs text-blue-600">Acesse Funcionários para cadastrar o reconhecimento facial.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- StatCard ----------------------------------------------------------------

type Color = "blue" | "green" | "indigo" | "amber" | "gray";

const COLOR_CLASSES: Record<Color, { bg: string; text: string; sub: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", sub: "text-blue-500" },
  green: { bg: "bg-green-50", text: "text-green-700", sub: "text-green-500" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", sub: "text-indigo-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", sub: "text-amber-500" },
  gray: { bg: "bg-gray-50", text: "text-gray-700", sub: "text-gray-400" },
};

function StatCard({
  label,
  value,
  sub,
  color,
  loading,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  color: Color;
  loading: boolean;
}) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`rounded-xl p-5 ${cls.bg}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className={`mt-1 text-3xl font-bold tabular-nums ${cls.text}`}>
          {value ?? "—"}
        </p>
      )}
      {sub && !loading && (
        <p className={`mt-1 text-xs ${cls.sub}`}>{sub}</p>
      )}
    </div>
  );
}
