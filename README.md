# GanhoCerto

GanhoCerto e uma aplicacao full stack para motoristas de aplicativo entenderem quanto realmente ganham depois de custos operacionais.

O projeto inclui autenticacao, veiculos, jornadas, despesas, resumos financeiros,
metas, importacao CSV, assinaturas e feedback da beta, com backend FastAPI,
frontend React/Vite e PostgreSQL.

## Stack

- Backend: Python, FastAPI, PostgreSQL, SQLAlchemy 2, Alembic, Pydantic, Pytest, Ruff, Mypy
- Frontend: React, TypeScript, Vite
- Infra: Docker, Docker Compose, GitHub Actions

## Requisitos

- Python 3.12+
- Node.js 20.19+ na linha 20, ou 22.12+ (requisito do Vite)
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

## Recuperacao de senha

O fluxo de recuperacao usa tokens de uso unico, armazenados apenas como hash e
validos por `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` minutos (padrao: 30). O link
enviado por email usa `FRONTEND_BASE_URL` no formato
`/reset-password?token=<token>`.

Em desenvolvimento local, se `SMTP_HOST` e `SMTP_FROM_EMAIL` nao estiverem
configurados, o email nao e enviado. Em `APP_ENV=production`, a aplicacao pode
iniciar com `SMTP_HOST`, `SMTP_FROM_EMAIL`, `SMTP_USERNAME` e `SMTP_PASSWORD`
vazios ou ausentes. Nesse caso, `/auth/forgot-password` retorna HTTP 503 com uma
mensagem de indisponibilidade para qualquer email e nao cria tokens.
Para habilitar o envio, configure host e remetente validos, `SMTP_USE_TLS=true`
e as credenciais exigidas pelo provedor. Configuracao parcial ou sem TLS continua
sendo rejeitada em producao. Cadastro e login continuam funcionando sem SMTP.

Variaveis SMTP:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
FRONTEND_BASE_URL=<URL publica do frontend>
```

## Billing e Mercado Pago

Billing fica desabilitado por padrao com `BILLING_PROVIDER=none`. Para a beta com
cobranca real, habilite Mercado Pago somente no backend:

```text
BILLING_PROVIDER=mercado_pago
BILLING_PRO_MONTHLY_AMOUNT=<valor mensal do Pro, ex: 29.90>
BILLING_CURRENCY_ID=BRL
MERCADOPAGO_ACCESS_TOKEN=<access token privado>
MERCADOPAGO_WEBHOOK_SECRET=<segredo configurado no webhook>
MERCADOPAGO_PUBLIC_KEY=<public key, se necessaria para operacao>
```

O checkout nao ativa plano localmente. A assinatura Pro so e liberada depois de
webhook assinado, validacao do evento e consulta ao estado da assinatura no
Mercado Pago. O frontend nunca deve receber `MERCADOPAGO_ACCESS_TOKEN`,
`MERCADOPAGO_WEBHOOK_SECRET`, `BILLING_SECRET_KEY`, `DATABASE_URL` ou
`JWT_SECRET`.

## Production deployment

Arquitetura planejada:

- Frontend React/Vite na Vercel
- Backend FastAPI no Render
- Banco PostgreSQL gerenciado

Antes de convidar usuários reais para a beta fechada, siga o checklist em
[`docs/BETA_CHECKLIST.md`](docs/BETA_CHECKLIST.md).
Para acompanhar ativacao, retencao inicial, duvidas e interesse no PRO por lote,
use tambem [`docs/BETA_LEARNING_CHECKLIST.md`](docs/BETA_LEARNING_CHECKLIST.md).
Compartilhe [`docs/BETA_TESTER_GUIDE.md`](docs/BETA_TESTER_GUIDE.md) com os testers.
Para validar a primeira sessao com testers, use tambem
[`docs/BETA_TEST_CHECKLIST.md`](docs/BETA_TEST_CHECKLIST.md).
Para preparar o primeiro deploy real, siga o runbook em
[`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md).
Para executar o deploy passo a passo, use o guia pratico em
[`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`](docs/PRODUCTION_DEPLOYMENT_GUIDE.md).
Para a decisao pratica de provedores e custos iniciais, veja
[`docs/PRODUCTION_STACK_DECISION.md`](docs/PRODUCTION_STACK_DECISION.md).
Para preparar o primeiro deploy com Vercel, Render e Neon, siga
[`docs/FIRST_PRODUCTION_DEPLOYMENT.md`](docs/FIRST_PRODUCTION_DEPLOYMENT.md).

### Backend no Render

Configure o servico apontando para a pasta `backend`.
Use Python 3.12 ou superior e fixe uma versao completa em `PYTHON_VERSION`
no Render. As dependencias estao em `backend/pyproject.toml`; o projeto nao usa
`requirements.txt`, portanto nao configure `pip install -r requirements.txt`.

Build command:

```bash
python -m pip install -e .
```

Start command:

```bash
bash scripts/render-start.sh
```

O script versionado `backend/scripts/render-start.sh` executa:

```bash
python -m alembic upgrade head
python -m alembic current
python -m app.server
```

No plano Free do Render, onde Pre-Deploy Command nao fica disponivel, mantenha
esse Start command. O servidor so inicia se o Alembic terminar com sucesso.
Veja as [etapas de deploy do Render](https://render.com/docs/deploys).

Configure o health check como `/ready`, que testa a conexao e as tabelas/colunas
usadas no cadastro (`users`, `plans`, `features`, `plan_features`, `product_events`);
`/health` confirma apenas que o processo esta respondendo. Inclua o hostname
publico do servico e os dominios personalizados usados nos checks em
`ALLOWED_HOSTS`, sem esquema, porta ou caminho.

Variaveis de producao no Render (CORS pode ficar vazio temporariamente):

```text
APP_ENV=production
PYTHON_VERSION=3.12.13
DATABASE_URL=<URL do PostgreSQL gerenciado>
JWT_SECRET=<segredo aleatorio com pelo menos 48 caracteres>
CORS_ALLOWED_ORIGINS=
FRONTEND_BASE_URL=<URL publica do frontend na Vercel>
ALLOWED_HOSTS=<host publico do backend, sem esquema ou porta>
SMTP_HOST=
SMTP_PORT=587
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
BILLING_PROVIDER=none
```

`PYTHON_VERSION=3.12.13` fixa uma versao da linha usada no CI. Substitua todos os
valores entre `<...>` por valores reais; os marcadores nao sao configuracoes.
`FRONTEND_BASE_URL` precisa ser o endereco HTTPS reservado para seu frontend,
mesmo se CORS ainda estiver vazio. Sem um endereco definido, configure/crie
primeiro o projeto do frontend para obter sua URL. Nao use o dominio de terceiros
nem a URL da API para os links de recuperacao de senha.

No deploy inicial, deixe `SMTP_HOST`, `SMTP_FROM_EMAIL`, `SMTP_USERNAME` e
`SMTP_PASSWORD` vazios ou ausentes para desabilitar a solicitacao de recuperacao
de senha. Para habilita-la, configure host e remetente validos mantendo TLS.
Se o SMTP exigir autenticacao, configure `SMTP_USERNAME` e `SMTP_PASSWORD`
juntos. O envio atual usa STARTTLS. O [Render Free](https://render.com/docs/free)
bloqueia saidas nas portas SMTP 25, 465 e 587: com a porta padrao, a recuperacao
de senha exige um servico pago. Confirme o envio real antes de liberar usuarios.
Com billing desativado, omita `BILLING_PRO_MONTHLY_AMOUNT`; nao use valor vazio.

Variaveis que podem ficar vazias ou ausentes no primeiro deploy:

| Variavel | Condicao |
| --- | --- |
| `CORS_ALLOWED_ORIGINS` | Sem acesso entre origens ate cadastrar o frontend |
| `BETA_ADMIN_TOKEN` | Endpoints administrativos da beta desativados |
| `BILLING_SECRET_KEY` | Com `BILLING_PROVIDER=none` |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` | Com `BILLING_PROVIDER=none` |
| `SMTP_HOST`, `SMTP_FROM_EMAIL`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Todos vazios desabilitam a solicitacao de recuperacao; com SMTP ativo, credenciais podem ser omitidas somente se o provedor dispensar autenticacao |

Omita `BILLING_PRO_MONTHLY_AMOUNT` enquanto billing estiver desativado; se ativar,
use um decimal positivo. Nao deixe valores numericos ou booleanos vazios.
Os controles `AUTH_*`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`,
`PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`, `MAX_REQUEST_BODY_BYTES` e
`BILLING_CURRENCY_ID` podem ser omitidos para usar os padroes do `.env.example`.
`FORWARDED_ALLOW_IPS` pode manter o padrao `127.0.0.1`; altere apenas com os
IPs/CIDRs reais dos proxies confiaveis, nunca `*`.
Nao cadastre `POSTGRES_*` do Docker Compose no Web Service: ele usa `DATABASE_URL`.
Nao e necessario cadastrar `HOST`, `APP_HOST`, `PORT` ou `APP_PORT`: o servidor
escuta em `0.0.0.0` e usa o `PORT` fornecido pelo Render.

O `APP_ENV=production` e obrigatorio em deploy publico: nesse modo a API rejeita
`JWT_SECRET` conhecido, curto ou fraco. Swagger (`/docs`), ReDoc (`/redoc`) e
OpenAPI (`/openapi.json`) ficam habilitados, inclusive em producao.
O `PORT` e fornecido pelo Render automaticamente. Nao versionar segredos reais.

No Render, `CORS_ALLOWED_ORIGINS` pode ficar vazio ou ausente enquanto o frontend
nao estiver cadastrado: nenhuma origem sera liberada para CORS. Depois, defina
o valor como `https://seu-frontend.vercel.app` ou uma lista separada por virgulas,
como `https://seu-frontend.vercel.app,https://app.seudominio.com`, e faca redeploy.
Tambem e aceito um array JSON: `["https://seu-frontend.vercel.app"]`.
Espacos externos, aspas envolvendo o valor e uma barra final sao normalizados.
Nao use placeholders, caminhos, `*` ou HTTP em producao. Os padroes
`http://localhost:5173` e `http://127.0.0.1:5173` se aplicam apenas a
`APP_ENV=local/development/test` quando a lista esta vazia ou ausente.
`FRONTEND_BASE_URL` continua exigindo uma origem HTTPS em producao para os links
de recuperacao de senha; atualize-a quando definir o endereco do frontend.

### Frontend na Vercel

Configure o projeto apontando para a pasta `frontend`.
Use o preset Vite, instalacao `npm ci`, build `npm run build` e saida `dist`.
O frontend e estatico e nao possui Start command de producao.
`frontend/vercel.json` encaminha `/reset-password` para `index.html`, permitindo
abrir diretamente o link de recuperacao de senha. Veja
[Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite).

Variavel obrigatoria na Vercel:

```text
VITE_API_BASE_URL=<URL publica do backend no Render>
```

Nao exponha `DATABASE_URL`, `JWT_SECRET`, SMTP ou segredos de billing no frontend.

Se hospedar o frontend no Render, crie um **Static Site** separado, com Root
Directory `frontend`, Build Command `npm ci && npm run build` e Publish Directory
`dist`. Configure `VITE_API_BASE_URL` antes do build e adicione uma regra do tipo
**Rewrite** de `/*` para `/index.html` em Redirects/Rewrites. Nao use `npm run dev`
ou `npm run preview` como servidor de producao. Referencia:
[rewrites para sites estaticos no Render](https://render.com/docs/redirects-rewrites).

### Primeiro deploy com PostgreSQL do Render

1. Na raiz do repositorio, revise e publique somente os arquivos desta preparacao:

   ```bash
   git status --short
   git diff --check
   git add README.md .env.example backend/app/config.py backend/tests/test_production_operations.py frontend/.env.example frontend/vercel.json
   git commit -m "Prepare production deployment on Render"
   git push origin main
   ```

   Os documentos `docs/BETA_*` podem conter trabalho separado; revise-os antes
   de inclui-los em outro commit. Nunca adicione `.env` real.

2. Crie um Render Postgres no mesmo workspace e regiao do backend. Espere ficar
   disponivel e copie a **Internal Database URL** para `DATABASE_URL` do Web
   Service. A URL interna e para servicos Render na mesma regiao; acesso local
   exige a URL externa e autorizacao de rede. Mantenha parametros SSL presentes
   na URL. O backend aceita `postgres://`, `postgresql://` e
   `postgresql+psycopg://`, normalizando os dois primeiros para o driver psycopg.
   Veja [conexoes PostgreSQL no Render](https://render.com/docs/postgresql-creating-connecting).

3. Reserve a URL do frontend na Vercel ou no Render Static Site. Crie um Web
   Service Python ligado ao repositorio e a branch `main`, Root Directory
   `backend`, na mesma regiao do banco. Para o SMTP padrao na porta 587, use
   instancia paga. Configure os comandos de build e start acima.

4. Cadastre as variaveis de producao listadas acima no Web Service. Copie o host
   real atribuido ao backend para `ALLOWED_HOSTS`, sem `https://`; acrescente os
   dominios personalizados, se existirem. Configure Health Check Path `/ready`.
   Mantenha CORS vazio ate liberar o frontend e nao copie o `.env.example` local
   inteiro para o Render.

5. Execute o deploy e confirme nos logs que `alembic upgrade head`
   terminou antes do start. No Shell do servico, execute
   `alembic current`: o resultado deve ser `20260926_0021 (head)`.
   `alembic heads` mostra apenas a ultima revisao do codigo, nao comprova que o
   banco foi migrado. Nao use `create_all` nem `alembic stamp head` para substituir
   as migrations. Elas criam tambem os planos e permissoes iniciais.

6. Teste a API publicada (substitua o host abaixo):

   ```powershell
   $apiUrl = 'https://seu-backend.onrender.com'
   Invoke-RestMethod "$apiUrl/health"
   Invoke-RestMethod "$apiUrl/ready"
   ```

   Espere HTTP 200 com `{"status":"ok"}` e `{"status":"ready"}`,
   respectivamente. `/ready` verifica conexao e tabelas/colunas do cadastro;
   confirme tambem a revisao do banco no passo anterior. `/docs`, `/redoc` e
   `/openapi.json` devem retornar HTTP 200, inclusive em producao.

7. Configure `VITE_API_BASE_URL` com a URL HTTPS do backend (sem barra final) e
   publique o frontend. No backend, defina `CORS_ALLOWED_ORIGINS` com a origem
   HTTPS do frontend e confira `FRONTEND_BASE_URL` com essa mesma origem. Faca
   redeploy do backend. Valide cadastro, login, leitura/gravação de dados e um
   email real de recuperacao, incluindo abertura direta de `/reset-password`.

Riscos da primeira inicializacao: variaveis obrigatorias invalidas bloqueiam
tanto Alembic quanto a API; banco sem tabelas/colunas do cadastro retorna 503 em
`/ready`; host incorreto em `ALLOWED_HOSTS` rejeita os checks;
SMTP bloqueado impede recuperacao de senha. A verificacao local nao comprova
conectividade, credenciais, migrations ou envio de email no servico publicado.

## Historico de escopo inicial

- Integracao com Uber Driver API ou OAuth 2.0
