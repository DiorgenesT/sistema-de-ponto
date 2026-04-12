import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMyProfile, useMyFaceStatus, useDeleteMyFace } from "../hooks/useMyProfile";

export function PerfilTab() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: faceStatus, isLoading: faceLoading } = useMyFaceStatus();
  const deleteFaceMutation = useDeleteMyFace();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  async function handleDeleteFace() {
    await deleteFaceMutation.mutateAsync();
    setConfirmDelete(false);
    setDeleteSuccess(true);
  }

  const isLoading = profileLoading || faceLoading;

  return (
    <div className="space-y-6">
      {/* Dados pessoais */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Seus dados</h2>
        </div>
        <div className="px-6 py-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DataField label="Nome completo" value={profile?.full_name} />
              <DataField label="E-mail" value={profile?.email} />
              <DataField label="Departamento" value={profile?.department ?? "—"} />
              <DataField label="Perfil de acesso" value={profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : "—"} />
              <DataField
                label="Código do terminal"
                value={
                  profile?.terminal_code ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-gray-100 px-3 py-1 font-mono text-lg font-bold tracking-widest text-gray-900">
                        {profile.terminal_code}
                      </span>
                      <span className="text-xs text-gray-400">Informe este código ao registrar ponto</span>
                    </div>
                  ) : (
                    "Não atribuído"
                  )
                }
              />
              <DataField
                label="Cadastrado em"
                value={
                  profile?.created_at
                    ? format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })
                    : "—"
                }
              />
            </dl>
          )}
        </div>
      </section>

      {/* Biometria */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Reconhecimento facial</h2>
        </div>
        <div className="px-6 py-5">
          {faceLoading ? (
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          ) : deleteSuccess ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
              <span className="text-green-500">✓</span>
              <p className="text-sm font-medium text-green-800">
                Dados biométricos excluídos com sucesso.
              </p>
            </div>
          ) : faceStatus?.enrolled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {faceStatus.photo_b64 ? (
                  <img
                    src={`data:image/jpeg;base64,${faceStatus.photo_b64}`}
                    alt="Foto de cadastro facial"
                    className="h-16 w-16 rounded-xl object-cover ring-2 ring-green-200"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-100 text-2xl text-green-600">
                    ✓
                  </span>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">Biometria cadastrada</p>
                  {faceStatus.enrolled_at && (
                    <p className="text-xs text-gray-500">
                      Cadastrada em{" "}
                      {format(new Date(faceStatus.enrolled_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Exclusão LGPD */}
              {!confirmDelete ? (
                <div className="rounded-xl bg-gray-50 px-4 py-4">
                  <p className="text-xs text-gray-600">
                    Conforme o <strong>Art. 18 da LGPD</strong>, você pode solicitar a exclusão dos seus
                    dados biométricos. Após a exclusão, não será possível registrar ponto até que a
                    biometria seja recadastrada pelo administrador.
                  </p>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Solicitar exclusão dos dados biométricos
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-red-50 px-4 py-4 ring-1 ring-red-200">
                  <p className="text-sm font-medium text-red-800">Confirmar exclusão?</p>
                  <p className="mt-1 text-xs text-red-600">
                    Esta ação é irreversível. Após excluir, você precisará recadastrar a biometria com
                    o administrador para continuar registrando ponto.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void handleDeleteFace()}
                      disabled={deleteFaceMutation.isPending}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleteFaceMutation.isPending && (
                        <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      )}
                      Sim, excluir minha biometria
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                —
              </span>
              <div>
                <p className="text-sm text-gray-600">Sem biometria cadastrada</p>
                <p className="text-xs text-gray-400">
                  Solicite ao administrador o cadastro do reconhecimento facial.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Aviso LGPD */}
      <section className="rounded-xl bg-blue-50 px-5 py-4 ring-1 ring-blue-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Aviso de privacidade — LGPD
        </p>
        <p className="mt-2 text-xs text-blue-700 leading-relaxed">
          Seus dados biométricos são utilizados exclusivamente para verificação de identidade no
          registro de ponto, conforme consentimento obtido no cadastro. Os dados são armazenados
          com criptografia AES-256 e não são compartilhados com terceiros. Você pode solicitar
          a exclusão a qualquer momento pelo botão acima.
        </p>
      </section>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Funcionário",
  MANAGER: "Gestor",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Admin",
};

function DataField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">{value ?? "—"}</dd>
    </div>
  );
}
