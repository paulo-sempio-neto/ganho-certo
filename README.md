# GanhoCerto

GanhoCerto e uma aplicacao full stack para motoristas de aplicativo entenderem quanto realmente ganham depois de custos operacionais.

Nesta fase, o projeto contem apenas a fundacao: backend FastAPI, frontend React com Vite, PostgreSQL via Docker Compose e ferramentas de qualidade.

## Stack

- Backend: Python, FastAPI, PostgreSQL, SQLAlchemy 2, Alembic, Pydantic, Pytest, Ruff, Mypy
- Frontend: React, TypeScript, Vite
- Infra: Docker, Docker Compose, GitHub Actions

## Requisitos

- Python 3.12+
- Node.js 20+
- Docker e Docker Compose

## Configuracao

Copie o arquivo de exemplo de variaveis de ambiente:

```powershell
Copy-Item .env.example .env
```

Edite `.env` se quiser trocar as credenciais locais. O arquivo `.env` nao deve ser versionado.

## PostgreSQL

```powershell
docker compose --env-file .env up -d postgres
```

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m pytest
python -m ruff check .
python -m mypy app tests
uvicorn app.main:app --reload
```

O backend fica disponivel em `http://127.0.0.1:8000`.

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

O frontend fica disponivel em `http://127.0.0.1:5173`.

Build:

```powershell
npm run build
```

## Alembic

O Alembic ja esta configurado para usar `DATABASE_URL`.

```powershell
cd backend
alembic upgrade head
```

## Production deployment

Arquitetura planejada:

- Frontend React/Vite na Vercel
- Backend FastAPI no Render
- Banco PostgreSQL gerenciado

### Backend no Render

Configure o servico apontando para a pasta `backend`.

Build command:

```bash
python -m pip install -e .
```

Release command:

```bash
python -m alembic upgrade head
```

Start command:

```bash
python -m app.server
```

Variaveis obrigatorias no Render:

```text
APP_ENV=production
DATABASE_URL=<URL do PostgreSQL gerenciado>
JWT_SECRET=<segredo forte gerado para producao>
CORS_ALLOWED_ORIGINS=<URL publica do frontend na Vercel>
```

O `PORT` e fornecido pelo Render automaticamente. Nao versionar segredos reais.

### Frontend na Vercel

Configure o projeto apontando para a pasta `frontend`.

Variavel obrigatoria na Vercel:

```text
VITE_API_BASE_URL=<URL publica do backend no Render>
```

Nao exponha `DATABASE_URL` ou `JWT_SECRET` no frontend.

## Fora do escopo desta fase

- Autenticacao
- Usuarios
- Veiculos
- Jornadas
- Receitas
- Despesas
- Calculos financeiros
- Integracao com Uber Driver API ou OAuth 2.0
