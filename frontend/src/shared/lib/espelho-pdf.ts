import { format, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface EspelhoPunch {
  recorded_at: string;   // ISO string
  record_type: "IN" | "OUT";
}

export interface EspelhoParams {
  companyName: string;
  companyCnpj: string;
  employeeName: string;
  employeeRegistration?: string;
  employeeDepartment?: string;
  year: number;
  month: number;          // 1–12
  punches: EspelhoPunch[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function minutesToHHMM(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs  = Math.abs(minutes);
  const h    = Math.floor(abs / 60);
  const m    = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES   = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ─── Gerador principal ────────────────────────────────────────────────────────

export function generateEspelhoHTML(params: EspelhoParams): string {
  const { companyName, companyCnpj, employeeName, employeeRegistration, employeeDepartment, year, month, punches } = params;

  // Agrupa marcações por dia
  const byDay: Record<number, EspelhoPunch[]> = {};
  for (const p of punches) {
    const d = new Date(p.recorded_at);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(p);
    }
  }

  const daysInMonth  = getDaysInMonth(new Date(year, month - 1, 1));
  const monthLabel   = `${MONTH_NAMES[month - 1]}/${year}`;

  let totalWorkedMin = 0;
  let totalDays      = 0;

  const rows: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date    = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();                     // 0=Dom, 6=Sab
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayStr  = String(day).padStart(2, "0");
    const weekday = WEEKDAY_SHORT[dayOfWeek];
    const dateFmt = `${dayStr}/${String(month).padStart(2, "0")}`;

    const dayPunches = (byDay[day] ?? []).sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );

    // Monta coluna de marcações
    let punchesHtml = "";
    const punchTimes: string[] = [];
    for (const p of dayPunches) {
      const t = format(new Date(p.recorded_at), "HH:mm");
      const isIn = p.record_type === "IN";
      punchTimes.push(
        `<span class="${isIn ? "punch-in" : "punch-out"}">${t}</span>`
      );
    }
    punchesHtml = punchTimes.join("<span class='punch-sep'>·</span>") || `<span class="no-punch">—</span>`;

    // Calcula trabalhado: primeira IN até última OUT
    const ins  = dayPunches.filter(p => p.record_type === "IN");
    const outs = dayPunches.filter(p => p.record_type === "OUT");
    let workedMin = 0;
    let workedStr = `<span class="no-punch">—</span>`;
    if (ins.length > 0 && outs.length > 0) {
      const firstIn  = new Date(ins[0].recorded_at).getTime();
      const lastOut  = new Date(outs[outs.length - 1].recorded_at).getTime();
      workedMin = Math.round((lastOut - firstIn) / 60000);
      if (workedMin > 0) {
        workedStr = minutesToHHMM(workedMin);
        totalWorkedMin += workedMin;
        totalDays++;
      }
    }

    const rowClass = isWeekend ? "weekend" : (dayPunches.length === 0 ? "no-record" : "");

    rows.push(`
      <tr class="${rowClass}">
        <td class="col-date">${dateFmt}</td>
        <td class="col-day">${weekday}</td>
        <td class="col-punches">${punchesHtml}</td>
        <td class="col-worked">${workedStr}</td>
        <td class="col-obs">${isWeekend ? "Folga" : ""}</td>
      </tr>
    `);
  }

  const totalWorkedStr = minutesToHHMM(totalWorkedMin);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Espelho de Ponto — ${employeeName} — ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #111;
      background: #fff;
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    /* Botão imprimir */
    .btn-print {
      position: fixed;
      top: 16px;
      right: 16px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
      z-index: 999;
    }
    .btn-print:hover { background: #4338ca; }

    /* Header */
    .doc-header {
      text-align: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #111;
      margin-bottom: 14px;
    }
    .company-name {
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .company-cnpj {
      font-size: 10px;
      color: #555;
      margin-top: 2px;
    }
    .report-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 8px;
      color: #2d2d2d;
    }
    .report-period {
      font-size: 11px;
      color: #555;
      margin-top: 3px;
    }

    /* Dados do funcionário */
    .employee-box {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 8px 16px;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      background: #fafafa;
    }
    .emp-field label {
      display: block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 2px;
    }
    .emp-field span {
      font-size: 11px;
      font-weight: 600;
      color: #111;
    }

    /* Tabela */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    thead tr {
      background: #1e293b;
      color: #fff;
    }
    th {
      padding: 7px 10px;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 5px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: center;
      vertical-align: middle;
    }
    tr:nth-child(even) td { background: #f9fafb; }

    .col-date  { width: 60px; font-weight: 600; }
    .col-day   { width: 40px; color: #555; }
    .col-punches { width: auto; }
    .col-worked { width: 70px; font-weight: 600; font-family: monospace; font-size: 12px; }
    .col-obs   { width: 80px; font-size: 10px; color: #888; }

    .punch-in   { color: #16a34a; font-weight: 600; font-family: monospace; }
    .punch-out  { color: #2563eb; font-weight: 600; font-family: monospace; }
    .punch-sep  { color: #d1d5db; margin: 0 4px; }
    .no-punch   { color: #d1d5db; }

    tr.weekend td { background: #fff7ed !important; color: #92400e; }
    tr.weekend .col-day { color: #b45309; font-weight: 600; }
    tr.no-record td { color: #9ca3af; }

    /* Total */
    .total-row td {
      background: #1e293b !important;
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 10px;
      border: none;
    }

    /* Nota */
    .note {
      font-size: 9px;
      color: #888;
      margin-bottom: 40px;
      font-style: italic;
    }

    /* Assinaturas */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 48px;
    }
    .sig-line {
      border-top: 1px solid #555;
      padding-top: 6px;
      text-align: center;
      font-size: 10px;
      color: #333;
    }
    .sig-label { font-weight: 600; }
    .sig-sub   { color: #888; margin-top: 2px; font-size: 9px; }

    /* Footer */
    .doc-footer {
      margin-top: 24px;
      text-align: center;
      font-size: 9px;
      color: #bbb;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }

    @media print {
      .btn-print { display: none; }
      body { padding: 10px; }
      @page { margin: 15mm 12mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>

  <!-- Cabeçalho -->
  <div class="doc-header">
    <div class="company-name">${companyName}</div>
    <div class="company-cnpj">CNPJ: ${formatCnpj(companyCnpj)}</div>
    <div class="report-title">Espelho de Ponto Mensal</div>
    <div class="report-period">${monthLabel}</div>
  </div>

  <!-- Dados do funcionário -->
  <div class="employee-box">
    <div class="emp-field">
      <label>Funcionário</label>
      <span>${employeeName}</span>
    </div>
    <div class="emp-field">
      <label>Matrícula</label>
      <span>${employeeRegistration ?? "—"}</span>
    </div>
    <div class="emp-field">
      <label>Departamento</label>
      <span>${employeeDepartment ?? "—"}</span>
    </div>
  </div>

  <!-- Tabela de marcações -->
  <table>
    <thead>
      <tr>
        <th class="col-date">Data</th>
        <th class="col-day">Dia</th>
        <th class="col-punches">Marcações</th>
        <th class="col-worked">Trabalhado</th>
        <th class="col-obs">Observação</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join("")}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2" style="text-align:left">TOTAL</td>
        <td>${totalDays} dia${totalDays !== 1 ? "s" : ""} trabalhado${totalDays !== 1 ? "s" : ""}</td>
        <td>${totalWorkedStr}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <p class="note">
    * Os horários apresentados são os registros do sistema de ponto eletrônico.
    Não há dedução automática de intervalo neste documento — o desconto do intrajornada é calculado separadamente no banco de horas.
  </p>

  <!-- Assinaturas -->
  <div class="signatures">
    <div class="sig-line">
      <div class="sig-label">${employeeName}</div>
      <div class="sig-sub">Assinatura do Funcionário</div>
    </div>
    <div class="sig-line">
      <div class="sig-label">Responsável / Gestor</div>
      <div class="sig-sub">Assinatura e Carimbo</div>
    </div>
  </div>

  <div class="doc-footer">
    Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · Sistema de Ponto Eletrônico
  </div>

  <script>
    // Abre o diálogo de impressão automaticamente
    window.addEventListener("load", () => { window.print(); });
  </script>
</body>
</html>`;

  return html;
}

// ─── Abre o PDF em nova aba ───────────────────────────────────────────────────

export function openEspelhoPDF(params: EspelhoParams): void {
  const html = generateEspelhoHTML(params);
  const blob = new Blob([html], { type: "text/html; charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const tab  = window.open(url, "_blank");
  if (tab) {
    tab.addEventListener("beforeunload", () => URL.revokeObjectURL(url));
  }
}
