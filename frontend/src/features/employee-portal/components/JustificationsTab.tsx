import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/shared/lib/cn";
import { useMyJustifications, useCreateJustification } from "../hooks/useMyJustifications";
import type { Justification, JustificationType } from "../types";

const JUSTIFICATION_TYPE_LABELS: Record<JustificationType, string> = {
  MANUAL_ADJUSTMENT: "Ajuste manual",
  MEDICAL_CERTIFICATE: "Atestado médico",
  ABSENCE: "Falta justificada",
  OTHER: "Outro",
};

const STATUS_CONFIG = {
  PENDING: { label: "Pendente", classes: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "Aprovado", classes: "bg-green-50 text-green-700 ring-green-200" },
  REJECTED: { label: "Rejeitado", classes: "bg-red-50 text-red-700 ring-red-200" },
} as const;

const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const createSchema = z.object({
  justification_type: z.enum([
    "MANUAL_ADJUSTMENT",
    "MEDICAL_CERTIFICATE",
    "ABSENCE",
    "OTHER",
  ] as const),
  reference_date: z.string().min(1, "Data obrigatória"),
  description: z.string().min(10, "Mínimo 10 caracteres").max(1000, "Máximo 1000 caracteres"),
});

type CreateForm = z.infer<typeof createSchema>;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function JustificationsTab() {
  const [showForm, setShowForm] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useMyJustifications();
  const createMutation = useCreateJustification();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAttachmentError(null);
    if (!file) { setAttachment(null); return; }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setAttachmentError("Formato não suportado. Use JPG, PNG, WebP ou PDF.");
      setAttachment(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setAttachmentError(`Arquivo muito grande. Máximo ${MAX_FILE_SIZE_MB}MB.`);
      setAttachment(null);
      return;
    }
    setAttachment(file);
  }

  function handleCancel() {
    reset();
    setAttachment(null);
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(false);
  }

  async function onSubmit(formData: CreateForm) {
    let attachment_b64: string | undefined;
    if (attachment) {
      attachment_b64 = await fileToBase64(attachment);
    }
    await createMutation.mutateAsync({
      justification_type: formData.justification_type,
      reference_date: formData.reference_date,
      description: formData.description,
      attachment_b64,
    });
    reset();
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Solicite ajustes ou envie justificativas para aprovação do gestor.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            showForm
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
              : "bg-primary-600 text-white shadow-sm hover:bg-primary-700"
          )}
        >
          {showForm ? "Cancelar" : "+ Nova solicitação"}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-800">Nova solicitação</h3>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  {...register("justification_type")}
                  className={cn(
                    "block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                    errors.justification_type
                      ? "border-red-300 focus:ring-red-200"
                      : "border-gray-300 focus:ring-primary-200"
                  )}
                >
                  <option value="">Selecione o tipo</option>
                  {(Object.entries(JUSTIFICATION_TYPE_LABELS) as [JustificationType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    )
                  )}
                </select>
                {errors.justification_type && (
                  <p className="mt-1 text-xs text-red-600">{errors.justification_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de referência</label>
                <input
                  type="date"
                  {...register("reference_date")}
                  className={cn(
                    "block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                    errors.reference_date
                      ? "border-red-300 focus:ring-red-200"
                      : "border-gray-300 focus:ring-primary-200"
                  )}
                />
                {errors.reference_date && (
                  <p className="mt-1 text-xs text-red-600">{errors.reference_date.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                rows={3}
                {...register("description")}
                placeholder="Descreva o motivo da solicitação..."
                className={cn(
                  "block w-full resize-none rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                  errors.description
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-primary-200"
                )}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Upload de anexo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anexo <span className="text-gray-400 font-normal">(opcional — atestado, comprovante)</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors",
                  attachmentError
                    ? "border-red-300 bg-red-50"
                    : attachment
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 hover:border-primary-300 hover:bg-primary-50/30"
                )}
              >
                {attachment ? (
                  <>
                    <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-green-800">{attachment.name}</p>
                      <p className="text-xs text-green-600">{(attachment.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="ml-auto text-green-600 hover:text-green-800"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600">Clique para anexar um arquivo</p>
                      <p className="text-xs text-gray-400">JPG, PNG, WebP ou PDF — máx. {MAX_FILE_SIZE_MB}MB</p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={handleFileChange}
              />
              {attachmentError && (
                <p className="mt-1 text-xs text-red-600">{attachmentError}</p>
              )}
            </div>

            {createMutation.isError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                Erro ao enviar solicitação. Tente novamente.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!attachmentError}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isSubmitting ? "Enviando…" : "Enviar solicitação"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-sm text-red-500">
            Erro ao carregar justificativas.
          </div>
        )}

        {data && data.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhuma solicitação enviada ainda.
          </div>
        )}

        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-[540px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Data ref.</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Anexo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((j) => (
                  <JustificationRow key={j.id} justification={j} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function JustificationRow({ justification: j }: { justification: Justification & { attachment_path?: string | null } }) {
  const refDate = new Date(j.reference_date + "T12:00:00");
  const createdAt = new Date(j.created_at);
  const statusCfg = STATUS_CONFIG[j.status];

  function handleDownloadAttachment() {
    if (!j.attachment_path) return;
    const link = document.createElement("a");
    link.href = j.attachment_path;
    const ext = j.attachment_path.startsWith("data:application/pdf") ? "pdf" : "jpg";
    link.download = `anexo_justificativa_${j.id.slice(0, 8)}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
        {format(refDate, "dd/MM/yyyy", { locale: ptBR })}
      </td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
        {JUSTIFICATION_TYPE_LABELS[j.justification_type]}
      </td>
      <td className="max-w-xs px-4 py-3">
        <p className="truncate text-gray-600">{j.description}</p>
        {j.review_notes && (
          <p className="mt-0.5 truncate text-xs text-gray-400">Obs: {j.review_notes}</p>
        )}
      </td>
      <td className="px-4 py-3">
        {j.attachment_path ? (
          <button
            onClick={handleDownloadAttachment}
            title="Baixar anexo"
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
            Ver
          </button>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusCfg.classes}`}>
          {statusCfg.label}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
        {format(createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}
      </td>
    </tr>
  );
}
