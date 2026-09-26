# First production deployment

Checklist for the first real GanhoCerto deployment using the approved stack:

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

Do not deploy or create external accounts from this checklist without explicit
human approval. Do not commit real secrets.

## 1. Repository deployment review

Current deployment-relevant files:

- `frontend/package.json`: Vite scripts; production build is `npm run build`.
- `frontend/package-lock.json`: lockfile exists; use `npm ci` in Vercel when
  possible.
- `frontend/.env.example`: local example for `VITE_API_BASE_URL`.
- `backend/pyproject.toml`: Python package and runtime dependencies.
- `backend/app/server.py`: production entrypoint for `python -m app.server`.
- `backend/alembic.ini` and `backend/alembic/env.py`: Alembic migration setup.
- `.env.example`: local backend and database environment example.
- `docker-compose.yml`: local PostgreSQL only; not part of the production
  deployment.

Files not present:

- No `Dockerfile`.
- No `render.yaml`.
- No `vercel.json`.
- No `frontend/public` static asset directory.

These are not blockers for the first deployment. Configure Render and Vercel in
their dashboards using the commands in this document. Add infrastructure config
files later only if repeated manual setup becomes painful.

## 2. Exact deployment order

Follow this order. Backend should be deployed before the frontend so Vercel can
be configured with the final backend API URL.

### Step 1: Create Neon PostgreSQL

In Neon:

1. Create the production project/database.
2. Select a region close to Render's backend region.
3. Copy the production database connection string.
4. Prefer the direct connection string for the first deployment and migrations.
5. Keep `sslmode=require` if Neon includes it.
6. Enable or confirm backup/restore settings for the selected Neon plan.
7. Do not use the local Docker database for real users.

Backend variable:

```text
DATABASE_URL=<Neon PostgreSQL URL>
```

The app accepts `postgresql://`, `postgres://` and `postgresql+psycopg://`.
`backend/app/config.py` normalizes `postgresql://` and `postgres://` to
`postgresql+psycopg://`.

### Step 2: Create the Render backend service

In Render:

1. Create a new web service from the repository.
2. Set the root directory to:

```text
backend
```

3. Set the build command:

```bash
python -m pip install -e .
```

4. Set the start command:

```bash
python -m app.server
```

5. Use Render's host-provided `PORT`. Do not hardcode a port.
6. Use a paid always-on service for real users, especially if Mercado Pago
   webhooks are enabled.

### Step 3: Configure Render environment variables

Set these in Render, not in the repository:

```text
APP_ENV=production
DATABASE_URL=<Neon PostgreSQL URL>
JWT_SECRET=<strong random secret, at least 48 chars>
CORS_ALLOWED_ORIGINS=<Vercel frontend HTTPS origin>
FRONTEND_BASE_URL=<Vercel frontend HTTPS origin>
ALLOWED_HOSTS=<Render backend hostnames, comma-separated, no scheme/port/path>
SMTP_HOST=<SMTP hostname>
SMTP_PORT=587
SMTP_FROM_EMAIL=<valid sender address>
SMTP_USE_TLS=true
```

If the SMTP provider requires authentication:

```text
SMTP_USERNAME=<SMTP username>
SMTP_PASSWORD=<SMTP password>
```

Recommended production controls:

```text
FORWARDED_ALLOW_IPS=<trusted Render proxy IPs/CIDRs when known>
MAX_REQUEST_BODY_BYTES=1048576
AUTH_LOGIN_RATE_LIMIT=10
AUTH_LOGIN_IP_RATE_LIMIT=60
AUTH_LOGIN_RATE_WINDOW_SECONDS=60
AUTH_REGISTER_RATE_LIMIT=5
AUTH_REGISTER_RATE_WINDOW_SECONDS=300
AUTH_RATE_LIMIT_MAX_ENTRIES=5000
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

Optional beta internal endpoints:

```text
BETA_ADMIN_TOKEN=<strong random token with at least 32 chars>
```

Leave `BETA_ADMIN_TOKEN` empty if internal beta summary and feedback management
should stay disabled.

If Mercado Pago is enabled:

```text
BILLING_PROVIDER=mercado_pago
BILLING_PRO_MONTHLY_AMOUNT=<monthly Pro amount, for example 29.90>
BILLING_CURRENCY_ID=BRL
MERCADOPAGO_ACCESS_TOKEN=<private access token>
MERCADOPAGO_WEBHOOK_SECRET=<webhook secret configured in Mercado Pago>
MERCADOPAGO_PUBLIC_KEY=<public key, only if operationally needed>
```

If billing is not ready for the first deploy:

```text
BILLING_PROVIDER=none
```

### Step 4: Run Alembic migrations

Use one of these safe options:

- Preferred: configure Render's deploy/release command to run:

```bash
python -m alembic upgrade head
```

- Manual first deploy option: open a Render shell/job with the same production
  environment and run:

```bash
python -m alembic upgrade head
python -m alembic heads
```

Expected current migration head:

```text
20260926_0021
```

`/ready` checks database connectivity with `SELECT 1`, but it does not verify
that migrations have reached the latest head. Confirm migration logs before
inviting real users.

### Step 5: Deploy and validate the backend

After the backend is live:

1. Open:

```text
https://<render-backend-host>/health
```

Expected response:

```json
{"status":"ok"}
```

2. Open:

```text
https://<render-backend-host>/ready
```

Expected response:

```json
{"status":"ready"}
```

3. Confirm production docs are disabled:

```text
https://<render-backend-host>/docs
https://<render-backend-host>/openapi.json
```

These should not expose public API docs when `APP_ENV=production`.

4. Confirm logs do not print secrets.
5. Capture the final backend HTTPS origin for Vercel.

### Step 6: Create the Vercel frontend project

In Vercel:

1. Create a new project from the repository.
2. Set the root directory to:

```text
frontend
```

3. Set the install command:

```bash
npm ci
```

4. Set the build command:

```bash
npm run build
```

5. Set the output directory:

```text
dist
```

6. Configure the frontend environment variable:

```text
VITE_API_BASE_URL=<Render backend HTTPS origin>
```

Do not include a trailing path. Example:

```text
VITE_API_BASE_URL=https://api.example.com
```

### Step 7: Deploy and validate the frontend

After Vercel deploys:

1. Open the Vercel URL.
2. Register a test account.
3. Log in.
4. Confirm the frontend can call the Render API.
5. If API calls fail, check:
   - `VITE_API_BASE_URL` in Vercel.
   - `CORS_ALLOWED_ORIGINS` in Render.
   - `ALLOWED_HOSTS` in Render.
   - HTTPS domain configuration.

### Step 8: Configure final domains

After the temporary Vercel and Render URLs work:

1. Configure the final frontend domain in Vercel.
2. Configure the final backend domain in Render.
3. Confirm HTTPS on both domains.
4. Update Render:

```text
CORS_ALLOWED_ORIGINS=<final frontend HTTPS origin>
FRONTEND_BASE_URL=<final frontend HTTPS origin>
ALLOWED_HOSTS=<final backend hostname,render generated hostname if still used>
```

5. Update Vercel:

```text
VITE_API_BASE_URL=<final backend HTTPS origin>
```

6. Redeploy/restart after changing environment variables.

### Step 9: Configure Mercado Pago webhook when billing is enabled

In Mercado Pago:

1. Configure the webhook URL:

```text
https://<backend-host>/billing/webhook
```

2. Configure the same webhook secret in Mercado Pago and Render:

```text
MERCADOPAGO_WEBHOOK_SECRET=<same secret>
```

3. Confirm checkout does not activate Pro by itself.
4. Confirm only a signed approved webhook activates Pro.
5. Re-send one event and confirm duplicate handling is safe.

## 3. Smoke tests after deployment

Run these with one test account before inviting beta users.

Backend:

- [ ] `GET /health` returns `{"status":"ok"}`.
- [ ] `GET /ready` returns `{"status":"ready"}`.
- [ ] Production API docs are not public.
- [ ] Render logs include request IDs and no secrets.

Frontend/product flow:

- [ ] Public frontend loads over HTTPS.
- [ ] Registration works.
- [ ] Login works.
- [ ] Password recovery request returns a safe user-facing result.
- [ ] First vehicle creation works.
- [ ] First work day entry works.
- [ ] Daily expense entry works.
- [ ] Dashboard/result screen loads.
- [ ] History/import areas load for an authenticated user.
- [ ] Feedback submission works.
- [ ] Plan page shows the current subscription status.

PRO flow if Mercado Pago is enabled:

- [ ] Checkout starts from the frontend by calling the backend.
- [ ] Cancelled checkout leaves the account on Free.
- [ ] Approved signed webhook activates Pro.
- [ ] Failed or pending payment does not activate Pro.
- [ ] Duplicate webhook does not double-activate or corrupt state.

## 4. Security review

Before inviting real users:

- [ ] No real `.env` file is committed.
- [ ] No real `DATABASE_URL`, `JWT_SECRET`, SMTP password or Mercado Pago secret
      appears in Git.
- [ ] Vercel has only `VITE_API_BASE_URL`.
- [ ] Render has backend-only secrets.
- [ ] `APP_ENV=production`.
- [ ] `JWT_SECRET` is unique, random and at least 48 characters.
- [ ] `CORS_ALLOWED_ORIGINS` contains only the frontend HTTPS origin.
- [ ] `ALLOWED_HOSTS` contains only backend hostnames without scheme, port or
      path.
- [ ] SMTP uses TLS.
- [ ] Neon connection string is production PostgreSQL and not the local
      `change_me` example.
- [ ] Mercado Pago access token and webhook secret are configured only in
      Render.
- [ ] Frontend cannot activate Pro; backend remains the source of truth.
- [ ] Neon backups/restore expectations are understood before the first invite.

## 5. Missing items and non-blockers

Missing external items before deployment:

- Neon production database and connection string.
- Render backend service.
- Vercel frontend project.
- SMTP provider credentials.
- Optional final domains.
- Mercado Pago production/test credentials and webhook secret if billing is
  enabled.

Repository items not required for first deployment:

- `Dockerfile`: not needed for Render's Python build path.
- `render.yaml`: dashboard setup is acceptable for the first deploy.
- `vercel.json`: Vercel can build Vite from the `frontend` root without it.
- `frontend/public`: no required static assets are currently stored there.

Known operational risks:

- Render free/sleeping services are not appropriate for real webhook traffic.
- Neon scale-to-zero can add latency after idle periods.
- `/ready` does not confirm Alembic head; migration logs must be checked.
- Incorrect `CORS_ALLOWED_ORIGINS`, `ALLOWED_HOSTS` or `VITE_API_BASE_URL` will
  make the frontend look broken even if both services are running.
- SMTP misconfiguration affects password recovery, not normal login.

## 6. Pre-deploy local validation

Run these before requesting deployment approval:

Backend:

```bash
cd backend
python -m pytest
python -m ruff check .
python -m mypy app tests
python -m alembic heads
```

Frontend:

```bash
cd frontend
npm run test
npm run build
```

Expected frontend build output:

```text
frontend/dist
```

If these checks fail, fix the issue before deploying.
