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

## Decisao de convite e responsaveis

A revisao do repositorio nao confirma o estado dos provedores. Antes do primeiro
lote, registrar URL publicada, commit implantado, responsavel operacional e data
das evidencias de smoke test em `BETA_CHECKLIST.md`. Nao marcar pronto apenas
porque os testes locais passaram.

- [ ] Definir quem recebe os relatos, quem pode consultar os endpoints internos
      e quem decide pausar os convites.
- [ ] Preencher o convite com URL, periodo do teste, canal alternativo de contato
      e prazo de resposta combinado. Nenhum token administrativo vai no convite.
- [ ] Informar se pagamentos estao desabilitados ou se existe um teste de checkout
      autorizado. Compra real nao e requisito para participar.
- [ ] Informar quais dados sao coletados, quem os acessa, por quanto tempo ficam
      guardados e como solicitar exclusao. Definir quem executa essas solicitacoes.
- [ ] Confirmar recuperacao de senha por email e abertura direta do link de reset
      na URL publicada, alem de backup com restore testado e migracoes aplicadas.
- [ ] Comecar com um lote pequeno acompanhado (sugestao: 3 a 5 motoristas) e revisar
      os relatos diariamente. Avaliar o retorno apos 2 e 7 dias antes de ampliar.

Se essas evidencias ou responsaveis faltarem, o produto pode ser avaliado em uma
sessao acompanhada, mas o convite para uso real sem acompanhamento deve aguardar.

## O que observar

Registre os totais agregados por lote, sem copiar valores financeiros,
senhas, tokens ou dados pessoais desnecessarios.

### Ativacao

- [ ] **Conta criada:** total de `account_created`.
- [ ] **Primeiro veiculo:** total de `first_vehicle_created`.
- [ ] **Primeira jornada salva:** total de `first_workday_completed` e o total
      de usuarios com primeira jornada no resumo interno.
- [ ] **Resumo completo exibido:** usuarios com `first_result_viewed`; nao equivale
      a todos os usuarios que viram o resultado parcial depois de salvar.
- [ ] Registrar separadamente, na sessao acompanhada, se o motorista viu e
      conseguiu explicar a sobra do primeiro dia sem ajuda.
- [ ] Calcular a taxa de primeira jornada como usuarios do lote com jornada salva
      dividido pelas contas criadas no lote. Separar convidados de contas criadas.
- [ ] Calcular a taxa de acesso observado ao resumo completo com
      `first_result_viewed` usando o mesmo lote e janela. Nao chamar essa taxa de
      compreensao do resultado nem usa-la sozinha como ativacao.
- [ ] Usar consulta interna restrita por usuarios/data do lote; o resumo mostra
      totais globais. Diferencas entre snapshots podem incluir usuarios antigos
      e exclusoes, portanto nao identificam com seguranca a conversao do lote.

### Retencao inicial

- [ ] Verificar quantos usuarios salvaram uma segunda jornada e quantos possuem
      jornadas em duas datas de trabalho distintas. Dois registros no mesmo dia
      nao comprovam retorno. Usar `created_at` para distinguir quando o registro
      foi feito de `work_date`, que pode representar trabalho de dias anteriores.
      A fonte e `work_sessions`; nao copiar faturamento ou resultado ao relatorio.
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

## Limites de medicao e triagem

- `first_result_viewed` observa o resumo completo em `ResultSection`, com jornada
  e tempo registrado, em aba visivel. O resultado parcial `daily-entry-result`,
  mostrado e focado logo apos salvar, nao possui esse observador. Uma pessoa pode
  entender a sobra sem gerar o evento; a exibicao tambem nao prova compreensao.
- A chamada desse evento pode falhar sem interromper o uso. Nao assumir que a
  ausencia do evento significa abandono; conferir a observacao da sessao.
- `active_users_7d` conta usuarios com algum evento nao legado nos ultimos 7 dias.
  Marcos sao deduplicados e jornadas seguintes nao geram novos marcos. Portanto,
  esse contador nao mede todos os motoristas ativos nem a retencao semanal.
- Para comparar retorno, excluir contas de smoke test e usar a mesma janela de
  acompanhamento. Um lote recente ainda sem 7 dias nao deve ser comparado como
  se tivesse a mesma oportunidade de retornar.
- A lista interna de feedback mostra apenas os 20 relatos mais recentes, sem
  busca ou paginacao. Revisar diariamente e registrar IDs/prioridade/acao; para
  relatos antigos, usar consulta interna autorizada, sem exportar mensagens em massa.
- `open_feedback` inclui `open` e `reviewing`. Usar o PATCH existente para triagem
  e confirmar a correcao com o tester antes de marcar `resolved`.
- O caminho anexado ao feedback pode ser apenas `/` ou uma ancora anterior.
  Pedir a tela e a acao em palavras; nao tratar esse campo como trilha de navegacao.
- Texto livre e capturas podem conter informacoes privadas. A remocao automatica
  de alguns valores monetarios nao e anonimizacao; orientar o tester e restringir
  o acesso aos relatos. Nao prometer que dados sensiveis serao sempre removidos.

## Confusoes para observar sem induzir respostas

- O cadastro termina na tela de login: o tester percebe que ainda precisa entrar?
- Ele encontra o registro do dia e entende que pode cadastrar o veiculo depois
  de preencher a jornada, sem perder os campos durante esse fluxo?
- Ele entende `8:30` e que apenas `8` significa oito horas, nao oito minutos?
- Ele confere data/veiculo sugeridos e percebe que valores financeiros nao sao
  repetidos automaticamente? O veiculo lembrado vale neste navegador e por conta.
- Ele distingue sobra apos gastos registrados de resultado estimado/projetado,
  inclusive quando ainda nao registrou combustivel ou outros gastos?
- Ele distingue o resultado parcial do registro do resumo com filtros de periodo
  e veiculo? Ao registrar uma data passada, entende a que dia o valor se refere?
- Ele encontra o menu `Mais`, o feedback e os detalhes expansiveis sem ajuda?
- Ele diferencia falta de dados nos dois periodos de uma restricao do plano FREE?
- Em falha de rede apos salvar, ele confere `Minhas jornadas` antes de tentar
  novamente? Uma resposta perdida nao prova que o registro nao foi gravado.

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
