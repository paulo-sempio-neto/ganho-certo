# Roteiro de teste da beta fechada

Use este roteiro com cada tester da beta. A ideia e validar o fluxo real, anotar
friccoes e coletar feedback sem transformar o teste em suporte tecnico longo.

## Antes de comecar

- Confirme qual dispositivo e navegador o tester vai usar.
- Informe a URL publica do frontend.
- Combine que problemas devem ser enviados pelo botao `Enviar feedback da beta`
  no menu `Mais`.
- Se houver erro, peca horario aproximado, acao executada, mensagem exibida e,
  quando aparecer, o `request_id`.

## Conta e primeiro acesso

- [ ] Criar uma conta nova com nome, email e senha.
- [ ] Fazer login com a conta criada.
- [ ] Confirmar que a tela mostra a orientacao de proximo passo.
- [ ] Abrir o menu `Mais` e verificar email, plano atual e botao de feedback.
- [ ] Fazer logout e login novamente.

## Primeiro setup

- [ ] Cadastrar o primeiro veiculo.
- [ ] Confirmar que o app nao pede informacoes excessivas para comecar.
- [ ] Registrar o primeiro dia em `Registrar meu dia`.
- [ ] Confirmar que o resultado parcial aparece apos salvar.
- [ ] Adicionar um gasto do dia, como combustivel ou recarga.
- [ ] Abrir o dashboard e conferir se os numeros principais fazem sentido para o tester.

## Uso diario

- [ ] Registrar mais um dia com data diferente.
- [ ] Editar uma jornada cadastrada.
- [ ] Excluir uma jornada de teste, se o tester criou uma entrada claramente errada.
- [ ] Adicionar uma despesa recorrente relevante, se fizer sentido para o tester.
- [ ] Configurar custos do veiculo para melhorar a estimativa.
- [ ] Verificar se mensagens de erro ou campos obrigatorios sao compreensiveis.

## Historico e recursos Pro

- [ ] Abrir historico/evolucao depois de ter ao menos alguns registros.
- [ ] Verificar se estados vazios explicam o que falta quando ainda nao ha dados.
- [ ] Tentar acessar recursos bloqueados no plano Free e confirmar que a mensagem
  explica a restricao.
- [ ] Se o tester estiver em Pro ou conta de teste Pro, validar historico avancado
  e padroes de trabalho.

## Importacao CSV

- [ ] Testar preview de importacao de jornadas com um CSV pequeno.
- [ ] Testar preview de importacao de despesas com um CSV pequeno.
- [ ] Conferir se o mapeamento sugerido faz sentido.
- [ ] Confirmar que linhas invalidas mostram erro compreensivel.
- [ ] Confirmar que reimportar o mesmo arquivo nao duplica registros.

## Fluxo Pro

- [ ] Abrir `Mais` e conferir o plano atual.
- [ ] Iniciar checkout Pro, se a conta de teste estiver autorizada para isso.
- [ ] Confirmar que voltar/cancelar nao ativa Pro.
- [ ] Confirmar que o app informa que a assinatura depende da confirmacao do pagamento.
- [ ] Depois do webhook aprovado, confirmar que o plano aparece como Pro.
- [ ] Reenviar o mesmo evento no ambiente de teste e confirmar idempotencia.

## Feedback

- [ ] Enviar um feedback de tipo `Algo confuso`.
- [ ] Enviar um feedback de tipo `Problema` se algum erro real acontecer.
- [ ] Conferir no banco se o feedback foi salvo em `beta_feedback`.
- [ ] Conferir no resumo interno se `feedback_count` aumentou.

## Checagem operacional apos a sessao

- [ ] Consultar logs pelo horario/request ID se houve falha.
- [ ] Verificar `/health` e `/ready` no backend publicado.
- [ ] Consultar `/internal/beta/summary` com `X-Beta-Admin-Token`.
- [ ] Revisar eventos esperados em `product_events`:
  - `account_created`
  - `first_vehicle_created`
  - `first_financial_entry`
  - `first_workday_completed` apos a primeira jornada salva
  - `first_result_viewed` somente apos abrir o resultado com jornada em aba visivel
  - `checkout_started`, se houve checkout
  - `subscription_activated`, se houve webhook aprovado
  - `feedback_sent`
- [ ] Confirmar que eventos nao armazenam valores financeiros, senha, token ou email.
- [ ] Confirmar que carregar `/financial-summary` em segundo plano nao cria
  `first_result_viewed` nem novos eventos `dashboard_viewed`.

## Quando parar o teste

- Pare de convidar novos testers se houver perda de dados, ativacao indevida de
  Pro, falha de isolamento entre usuarios, cobranca inesperada ou erro recorrente
  sem diagnostico claro.
