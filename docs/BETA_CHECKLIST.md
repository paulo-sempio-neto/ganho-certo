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
- [ ] `ALLOWED_HOSTS` restrito aos hosts reais do backend/health check.
- [ ] `FRONTEND_BASE_URL` apontando para a URL pública real do frontend.
- [ ] `VITE_API_BASE_URL` apontando para a URL pública real do backend.
- [ ] SMTP configurado com TLS para recuperação de senha:
  - `SMTP_HOST`
  - `SMTP_FROM_EMAIL`
  - `SMTP_USERNAME` e `SMTP_PASSWORD`, se o provedor exigir autenticação.
- [ ] Mercado Pago configurado se a beta aceitar pagamento real:
  - `BILLING_PROVIDER=mercado_pago`
  - `BILLING_PRO_MONTHLY_AMOUNT`
  - `BILLING_CURRENCY_ID=BRL`
  - `MERCADOPAGO_ACCESS_TOKEN`
  - `MERCADOPAGO_WEBHOOK_SECRET`
- [ ] Webhook do Mercado Pago apontando para `/billing/webhook`.
- [ ] Segredo do webhook no provedor igual ao `MERCADOPAGO_WEBHOOK_SECRET`.
- [ ] Migrações Alembic aplicadas com sucesso.
- [ ] `/health` confirmado no backend publicado.
- [ ] `/ready` confirmado no backend publicado depois das migrações.
- [ ] `BETA_ADMIN_TOKEN` forte configurado somente se o resumo interno da beta
  for usado. Deixe vazio para desabilitar `/internal/beta/summary`.
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
- Acessar `/ready` no backend publicado e confirmar resposta `{"status":"ready"}`.

## Billing safety

- O frontend chama apenas `/billing/checkout` para receber a URL de checkout.
- O checkout cria a preapproval no Mercado Pago, mas não ativa o Pro localmente.
- A ativação do Pro depende de webhook assinado, consulta ao provedor e status
  ativo/autorizado da assinatura.
- Eventos duplicados são ignorados por `provider` + `external_event_id`.
- Assinaturas canceladas, pausadas ou expiradas cancelam a assinatura local quando
  o provedor envia esse estado.
- Não crie rota administrativa pública para ativar plano durante a beta. O backend
  deve continuar sendo a fonte da verdade para plano, assinatura e entitlements.

## Aprendizado da beta

- O app coleta feedback autenticado em `/feedback`, gravado em `beta_feedback`
  com usuario, categoria, mensagem, caminho da tela e user agent resumido.
- Feedbacks possuem `priority`, `status` e `resolved_at` para triagem simples.
  Valores monetarios explicitos no texto (`R$ ...`) sao removidos antes de salvar.
- O app registra eventos internos em `product_events` sem valores financeiros,
  senhas, tokens, email ou payload livre. Eventos de marco usam dedupe por usuario.
- O resumo agregado `/internal/beta/summary` exige `X-Beta-Admin-Token` igual ao
  `BETA_ADMIN_TOKEN`; sem token configurado, o endpoint fica indisponivel.
- A visao interna `/internal/beta/feedback` mostra total, abertos, contagens por
  categoria/status/prioridade e feedbacks recentes. Use `PATCH
  /internal/beta/feedback/{id}` para alterar categoria, prioridade ou status.
- Revise feedbacks pelo banco durante a beta pequena; ainda nao ha painel interno
  nem integracao externa de suporte.
- Eventos uteis para acompanhar manualmente nesta fase:
  - conta criada;
  - primeiro veiculo cadastrado;
  - primeiro dia financeiro registrado;
  - primeiro gasto registrado;
  - checkout Pro iniciado;
  - assinatura Pro ativada por webhook;
  - feedback enviado.
- Nao instalar analytics externo ate haver necessidade clara e politica de
  privacidade revisada para a beta.

## Operacao em producao

- `/health` confirma que o processo responde, sem consultar o banco.
- `/ready` executa `SELECT 1`: retorna 200 (`ready`) ou 503 (`unavailable`) se o
  banco falhar. Use esse endpoint na verificacao de prontidao do host. Ele nao
  verifica migracoes nem a disponibilidade do SMTP. Conexao e espera por uma
  conexao do pool usam limites de 5 segundos; nao ha retry por operacao.
- `python -m app.server` envia logs JSON da API para stderr. Cada requisicao,
  inclusive preflight/erros, registra timestamp, nivel, request ID, metodo,
  template da rota, status e duracao. O access log padrao do Uvicorn fica
  desativado para nao registrar tokens presentes na query string.
- Peça o `X-Request-ID` e horario de uma falha ao usuario e busque `request_id`
  nos logs do provedor. O header fica exposto ao frontend via CORS. IDs recebidos
  aceitam apenas 1–64 caracteres ASCII alfanumericos, `_` e `-`; outros sao
  substituidos. IDs servem para correlacao, nunca para autorizar uma operacao.
- Erros inesperados registram tipo e frames da stack (arquivo, linha e funcao),
  sem mensagem da excecao, SQL, parametros, codigo-fonte ou variaveis locais.
  Respostas 500 continuam genericas e incluem request ID; uma falha de banco
  nao encerra o processo. Nao habilite SQL echo ou access logs com URLs completas.
- Configure `ALLOWED_HOSTS` com os nomes reais do backend e do health check,
  separados por virgula, sem esquema, porta ou wildcard. Host desconhecido recebe 400.
- Configure `FORWARDED_ALLOW_IPS` somente com IPs/CIDRs dos proxies que realmente
  conectam ao processo. O Uvicorn resolve o IP; o limiter usa `request.client`,
  nunca le diretamente `X-Forwarded-For`. O padrao confia apenas em 127.0.0.1;
  valor vazio desabilita essa confianca. Em Render/outro host, confirme os peers
  com o provedor; nao use confianca universal. Se nao houver IP confiavel conhecido,
  os clientes atras do mesmo proxy compartilham o bucket de IP. Restrinja o acesso
  direto ao backend no provedor antes de confiar na rede do proxy.
- O limiter continua local ao processo, com memoria limitada e limpeza de entradas
  expiradas. Ao atingir a capacidade, novas chaves recebem 429 ate haver espaco;
  buckets ativos nao sao descartados para liberar tentativas. Use uma instancia e
  um worker inicialmente; multiplos workers/instancias nao compartilham limites.
- `MAX_REQUEST_BODY_BYTES` limita corpos nao CSV a 1 MiB por padrao, contando bytes
  reais mesmo sem Content-Length. As quatro rotas de upload CSV conservam sua
  validacao streaming de 1 MiB. Corpos excessivos recebem 413.
- A API envia `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`
  e `Permissions-Policy` desabilitando camera, microfone e geolocalizacao.
  Esses headers protegem respostas da API; nao definem CSP do frontend. HTTPS/HSTS
  devem ser configurados no proxy que termina TLS.
- Producao exige origens HTTPS explicitas em `CORS_ALLOWED_ORIGINS` e
  `FRONTEND_BASE_URL`, PostgreSQL sem a senha de exemplo, secret JWT forte,
  `ALLOWED_HOSTS` explicito e SMTP com TLS para recuperacao de senha. Credenciais
  SMTP devem ser fornecidas em par quando necessarias. CORS nao habilita cookies:
  a autenticacao atual envia Bearer no header Authorization. Configuracao invalida
  falha na inicializacao sem imprimir os valores sensiveis.

## AFTER DEPLOY

- [ ] Seguir o roteiro de teste em [`docs/BETA_TEST_CHECKLIST.md`](BETA_TEST_CHECKLIST.md)
  com pelo menos uma conta de teste antes de convidar usuarios reais.
- [ ] Registrar uma conta de teste da beta.
- [ ] Fazer login.
- [ ] Criar um veículo.
- [ ] Registrar uma jornada.
- [ ] Adicionar uma despesa.
- [ ] Verificar o dashboard financeiro.
- [ ] Iniciar checkout Pro com conta de teste.
- [ ] Confirmar que o plano segue Free antes do webhook aprovado.
- [ ] Confirmar que webhook aprovado ativa Pro.
- [ ] Reenviar o mesmo evento e confirmar comportamento idempotente.
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
- Analytics.
- Serviços externos de monitoramento.
