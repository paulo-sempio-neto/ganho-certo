# Checklist de aprendizado da beta fechada

Use este documento para revisar o aprendizado da beta em pequenos lotes de
testers. O objetivo e entender onde o produto entrega valor, quais pontos
causam duvida e se existe interesse real no PRO.

## Antes de convidar um lote

- [ ] Definir o lote e a data de entrada dos testers.
- [ ] Registrar quantas contas foram convidadas.
- [ ] Confirmar que `/internal/beta/summary` esta acessivel somente com
      `X-Beta-Admin-Token`.
- [ ] Confirmar que o fluxo de feedback esta acessivel pelo menu `Mais`.
- [ ] Separar uma conta de teste para validar checkout sem misturar seus dados
      com os testers.

## O que observar

Registre os totais agregados por lote, sem copiar valores financeiros,
senhas, tokens ou dados pessoais desnecessarios.

### Ativacao

- [ ] **Conta criada:** total de `account_created`.
- [ ] **Primeiro veiculo:** total de `first_vehicle_created`.
- [ ] **Primeira jornada salva:** total de `first_workday_completed` e o total
      de usuarios com primeira jornada no resumo interno.
- [ ] **Primeiro resultado visto:** total de `first_result_viewed`.
- [ ] Calcular a taxa de ativacao do lote como usuarios do lote com primeiro
      resultado visto dividido pelo total de contas criadas no lote. O resumo
      interno mostra totais globais, nao filtra por lote; use uma consulta
      interna por data/usuarios do lote ou registre snapshots antes e depois.

### Retencao inicial

- [ ] Verificar quantos usuarios salvaram uma segunda jornada. Esta informacao
      vem da contagem de jornadas por usuario no banco interno; nao registrar
      o faturamento ou o resultado no relatorio.
- [ ] Verificar se o usuario voltou em outro dia para registrar uma jornada.
      Visitas repetidas ao resultado nao sao medidas pelos eventos atuais;
      confirme essa parte em conversa com o tester.
- [ ] Anotar onde o usuario parou: cadastro, veiculo, primeira jornada,
      primeiro resultado ou segunda jornada.
- [ ] Comparar a quantidade de usuarios com primeira e segunda jornada entre
      lotes, sem expor dados individuais.

### Clareza e confianca

- [ ] Registrar duvidas sobre campos, mensagens, historico, comparacoes e
      padroes de trabalho.
- [ ] Classificar cada relato no feedback como `Algo confuso`, `Problema`,
      `Ideia` ou `Outro`.
- [ ] Marcar prioridade e status no fluxo interno de feedback.
- [ ] Separar erro reproduzivel, dificuldade de entendimento e pedido de
      funcionalidade. Nao transformar toda sugestao em desenvolvimento.

### Interesse no PRO

- [ ] Contar `checkout_started` por lote.
- [ ] Contar `subscription_activated` somente quando o webhook confirmado
      tiver ativado a assinatura.
- [ ] Perguntar se o usuario abriu a pagina de plano, entendeu as limitacoes
      do FREE e identificou os beneficios reais do PRO. A visita a pagina de
      plano nao possui evento proprio.
- [ ] Confirmar que cancelamento, retorno do checkout ou pagamento pendente
      nunca foram interpretados como ativacao.

## Revisao por lote

- [ ] Revisar o resumo interno depois das primeiras sessoes.
- [ ] Revisar feedbacks recentes em `/internal/beta/feedback`.
- [ ] Agrupar os tres maiores pontos de confusao por frequencia e impacto.
- [ ] Escolher no maximo uma melhoria de clareza para avaliar no proximo lote.
- [ ] Registrar riscos que exigem parar novos convites: perda de dados,
      isolamento incorreto, ativacao indevida do PRO ou cobranca inesperada.

## Regras de privacidade

- Nao pedir senha, token, email completo ou dados de pagamento no feedback.
- Nao copiar valores de faturamento, gastos ou lucro para planilhas de beta.
- Usar somente contagens agregadas para o acompanhamento do lote.
- Consultar dados individuais apenas para diagnosticar um problema autorizado
  e apagar anotacoes locais depois da triagem.

## Fontes internas

- Resumo agregado: `/internal/beta/summary`.
- `users_with_first_result_viewed` conta eventos desde a instrumentacao; nao
  houve backfill de visualizacoes anteriores.
- Feedback para triagem: `/internal/beta/feedback`.
- Eventos internos: tabela `product_events`.
- Jornadas salvas para a segunda jornada: tabela `work_sessions`.
- Roteiro do tester: [`BETA_TEST_CHECKLIST.md`](BETA_TEST_CHECKLIST.md).
