# Sistema de Ponto Eletrônico

Sistema web de controle de ponto com reconhecimento facial, banco de horas e painel administrativo. Desenvolvido em conformidade com a **Portaria 671/2021 do MTE** e **LGPD**.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [Rodando Localmente](#rodando-localmente)
- [Testes](#testes)
- [Deploy](#deploy)
- [Conformidade Legal](#conformidade-legal)
- [Segurança](#segurança)

---

## Visão Geral

O sistema substitui o ponto físico tradicional por um terminal web com identificação biométrica facial. Cada registro é imutável, carimbado com timestamp de servidor NTP autorizado e vinculado a um dispositivo previamente cadastrado pelo administrador.

```
Terminal (navegador) → Detecção facial client-side (face-api.js)
       ↓
API FastAPI → Verificação facial server-side (DeepFace/ArcFace)
       ↓
Supabase PostgreSQL → Registro imutável (trigger bloqueia UPDATE/DELETE)
       ↓
Celery → Recálculo assíncrono de banco de horas
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│  Cloudflare Pages  (React SPA + Workers)         │
│  • Terminal de ponto  • Portal do funcionário    │
│  • Painel administrativo                         │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS + X-Device-Token
┌──────────────────────▼──────────────────────────┐
│  FastAPI (Railway / Render)                      │
│  • Autenticação JWT   • Verificação facial       │
│  • Banco de horas     • Geração AFD              │
└──────┬──────────────────────────────┬────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼───────────┐
│  Supabase   │              │  Redis (Upstash)   │
│  PostgreSQL │              │  Celery broker     │
│  Auth       │              └────────────────────┘
│  Storage    │
│  RLS        │
└─────────────┘
```

### Separação de camadas (backend)

```
Route → Service → Repository → DB
```

- **Routes:** validação HTTP, sem lógica de negócio
- **Services:** orquestram regras de negócio, chamam repositories
- **Repositories:** exclusivamente queries SQL via SQLAlchemy async
- **Workers Celery:** chamam services diretamente, sem passar pela camada HTTP

---

## Stack

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| Python | 3.12+ | Runtime |
| FastAPI | 0.115+ | Framework web async |
| SQLAlchemy | 2.x | ORM async |
| Alembic | 1.14+ | Migrations |
| Supabase | PostgreSQL 15 | Banco + Auth + Storage + RLS |
| Celery + Redis | 5.x | Filas assíncronas |
| DeepFace / ArcFace | — | Reconhecimento facial |
| NTPLib | — | Timestamp legal (Portaria 671) |
| Pydantic v2 | — | Validação e settings |
| structlog | — | Logging JSON estruturado |

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18+ | UI |
| TypeScript | 5.x strict | Tipagem |
| Vite | 6.x | Build |
| TailwindCSS + shadcn/ui | — | Estilo |
| TanStack Query v5 | — | Server state |
| Zustand | 5.x | Client state |
| face-api.js | — | Detecção facial client-side |
| React Hook Form + Zod | — | Formulários |
| Wrangler | 3.x | Deploy Cloudflare Pages |

---

## Funcionalidades

### Terminal de Ponto
- Detecção facial automática via câmera (face-api.js, lazy loaded)
- Auto-captura após 1,5s com confiança ≥ 70%
- Verificação biométrica server-side (ArcFace, limiar configurável)
- Timestamp via NTP — nunca relógio do cliente ou do servidor
- Alternância automática IN/OUT
- Registro imutável (trigger PostgreSQL bloqueia UPDATE/DELETE)

### Portal do Funcionário
- Espelho de ponto por período
- Saldo de banco de horas
- Solicitação de justificativas e atestados

### Painel Administrativo
- Cadastro e gestão de funcionários
- Aprovação de justificativas (dispara recálculo via Celery)
- Gestão de dispositivos autorizados (onboarding de terminais)
- Geração de AFD (Arquivo Fonte de Dados — Portaria 671)
- Relatórios de banco de horas

### Workers Celery
- Recálculo de banco de horas após aprovação de ajuste
- Recálculo mensal automático (Celery Beat)
- Alerta de banco de horas prestes a vencer (< 30 dias)
- Sincronização NTP periódica (a cada 5 min)

---

## Estrutura do Projeto

```
sistema-de-ponto/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/      # Endpoints HTTP (sem lógica)
│   │   ├── core/               # config, security, NTP, exceptions, logging
│   │   ├── domain/             # Lógica de negócio por módulo
│   │   │   ├── attendance/     # Registro de ponto (imutável)
│   │   │   ├── devices/        # Terminais autorizados
│   │   │   ├── employees/      # Funcionários + consentimento LGPD
│   │   │   ├── facial/         # Encoder, verifier, AES-256-GCM
│   │   │   ├── hour_bank/      # Calculador CLT + banco de horas
│   │   │   └── justifications/ # Ajustes com fluxo de aprovação
│   │   ├── infrastructure/     # database, redis, supabase
│   │   ├── workers/            # Celery app + tasks
│   │   └── main.py
│   ├── alembic/versions/       # Migrations versionadas
│   └── tests/                  # unit / integration / e2e
├── frontend/
│   ├── src/
│   │   ├── app/                # Router + Providers
│   │   ├── features/           # Uma pasta por feature (lazy loaded)
│   │   │   ├── attendance/     # Terminal de ponto
│   │   │   ├── employee-portal/
│   │   │   ├── admin/
│   │   │   └── device-check/
│   │   ├── shared/lib/         # api.ts, face-api-loader, device-fingerprint
│   │   └── store/              # Zustand stores
│   └── wrangler.toml           # Cloudflare Pages config
└── docker-compose.yml          # Redis + backend para desenvolvimento local
```

---

## Pré-requisitos

- Python 3.12+
- Node.js 22+ e pnpm 9+
- Docker e Docker Compose
- Conta Supabase (banco + auth + storage)
- Conta Cloudflare (Pages)
- Redis (local via Docker ou Upstash em produção)

---

## Configuração do Ambiente

```bash
# 1. Clonar o repositório
git clone https://github.com/DiorgenesT/sistema-de-ponto.git
cd sistema-de-ponto

# 2. Copiar e preencher variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais do Supabase, JWT secret, chave AES-256, etc.

# 3. Gerar chaves seguras
python -c "import secrets; print(secrets.token_hex(32))"        # JWT_SECRET_KEY
python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"  # FACIAL_ENCRYPTION_KEY
```

---

## Rodando Localmente

### Backend

```bash
cd backend

# Instalar dependências (recomendado: uv)
pip install uv && uv sync

# Subir Redis
docker compose up -d redis

# Aplicar migrations
alembic upgrade head

# API
uvicorn app.main:app --reload --port 8000

# Worker Celery (outro terminal)
celery -A app.workers.celery_app worker --loglevel=info -Q hour_bank,reports,notifications

# Celery Beat — agendamentos (outro terminal)
celery -A app.workers.celery_app beat --loglevel=info
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev         # http://localhost:5173
```

### Stack completa via Docker

```bash
docker compose up
```

---

## Testes

```bash
# Backend — todos os testes
cd backend && uv run pytest tests/ -v --cov=app --cov-report=html

# Backend — somente unitários (rápido, sem banco)
uv run pytest tests/unit/ -v

# Frontend — unitários
cd frontend && pnpm test

# Frontend — cobertura
pnpm test:coverage

# Frontend — E2E (Playwright)
pnpm test:e2e
```

Cobertura mínima exigida: **80%** nos módulos de domínio do backend.

---

## Deploy

### Frontend → Cloudflare Pages

```bash
cd frontend
pnpm build
wrangler pages deploy dist --project-name=sistema-ponto
```

Ou automaticamente via GitHub Actions ao fazer push na branch `main`.

### Backend → Railway / Render

O `Dockerfile` em `backend/` está pronto para deploy. Configure as variáveis de ambiente no painel da plataforma.

**Variáveis obrigatórias em produção:**
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET_KEY`, `FACIAL_ENCRYPTION_KEY`, `REDIS_URL`

---

## Conformidade Legal

### Portaria 671/2021 (MTE)
| Requisito | Implementação |
|---|---|
| Timestamp de fonte confiável | NTPLib sincronizado com `a.ntp.br` |
| Imutabilidade dos registros | Trigger PostgreSQL bloqueia UPDATE/DELETE em `attendance_records` |
| Tolerância de 5 min | Implementada em `hour_bank/calculator.py` |
| Exportação AFD | Task Celery gera arquivo formato Portaria 671, Anexo I |
| Armazenamento mínimo 5 anos | Supabase Storage com política de retenção |

### LGPD
| Requisito | Implementação |
|---|---|
| Consentimento explícito | Tabela `employee_consents` com versão do termo e timestamp |
| Criptografia de dados biométricos | AES-256-GCM nos embeddings faciais |
| Direito de exclusão (Art. 18) | Rota `DELETE /employees/{id}/biometric-data` |
| Minimização de dados | Embeddings nunca saem descriptografados do módulo `facial/encryption.py` |
| Logs sem dados sensíveis | Validado por convenção — embeddings, CPF e tokens nunca são logados |

---

## Segurança

### Autenticação de dispositivos (3 camadas)
1. **Token de máquina** — SHA-256 enviado no header `X-Device-Token`, validado em toda requisição de ponto
2. **IP whitelist** — middleware rejeita IPs fora dos CIDRs cadastrados para o dispositivo
3. **Device fingerprint** — canvas + UA + timezone; discrepância gera alerta (não bloqueia sozinho)

### Autenticação de usuários
- JWT com access token de 15 min + refresh token de 7 dias
- RBAC: `EMPLOYEE`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`
- RLS no Supabase: funcionário só lê seus próprios registros

### Hardening
- Rate limiting via `slowapi` em todas as rotas de auth e ponto
- CORS restrito aos domínios da empresa
- Pydantic v2 com validators estritos em todos os inputs
- Zero queries com string formatting — apenas SQLAlchemy ORM
- Secrets exclusivamente via variáveis de ambiente

---

## Convenções

- **Commits:** Conventional Commits em português (pt-BR)
- **Python:** `ruff` + `mypy` strict, sem `Any` implícito
- **TypeScript:** `strict: true`, sem `@ts-ignore`, sem `as any`
- **Branches:** `main` → produção, `develop` → integração, `feature/*`, `fix/*`

---

## Licença

Proprietário — uso restrito à empresa contratante.
