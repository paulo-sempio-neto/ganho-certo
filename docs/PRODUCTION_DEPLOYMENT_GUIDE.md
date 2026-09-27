# Production deployment guide

Step-by-step guide for the first real GanhoCerto production deployment.

This guide does not require committing secrets. Configure real values only in
the hosting providers.

## 1. Recommended hosting stack

Recommended first production stack:

- Frontend: Vercel static deployment from `frontend`.
- Backend: Render web service from `backend`.
- Database: managed PostgreSQL from Render, Supabase, Neon, Railway or another
  provider with automated backups.
- Email: SMTP provider with TLS.
- Billing: Mercado Pago configured through backend-only environment variables.

Production service boundaries:

- Frontend receives only `VITE_API_BASE_URL`.
- Backend receives `DATABASE_URL`, `JWT_SECRET`, SMTP, Mercado Pago and beta
  admin variables.
- PostgreSQL is reached by the backend only.
- Mercado Pago webhook targets the backend `/billing/webhook` endpoint.

## 2. Deployment order

Follow this order for the first deployment.

### Step 1: Create the production database

1. Create a managed PostgreSQL database.
2. Enable automated backups.
3. Confirm backup retention.
4. Run a restore test into a separate safe database before inviting users.
5. Copy the production connection URL.
6. Confirm the URL uses PostgreSQL and does not contain the example
   `change_me` password.

Required backend variable:

```text
DATABASE_URL=<managed PostgreSQL URL>
```

The application normalizes `postgresql://` and `postgres://` to
`postgresql+psycopg://`, but using `postgresql+psycopg://` directly is preferred.

### Step 2: Configure backend environment variables

Set these in the backend hosting provider:

```text
APP_ENV=production
DATABASE_URL=<managed PostgreSQL URL>
JWT_SECRET=<strong random secret, at least 48 chars>
CORS_ALLOWED_ORIGINS=<public frontend origin>
FRONTEND_BASE_URL=<public frontend origin>
ALLOWED_HOSTS=<public backend hostnames, comma-separated, no scheme/port/path>
SMTP_HOST=<SMTP hostname>
SMTP_PORT=587
SMTP_FROM_EMAIL=<valid sender address>
SMTP_USE_TLS=true
```

If SMTP requires authentication:

```text
SMTP_USERNAME=<SMTP username>
SMTP_PASSWORD=<SMTP password>
```

Recommended backend controls:

```text
FORWARDED_ALLOW_IPS=<trusted proxy IPs/CIDRs from the host>
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

Leave `BETA_ADMIN_TOKEN` empty to disable internal beta summary and feedback
management endpoints.

If real payments are enabled:

```text
BILLING_PROVIDER=mercado_pago
BILLING_PRO_MONTHLY_AMOUNT=<monthly Pro amount, for example 29.90>
BILLING_CURRENCY_ID=BRL
MERCADOPAGO_ACCESS_TOKEN=<private access token>
MERCADOPAGO_WEBHOOK_SECRET=<webhook secret configured in Mercado Pago>
MERCADOPAGO_PUBLIC_KEY=<public key, only if operationally needed>
```

Never configure backend secrets in the frontend host.

### Step 3: Configure backend deployment commands

Backend service root:

```text
backend
```

Build command:

```bash
python -m pip install -e .
```

Migration or release command:

```bash
alembic upgrade head
```

Start command:

```bash
python -m app.server
```

The host should provide `PORT`. The server reads `PORT`/`APP_PORT`,
`HOST`/`APP_HOST` and `FORWARDED_ALLOW_IPS`.

### Step 4: Run migrations

Before starting real traffic:

1. Ensure backend environment variables are configured.
2. Run:

```bash
alembic upgrade head
```

3. Confirm the codebase head:

```bash
alembic heads
```

Expected current head:

```text
20260926_0021
```

`/ready` checks database connectivity, not migration status. Migration success
must be confirmed from the release command logs.

### Step 5: Deploy the backend

1. Deploy the backend service.
2. Confirm the process starts without configuration errors.
3. Confirm logs do not print secrets.
4. Confirm the backend public URL.
5. Keep API docs disabled in production (`APP_ENV=production` does this).

### Step 6: Configure frontend environment variables

Set this in the frontend hosting provider:

```text
VITE_API_BASE_URL=<public backend origin>
```

Example format:

```text
VITE_API_BASE_URL=https://api.example.com
```

Do not include a trailing path. Do not expose backend secrets.

### Step 7: Deploy the frontend

Frontend service root:

```text
frontend
```

Build command:

```bash
npm install
npm run build
```

Output directory:

```text
dist
```

### Step 8: Configure domains

1. Configure the backend domain.
2. Configure the frontend domain.
3. Ensure both use HTTPS.
4. Update backend `CORS_ALLOWED_ORIGINS` and `FRONTEND_BASE_URL` to the final
   frontend HTTPS origin.
5. Update backend `ALLOWED_HOSTS` to the final backend hostnames.
6. Update frontend `VITE_API_BASE_URL` to the final backend HTTPS origin.
7. Redeploy or restart services after domain/env changes.

### Step 9: Configure Mercado Pago webhook if billing is enabled

1. Configure Mercado Pago to call:

```text
https://<backend-host>/billing/webhook
```

2. Configure the same webhook secret in Mercado Pago and
   `MERCADOPAGO_WEBHOOK_SECRET`.
3. Use a test purchase/subscription flow before enabling real users.
4. Confirm the account stays Free after checkout until an approved signed webhook
   is processed.

## 3. Smoke tests after deployment

Run these from the public frontend/backend.

### Backend checks

- [ ] `GET /health` returns:

```json
{"status":"ok"}
```

- [ ] `GET /ready` returns:

```json
{"status":"ready"}
```

- [ ] Invalid host is rejected if the host provider allows this check.
- [ ] CORS allows the frontend origin and does not allow unrelated origins.

### Product flow checks

- [ ] Register a new test account.
- [ ] Log in.
- [ ] Confirm the plan page shows Free.
- [ ] Create one vehicle.
- [ ] Register one work day in `Registrar meu dia`.
- [ ] Add one daily expense.
- [ ] Open the dashboard and confirm the result loads.
- [ ] Submit beta feedback from `Mais`.
- [ ] If `BETA_ADMIN_TOKEN` is enabled, confirm internal beta summary works only
      with `X-Beta-Admin-Token`.

### PRO checkout checks

If billing is enabled:

- [ ] Start checkout from the plan page.
- [ ] Cancel/return from checkout and confirm the plan remains Free.
- [ ] Complete an approved test payment/subscription.
- [ ] Confirm a signed webhook activates Pro.
- [ ] Re-send the same webhook event and confirm it is treated as duplicate.
- [ ] Confirm a failed/pending payment does not activate Pro.

## 4. Rollback checklist

Use this checklist if deployment causes serious issues.

- [ ] Stop inviting new beta users.
- [ ] Identify whether the problem is frontend, backend, database, SMTP or
      Mercado Pago.
- [ ] Capture request IDs, timestamps and affected test account emails.
- [ ] Check backend logs by `request_id`.
- [ ] If frontend-only, roll back to the previous static deployment.
- [ ] If backend-only and no migration/data issue exists, roll back to the
      previous backend deploy.
- [ ] If a migration/data issue exists, take an immediate on-demand backup.
- [ ] Prefer a forward migration/fix after users have entered data.
- [ ] Restore a database backup only after confirming what data would be lost.
- [ ] After rollback/fix, repeat smoke tests before inviting more users.

## 5. Common deployment failures and fixes

### Backend fails at startup with settings validation

Likely causes:

- `APP_ENV=production` with weak `JWT_SECRET`.
- `CORS_ALLOWED_ORIGINS` uses `http`, wildcard, path, or invalid origin.
- `FRONTEND_BASE_URL` is not an HTTPS origin.
- `ALLOWED_HOSTS` is empty, has wildcard, has scheme, has path, or has port.
- Production `DATABASE_URL` uses example password `change_me`.
- SMTP is missing or TLS is disabled.
- Mercado Pago is enabled without access token, webhook secret or amount.

Fix:

- Correct env vars in the host.
- Restart/redeploy the backend.

### `/health` works but `/ready` fails

Likely causes:

- Database URL is wrong.
- Database is asleep, unavailable or blocked by network rules.
- Migrations were not run.
- Provider connection limit is exhausted.

Fix:

- Check database availability and credentials.
- Run `alembic upgrade head`.
- Review backend logs using request ID.

### Frontend shows network error

Likely causes:

- `VITE_API_BASE_URL` is missing or points to the wrong backend.
- Backend CORS does not include the frontend origin.
- Backend `ALLOWED_HOSTS` does not include the public backend hostname.
- HTTPS/domain configuration is incomplete.

Fix:

- Correct `VITE_API_BASE_URL`.
- Correct `CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS`.
- Rebuild/redeploy frontend after changing Vite env vars.

### Login or registration returns too many attempts

Likely causes:

- In-memory rate limit is sharing one proxy IP for many users.
- `FORWARDED_ALLOW_IPS` does not match the hosting provider proxy.

Fix:

- Confirm trusted proxy IP/CIDR with the host.
- Adjust `FORWARDED_ALLOW_IPS`.
- Keep traffic small during beta; this limiter is intentionally simple.

### Password recovery fails

Likely causes:

- SMTP host/from email missing.
- SMTP auth requires username/password.
- TLS disabled or blocked by provider.

Fix:

- Configure SMTP with TLS.
- Set username and password together when required.
- Check provider logs for SMTP rejection.

### PRO checkout cannot start

Likely causes:

- `BILLING_PROVIDER` is not `mercado_pago`.
- `BILLING_PRO_MONTHLY_AMOUNT` is missing.
- Mercado Pago access token is missing or invalid.
- Provider response did not include checkout URL.

Fix:

- Correct backend billing env vars.
- Restart backend.
- Check Mercado Pago credentials and account status.

### Checkout succeeds but PRO is not active

Likely causes:

- Webhook URL is wrong.
- Webhook secret mismatch.
- Mercado Pago event is pending/failed instead of active/authorized.
- Backend cannot fetch provider subscription.
- Webhook was not signed correctly.

Fix:

- Confirm webhook points to `/billing/webhook`.
- Confirm `MERCADOPAGO_WEBHOOK_SECRET` matches the provider.
- Check backend logs and Mercado Pago event delivery logs.
- Confirm provider subscription status is active/authorized.

### API returns 500 with request ID

Fix:

- Ask the user for `X-Request-ID`, time and action.
- Search backend logs by request ID.
- Do not expose stack traces or secrets to the user.
- Stop inviting new users if the issue affects data integrity, billing or
  isolation.

## 6. Pre-launch command checklist

Run these locally before deployment:

```bash
cd backend
python -m pytest
python -m ruff check .
python -m mypy app tests
alembic heads
```

```bash
cd frontend
npm run test
npm run build
```

Expected migration head:

```text
20260926_0021
```

## 7. Do not deploy from this guide alone

Before inviting real users, also complete:

- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/BETA_CHECKLIST.md`
- `docs/BETA_TEST_CHECKLIST.md`
