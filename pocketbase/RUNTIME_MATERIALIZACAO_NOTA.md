# Materialização runtime — hook `com_propostas_operacao.js` (Preview)

Registro da operação de 2026-11-18, restrita ao Preview (Produção permanece na 0.0.693).

## Defeito observado

- POST autenticado real em `/backend/v1/nexo/curadoria/casos/consolidar` com `{"dry_run":true}`
  retornava HTTP 200 com `historical_untouched=11714`, mas **sem** `historical_snapshot` na
  resposta — o runtime do Preview executava a versão anterior do hook.
- A fonte em `origin/main` (commit `0ad86925d8edd0210c87ac4f0309a6e1ea47e30b`) já contém o campo:
  handler em `pocketbase/hooks/com_propostas_operacao.js` linha ~4947 (`var historicalSnapshot = {...}`)
  e resposta dry-run em linha ~5338 (`historical_snapshot: historicalSnapshot`), com
  `automatic_send_allowed: false` preservado (linhas 5342/5678) e corte imutável intacto.
- Divergência fonte↔runtime: a árvore local estava byte a byte igual a `origin/main`;
  o backend é que não tinha o hook materializado com o conteúdo atual.

## Correção aplicada

- Nenhuma edição no hook: os bytes da árvore seguem exatamente os de `origin/main` (`0ad86925`).
- Redeploy do backend (`deploy_backend`) para forçar a rematerialização do catálogo completo de
  hooks no Preview — recarga completa equivale à recarga do hook alvo, pois todos os hooks da
  árvore correspondem a `origin/main`.
- Logs JSVM do Preview após o reload: **sem erro de carregamento** de
  `com_propostas_operacao.js` (únicos erros nos logs são do job IPCP diário, pré-existentes e
  fora do escopo desta operação).

## Evidência parcial (rotulada)

- **Evidência parcial**: estado do deploy OK e registro de rotas intacto
  (`com_propostas_operacao` listando `POST /backend/v1/nexo/curadoria/casos/consolidar`).
- **Não comprovado nesta run**: o comportamento de ponta a ponta. O POST real autenticado com
  `dry_run=true` deve ser repetido pelo usuário; o critério de aceite é
  `historical_snapshot` preenchido (count = `historical_untouched`, `sha256` de 64 hex,
  `canonicalization` `id|occurred_at\n sorted by id; UTF-8; no trailing newline`).

## Restrições respeitadas

- Zero mutações de dados, schema, migrações, credenciais, webhooks, crons ou filas.
- `automatic_send_allowed=false`, corte imutável e captura passiva preservados (nenhum byte do
  hook foi alterado).
- Produção intocada.
