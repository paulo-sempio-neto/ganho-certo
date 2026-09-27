# Production deployment runbook

Operational guide for the first real GanhoCerto production deployment.

Do not store real secrets in this repository. Use only the secret manager or
environment variable system from the hosting provider.

## Recommended architecture

- Frontend: static React/Vite build on Vercel or equivalent static hosting.
- Backend: FastAPI service on Render or equivalent Python host.
- Database: managed PostgreSQL with automated backups enabled.
- Billing: Mercado Pago checkout and webhook handled only by the backend.
- Email: SMTP provider with TLS for password recovery.

Keep frontend and backend as separate deployable services:

- The frontend receives only `VITE_API_BASE_URL`.
- The backend receives database, JWT, SMTP, Mercado Pago and beta admin secrets.
- The database is not exposed publicly except through the managed provider access
  controls required by the backend host.

## Backend deployment

Use the `backend` directory as the service root.

Build command:

```bash
python -m pip install -e .
```

Release or migration command:

```bash
alembic upgrade head
```

Start command:

```bash
python -m app.server
```

`python -m app.server` reads `HOST`/`APP_HOST`, `PORT`/`APP_PORT`,
`FORWARDED_ALLOW_IPS`, disables Uvicorn access logs, and enables proxy headers.
On Render-like hosts, keep using the host-provided `PORT`.

## Backend environment variables

Required for public production:

```text
APP_ENV=production
DATABASE_URL=<managed PostgreSQL URL using postgresql+psycopg://...>
JWT_SECRET=<strong random secret, at least 48 chars with good diversity>
CORS_ALLOWED_ORIGINS=<public frontend origin, for example https://app.example.com>
FRONTEND_BASE_URL=<public frontend origin, for password reset links and billing return>
ALLOWED_HOSTS=<backend hostnames only, comma-separated, no scheme/port/path>
SMTP_HOST=<SMTP hostname>
SMTP_PORT=587
SMTP_FROM_EMAIL=<valid sender address>
SMTP_USE_TLS=true
```

Optional when the SMTP provider requires authentication:

```text
SMTP_USERNAME=<SMTP username>
SMTP_PASSWORD=<SMTP password>
```

Recommended production controls:

```text
FORWARDED_ALLOW_IPS=<trusted proxy IPs/CIDRs from the hosting provider>
MAX_REQUEST_BODY_BYTES=1048576
AUTH_LOGIN_RATE_LIMIT=10
AUTH_LOGIN_IP_RATE_LIMIT=60
AUTH_LOGIN_RATE_WINDOW_SECONDS=60
AUTH_REGISTER_RATE_LIMIT=5
AUTH_REGISTER_RATE_WINDOW_SECONDS=300
AUTH_RATE_LIMIT_MAX_ENTRIES=5000
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

For closed beta internal visibility:

```text
BETA_ADMIN_TOKEN=<strong random token with at least 32 chars>
```

Leave `BETA_ADMIN_TOKEN` empty if `/internal/beta/summary` and
`/internal/beta/feedback` should be disabled.

For Mercado Pago billing:

```text
BILLING_PROVIDER=mercado_pago
BILLING_PRO_MONTHLY_AMOUNT=<monthly Pro amount, for example 29.90>
BILLING_CURRENCY_ID=BRL
MERCADOPAGO_ACCESS_TOKEN=<private access token>
MERCADOPAGO_WEBHOOK_SECRET=<webhook secret configured in Mercado Pago>
MERCADOPAGO_PUBLIC_KEY=<public key, only if operationally needed>
```

Keep these backend-only. Never expose `DATABASE_URL`, `JWT_SECRET`,
`SMTP_PASSWORD`, `BILLING_SECRET_KEY`, `MERCADOPAGO_ACCESS_TOKEN` or
`MERCADOPAGO_WEBHOOK_SECRET` to the frontend.

## Frontend deployment

Use the `frontend` directory as the service root.

Build command:

```bash
npm install
npm run build
```

Static output directory:

```text
frontend/dist
```

Frontend production variable:

```text
VITE_API_BASE_URL=<public backend origin, for example https://api.example.com>
```

The frontend should not receive backend secrets. It calls the API with Bearer
tokens and starts Pro upgrades only through `/billing/checkout`.

## Database deployment

Production must use managed PostgreSQL. Do not use the local Docker database for
real users.

Before first user:

- Enable automated backups.
- Confirm retention period with the provider.
- Run at least one restore test into a separate safe database.
- Confirm the backend `DATABASE_URL` does not use the example `change_me`
  password.
- Run migrations with `alembic upgrade head`.
- Confirm the migration head with `alembic heads`; current head is
  `20260926_0021`.

Rollback considerations:

- Prefer forward fixes for schema issues after real users enter data.
- If rollback is unavoidable, pause new invites first.
- Take an on-demand backup before any rollback.
- Restore only after understanding whether beta data entered after the backup
  would be lost.

## Health and release validation

After deployment and migrations:

1. Open `/health` on the backend. Expected: `{"status":"ok"}`.
2. Open `/ready` on the backend. Expected: `{"status":"ready"}`.
3. Create a test account from the public frontend.
4. Log in with that account.
5. Create a vehicle.
6. Register a work day.
7. Add a daily expense.
8. Open the dashboard and confirm the result loads.
9. Submit beta feedback from the `Mais` menu.
10. Open `Mais` and confirm the account plan loads.
11. If billing is enabled, start checkout and confirm the account remains Free
    until a valid signed webhook is processed.

If any step fails:

- Capture the `X-Request-ID` response header when available.
- Capture approximate time, action, account email and user-facing message.
- Search backend logs by `request_id` and timestamp.
- Stop inviting new testers if there is data loss, cross-user data exposure,
  unexpected billing, or incorrect Pro activation.

## Security checklist

- Public frontend and backend use HTTPS.
- `APP_ENV=production` is set on the backend.
- API docs are not public in production.
- `JWT_SECRET` is strong, unique and not reused from examples.
- `CORS_ALLOWED_ORIGINS` contains only the real HTTPS frontend origin.
- `ALLOWED_HOSTS` contains only real backend and health-check hostnames.
- SMTP uses TLS.
- Mercado Pago webhook secret is configured in both provider and backend.
- Webhook activation depends on signed event verification and provider re-fetch.
- Frontend cannot activate Pro; backend subscription state remains source of truth.
- Real `.env` files are not committed.

## Final pre-invite checklist

- [ ] Backend service deployed with production env.
- [ ] Frontend static build deployed with `VITE_API_BASE_URL`.
- [ ] Alembic migrations applied to production PostgreSQL.
- [ ] Automated backups enabled and restore tested.
- [ ] `/health` returns ok.
- [ ] `/ready` returns ready.
- [ ] Test account can complete first setup and first daily result.
- [ ] Feedback submission saved.
- [ ] Plan page loads current subscription status.
- [ ] Billing test completed if real payments are enabled.
- [ ] Logs show request IDs and no unexpected 500s during smoke test.
