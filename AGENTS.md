# AGENTS.md - GanhoCerto

Instruções permanentes para agentes Codex trabalhando neste projeto.

## Regras de trabalho

- Trabalhe de forma incremental, objetiva e econômica.
- Faça uma feature por vez.
- Não faça auditoria geral sem solicitação explícita.
- Não reestruture a arquitetura sem necessidade real.
- Não faça overengineering.
- Não refatore código funcional fora do escopo da tarefa.
- Não implemente funcionalidades além do escopo solicitado.
- Reutilize código existente antes de criar novas abstrações.
- Não adicione dependências pesadas sem justificativa clara.
- Execute apenas os checks relevantes à tarefa.
- Evite repetir comandos que já passaram ou não agregam nova informação.
- Após concluir uma tarefa, pare e aguarde nova instrução.

## Stack do projeto

- Preserve a arquitetura atual com FastAPI, PostgreSQL, SQLAlchemy, Alembic e React/TypeScript.
- Evite mudanças de stack, novos serviços ou reestruturações amplas sem pedido explícito.

## Dados, segurança e domínio

- Nunca versione secrets, credenciais, tokens ou arquivos `.env` reais.
- Valores monetários nunca devem usar `float` de forma inadequada; use `Decimal`, strings decimais ou centavos conforme o contexto.
- `user_id` deve ser derivado da autenticação no backend e nunca confiado ao frontend.
- Preserve isolamento de dados entre usuários em todas as consultas e mutações.
- Valide regras importantes no backend.
- Adicione testes relevantes para novas regras de negócio.

## Checks padrão

Backend:

- `pytest`
- `ruff`
- `mypy`

Frontend:

- `npm run build`
