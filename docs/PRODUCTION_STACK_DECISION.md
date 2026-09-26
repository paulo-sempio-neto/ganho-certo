# Production stack decision

Practical provider decision for the first real GanhoCerto production
deployment.

This is a documentation-only decision record. It does not create accounts,
deploy services or change application code.

Pricing was reviewed on 2026-09-26 from public provider pages. Treat all prices
as planning estimates in USD, before taxes, currency conversion, add-ons and
traffic overages.

Provider pages checked:

- Vercel pricing: https://vercel.com/pricing
- Render pricing: https://render.com/pricing
- Render free limits: https://render.com/docs/free
- Railway pricing: https://railway.com/pricing
- Neon plans: https://neon.com/docs/introduction/plans
- Supabase pricing: https://supabase.com/pricing
- Netlify pricing: https://www.netlify.com/pricing/
- DigitalOcean managed databases: https://www.digitalocean.com/pricing/managed-databases
- Fly.io pricing: https://fly.io/docs/about/pricing/

## 1. Current GanhoCerto requirements

GanhoCerto needs a small, reliable SaaS deployment rather than a complex cloud
architecture.

Current application shape:

- Frontend: React with Vite, built from `frontend`, static output in `dist`.
- Backend: FastAPI, started with `python -m app.server`.
- Database: PostgreSQL through SQLAlchemy and Alembic migrations.
- Authentication: JWT with a strong production `JWT_SECRET`.
- Email: SMTP with TLS for password recovery.
- Billing: Mercado Pago checkout and signed webhook handled by the backend.
- Internal beta learning: database-backed events, feedback and protected beta
  summary endpoints.

Operational requirements:

- HTTPS for frontend and backend.
- Backend environment variables kept out of frontend hosting.
- `APP_ENV=production`.
- Explicit `CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS`.
- Managed PostgreSQL with automated backups and a tested restore path.
- Release command or manual step for `python -m alembic upgrade head`.
- Logs with request IDs for debugging beta issues.
- Webhook endpoint reachable from Mercado Pago.

Growth expectations:

- First 10 users: intermittent daily usage, a small number of financial entries,
  low dashboard traffic and occasional feedback submissions.
- First 100 users: still modest traffic, but more login bursts, more dashboard
  reads and more webhook/payment attempts.
- No background worker or scheduled job is required today. If scheduled tasks
  appear later, add a host-native cron job or worker only when there is a real
  need.

## 2. Deployment option comparison

### Frontend options

| Option | Pros | Cons | Fit |
| --- | --- | --- | --- |
| Vercel | Very good Vite/static deployment flow, automatic HTTPS, previews, simple `VITE_API_BASE_URL`, global CDN, easy custom domains. | Hobby is best for personal/small starting use; production/team needs may push to Pro. Usage and platform limits must be watched. | Best initial choice. |
| Netlify | Strong static hosting, previews, automatic HTTPS, simple Vite builds, free and low paid tiers. | Credit-based pricing needs monitoring. Less aligned with the current deployment docs, which already assume Vercel. | Good fallback if Vercel becomes inconvenient. |
| Cloudflare Pages | Fast global static hosting, strong CDN/DNS story, low cost. | More Cloudflare-specific behavior to learn. Backend/API remains separate. | Good if DNS is already on Cloudflare. |
| Render static site | One provider for frontend and backend, simple enough for static builds. | Less specialized frontend workflow than Vercel/Netlify. | Acceptable if provider consolidation matters more than frontend DX. |

Frontend decision:

- Use Vercel for the first deployment.
- Use only `VITE_API_BASE_URL` as the frontend production variable.
- Do not put `DATABASE_URL`, `JWT_SECRET`, SMTP values or Mercado Pago secrets
  in Vercel.

### Backend options

| Option | Pros | Cons | Fit |
| --- | --- | --- | --- |
| Render | Simple Python web service, host-provided `PORT`, release commands for Alembic, managed TLS, logs, straightforward fit for `python -m app.server`. | Free services can sleep and free Postgres expires; paid compute should be used for real users. Small plans have limited memory. | Best initial choice. |
| Railway | Very fast setup, supports app plus Postgres, usage-based billing, global regions, easy environment management. | Costs are usage-based and can be less predictable. Hobby/Pro choices and resource limits need active budget monitoring. | Strong alternative if speed and one-dashboard ops are preferred. |
| Fly.io | Good global deployment model, low-level control, can run Python well. | More operational complexity, machines/volumes/networking require more care. | Better after operations maturity grows. |
| DigitalOcean App Platform | Predictable provider, can pair with managed PostgreSQL. | More setup friction than Render for this app. Managed database adds separate fixed cost. | Good conservative alternative. |
| Google Cloud Run | Scales well, mature platform, strong IAM/logging. | More cloud complexity, billing and IAM setup are heavier for first beta. | Too much for first deployment unless GCP is already familiar. |

Backend decision:

- Use Render paid web service for the first real beta.
- Avoid free sleeping services for real users and billing webhooks.
- Keep one backend instance initially unless CPU, memory or request latency show
  a real need to scale.

### Database options

| Option | Pros | Cons | Fit |
| --- | --- | --- | --- |
| Neon | PostgreSQL-focused, free/usage-based entry, scale-to-zero, good for low early traffic, easy to grow storage/compute. | Serverless scale-to-zero can add cold-start latency. Separate provider from Render. Connection behavior must be watched. | Best initial choice for lowest safe cost. |
| Supabase | Managed Postgres with daily backups on Pro, dashboard, pooling options and room to grow. | Includes many features GanhoCerto does not currently need. Pro starts at a higher fixed monthly cost than the smallest beta setup. | Best if predictable backup/support package matters more than minimum cost. |
| Render Postgres | Same provider as backend, simple internal/private networking story on Render. | Free database expires after 30 days. Paid small plans are simple but may be less flexible than serverless options. | Good if provider consolidation matters. |
| Railway Postgres | Very fast to provision next to a Railway backend. | Usage-based billing and plan storage limits need monitoring. | Best if choosing Railway for backend too. |
| DigitalOcean Managed PostgreSQL | Predictable managed database, backups, mature operational model. | Higher fixed cost for the earliest beta compared with Neon or small provider plans. | Good for a more traditional always-on setup. |

Database decision:

- Use Neon Launch for the first production database if the goal is a low-cost,
  safe beta with managed PostgreSQL and room to grow.
- Use Supabase Pro instead if the team wants a more predictable fixed monthly
  plan with included daily backups and does not mind paying more at the start.
- Do not use any free database plan for real production data unless data loss,
  inactivity pauses and restore limitations are explicitly accepted.

## 3. Initial cost estimates

These estimates assume:

- One frontend project.
- One backend service.
- One production PostgreSQL database.
- Low beta traffic.
- SMTP provider free tier or low-cost starter plan.
- No paid observability platform yet.
- No heavy file storage.

### Scenario A: free or low-cost closed beta

Target:

- Up to 10 invited users.
- Manual monitoring.
- No uptime promise.

Estimated monthly cost:

- Frontend: Vercel Hobby, `0 USD`, if allowed for this use and within limits.
- Backend: Render small paid web service, roughly `7 USD+`.
- Database: Neon Launch low usage, often low single-digit USD at small scale,
  or a small paid managed Postgres option if always-on behavior is preferred.
- SMTP: `0-15 USD`, depending on provider and volume.
- Domain: separate registrar cost, often annual.

Practical range:

- `10-30 USD/month` before taxes and domain.

Limitations:

- Do not rely on free sleeping backend for Mercado Pago webhooks.
- Watch Neon cold-start behavior if the database scales to zero.
- Confirm backup/restore expectations before inviting real users.
- Cost can rise if traffic, logs, bandwidth or database compute increase.

### Scenario B: small production

Target:

- Around 10-100 users.
- Real custom domain.
- Real password recovery email.
- Real Mercado Pago checkout tests or limited paid usage.

Estimated monthly cost:

- Frontend: Vercel Pro if production/team usage requires it, `20 USD+`.
- Backend: Render paid web service, roughly `7-25 USD+` depending on plan.
- Database: Neon Launch usage-based, Supabase Pro from `25 USD`, Render
  Postgres small paid plan or another managed PostgreSQL plan.
- SMTP: `0-20 USD`.
- Domain: separate annual cost.

Practical range:

- `35-90 USD/month` before taxes and domain.

Limitations:

- Small backend memory can become the first constraint.
- Connection limits can appear before CPU limits on small databases.
- Billing/webhook reliability matters more than raw traffic volume.
- Manual log review is still acceptable, but request IDs must be captured when
  users report problems.

### Scenario C: growing users

Target:

- Hundreds of active users.
- More frequent dashboard usage.
- More support/debugging needs.
- Higher payment volume.

Estimated monthly cost:

- Frontend: Vercel Pro or equivalent, `20 USD+`, plus usage if limits are
  exceeded.
- Backend: larger Render compute or multiple instances, roughly `25-100 USD+`.
- Database: larger Neon/Supabase/managed PostgreSQL plan, roughly
  `25-150 USD+` depending on compute, storage and backups.
- SMTP: `10-50 USD+`.
- Optional observability/log retention later: provider-dependent.

Practical range:

- `80-300 USD/month` before taxes and domain.

Limitations:

- At this point, add monitoring and alerting before scaling product scope.
- Review database indexes and slow queries from real usage.
- Consider connection pooling if database connections become noisy.
- Consider a worker/cron only after a concrete recurring job exists.

## 4. Recommended initial stack

### First 10 users

Recommended stack:

- Frontend: Vercel.
- Backend: Render paid web service.
- Database: Neon Launch PostgreSQL.
- SMTP: any reputable SMTP provider with TLS and a low-volume starter/free
  tier.
- Billing: Mercado Pago configured only on the backend.

Why:

- Fits the existing React/Vite and FastAPI layout with little operational work.
- Keeps the backend always reachable for auth, password recovery and webhooks.
- Avoids managing servers directly.
- Keeps the database managed and PostgreSQL-compatible.
- Starts with low monthly cost while still being safer than free expiring
  databases.

Estimated monthly cost:

- `10-30 USD/month` for a very small beta if Vercel Hobby is acceptable and
  database usage stays low.
- Move to Vercel Pro or a higher backend/database plan as soon as provider terms,
  collaboration needs or usage require it.

### First 100 users

Recommended stack:

- Frontend: Vercel Pro or equivalent paid static hosting.
- Backend: Render paid web service, upgraded if memory or latency requires it.
- Database: Neon Launch with monitored compute/storage, or Supabase Pro if a
  fixed package with included backups/support is preferred.
- SMTP: paid starter plan if password recovery becomes important.
- Billing: Mercado Pago production credentials and webhook secret.

Why:

- Still simple enough for one operator.
- Keeps frontend and backend separated.
- Avoids premature Kubernetes, container orchestration or cloud IAM complexity.
- Lets GanhoCerto learn from beta behavior before committing to heavier
  infrastructure.

Estimated monthly cost:

- `35-90 USD/month` for small production.
- Budget more if choosing Supabase Pro plus Vercel Pro plus a larger backend
  instance.

## 5. Final decision

Use this stack for the first real deployment unless a provider-specific account,
region or payment limitation blocks it:

```text
Frontend: Vercel
Backend: Render paid web service
Database: Neon Launch PostgreSQL
Email: SMTP provider with TLS
Billing: Mercado Pago backend-only checkout and webhook
Domain/DNS: any reliable registrar/DNS provider with HTTPS support
```

Operational rules:

- No real users on expiring free PostgreSQL.
- No real users on a sleeping backend if Mercado Pago webhooks are enabled.
- Keep provider spending alerts enabled.
- Keep production secrets only in provider environment settings.
- Run Alembic migrations before public traffic.
- Run the smoke tests in `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` after deploy.

Decision revisit triggers:

- Monthly infra cost exceeds `100 USD` without clear user growth.
- Backend memory pressure, slow responses or webhook failures appear.
- Database connection limits, cold starts or slow queries affect real users.
- More than one operator needs production access.
- Users need stronger uptime expectations than a closed beta.
