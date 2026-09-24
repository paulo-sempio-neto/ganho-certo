# Checklist de beta fechada

Checklist operacional mínimo antes de convidar usuários reais para a beta fechada do GanhoCerto.

## BEFORE FIRST REAL USER

- [ ] PostgreSQL gerenciado provisionado.
- [ ] Backup automático do banco habilitado.
- [ ] Retenção do backup confirmada no provedor.
- [ ] Um teste de restore executado com sucesso em ambiente seguro.
- [ ] `APP_ENV=production` configurado no backend.
- [ ] `JWT_SECRET` forte, aleatório e exclusivo do ambiente de produção.
- [ ] `DATABASE_URL` apontando para o PostgreSQL de produção.
- [ ] `CORS_ALLOWED_ORIGINS` restrito à origem real do frontend.
- [ ] `VITE_API_BASE_URL` apontando para a URL pública real do backend.
- [ ] Migrações Alembic aplicadas com sucesso.
- [ ] `/health` confirmado no backend publicado.
- [ ] Build de produção do frontend confirmado.
- [ ] Limites de autenticação revisados para a beta:
  - `AUTH_LOGIN_RATE_LIMIT`
  - `AUTH_LOGIN_IP_RATE_LIMIT`
  - `AUTH_LOGIN_RATE_WINDOW_SECONDS`
  - `AUTH_REGISTER_RATE_LIMIT`
  - `AUTH_REGISTER_RATE_WINDOW_SECONDS`
  - `AUTH_RATE_LIMIT_MAX_ENTRIES`

O rate limit atual é em memória e por processo. Ele é intencionalmente simples para a beta
fechada atual; se o backend passar a rodar com múltiplos processos/instâncias ou tráfego
público amplo, substitua por uma proteção compartilhada entre instâncias.

## DEPLOY PROCEDURE

Backend:

- Build command: `python -m pip install -e .`
- Migration/release command: `python -m alembic upgrade head`
- Start command: `python -m app.server`

Frontend:

- Configurar `VITE_API_BASE_URL` com a URL pública do backend.
- Executar o build de produção antes de publicar.

Verificação:

- Acessar `/health` no backend publicado e confirmar resposta `{"status":"ok"}`.

## AFTER DEPLOY

- [ ] Registrar uma conta de teste da beta.
- [ ] Fazer login.
- [ ] Criar um veículo.
- [ ] Registrar uma jornada.
- [ ] Adicionar uma despesa.
- [ ] Verificar o dashboard financeiro.
- [ ] Fazer logout e login novamente.
- [ ] Inspecionar os logs do host para erros inesperados.

## IF SOMETHING BREAKS

- Pare de convidar novos usuários se houver dúvida sobre integridade dos dados.
- Capture request ID, horário aproximado e mensagem exibida ao usuário.
- Inspecione os logs do host usando o request ID/horário.
- Verifique conectividade com o banco.
- Verifique se a revisão Alembic aplicada é a esperada.
- Restaure backup somente quando necessário e depois de entender o impacto nos dados já gravados.

## Itens deixados para depois desta fase

- Recuperação de senha.
- Redesign global de paginação.
- Migração para cookies `HttpOnly`.
- Lint tooling no frontend.
- Timeout genérico no `fetch`.
- Assinaturas/pagamentos.
- Analytics.
- Serviços externos de monitoramento.
