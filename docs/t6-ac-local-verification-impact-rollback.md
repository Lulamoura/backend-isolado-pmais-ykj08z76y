# T6.AC.1–T6.AC.6 — verificação local, impacto e rollback

Data: 2026-08-23
Escopo: branch local `feature/t6-ac-reconciliation-local`, base `2da4e0e`
Estado externo: sem push, SKIP, ativação, chamada ao ActiveCampaign, dado real ou Produção.

## Resultado implementado

- contrato de autoridade e envelope V1;
- processador/reconciliador administrativo com consulta AC exclusivamente no backend;
- reconciliação em duas fases `Simular → fingerprint → Executar`;
- nova leitura/fingerprint imediatamente antes da transação;
- lock global, chave de comando idempotente, cursor confirmado apenas no commit e replay canônico;
- empresa, contato e negócio materializados na ordem de dependência;
- vínculo externo, responsável e alias de etapa obrigatórios;
- divergências bloqueantes registradas como ocorrência;
- Entrada manual bloqueada no backend e ocultada na interface para não-superadministradores;
- contingência do Superadministrador com justificativa, confirmação literal e auditoria.

## Travas preservadas

- `ac_webhook.js` continua com `WEBHOOK_ENABLED = false`;
- o reconciliador responde `RECONCILIACAO_DESABILITADA` enquanto o parâmetro
  `ac_reconciliation_enabled` não existir ou não estiver ativo com valor `true`;
- segredos `AC_API_URL`, `AC_API_KEY` e `PB_INSTANCE_URL` são lidos apenas no backend;
- a interface não recebe token, segredo nem resposta bruta do ActiveCampaign;
- paginação tem limite fechado de 20 páginas de 50 registros e falha fechada quando excedido.

## Evidências locais

- contrato/guardas estáticos T6.AC: 19/19;
- núcleo determinístico: 13/13;
- regressões Vitest: 96/96 em 16 arquivos;
- regressões comerciais existentes: aprovadas;
- TypeScript `--noEmit`: aprovado;
- sintaxe dos hooks: aprovada;
- Oxfmt: aprovado;
- build Vite: aprovado;
- `git diff --check`: aprovado;
- varredura de segredos no frontend: zero ocorrência.

O aviso de bundle acima de 500 kB já é não bloqueante e não foi introduzido como erro funcional.

## Impacto do próximo gate remoto

Publicar o pacote no candidato adicionará código e interface, mas não fará sincronização por si só.
Antes de qualquer ativação, o candidato deverá possuir os parâmetros inativos
`ac_reconciliation_enabled=false` e `ac_reconciliation_cursor`, além dos vínculos de responsáveis e
aliases homologados. O webhook continuará desligado até gate próprio.

## Rollback

1. manter `ac_reconciliation_enabled=false`;
2. reverter o commit único do pacote na branch candidata;
3. sincronizar uma única vez somente após autorização e conferência da versão do Preview;
4. confirmar novamente no conteúdo remoto que o merge automático do SKIP não reintroduziu arquivos;
5. se já houver dry-runs, preservá-los como auditoria; eles não alteram dados comerciais;
6. não apagar vínculos, eventos ou execuções sem plano de compensação específico.

O rollback não depende de migração destrutiva nem de alteração de Produção.
