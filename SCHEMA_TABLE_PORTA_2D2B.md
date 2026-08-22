# Schema Table — Porta 2D.2B Audit Fields

**Source:** `src/lib/pocketbase/schema.json` (local inspection) + live database schema context.

Every field below is used in filters or sanitization within `ac_audit_round_2d2b.js`. Each entry cites the local inspected source.

## com_contatos

| Field      | Type                          | Required | Source                                        |
| ---------- | ----------------------------- | -------- | --------------------------------------------- |
| email      | text                          | false    | schema.json → com_contatos.fields[email]      |
| nome       | text                          | true     | schema.json → com_contatos.fields[nome]       |
| empresa_id | relation → com_empresas       | false    | schema.json → com_contatos.fields[empresa_id] |
| ativo      | bool                          | false    | schema.json → com_contatos.fields[ativo]      |
| created    | autodate (onCreate)           | false    | schema.json → com_contatos.fields[created]    |
| updated    | autodate (onCreate, onUpdate) | false    | schema.json → com_contatos.fields[updated]    |

**Used in:** `filters['com_contatos']` — `email ~ PATTERN`, `nome ~ PATTERN`. `sanitize()` — `ativo`, `empresa_id`.

## com_negocios

| Field                | Type                                              | Required | Source                                                  |
| -------------------- | ------------------------------------------------- | -------- | ------------------------------------------------------- |
| titulo               | text                                              | true     | schema.json → com_negocios.fields[titulo]               |
| etapa                | select (prospects, producao_proposta, negociacao) | false    | schema.json → com_negocios.fields[etapa]                |
| inativo              | bool                                              | false    | schema.json → com_negocios.fields[inativo]              |
| empresa_id           | relation → com_empresas                           | false    | schema.json → com_negocios.fields[empresa_id]           |
| contato_principal_id | relation → com_contatos                           | false    | schema.json → com_negocios.fields[contato_principal_id] |
| created              | autodate (onCreate)                               | false    | schema.json → com_negocios.fields[created]              |
| updated              | autodate (onCreate, onUpdate)                     | false    | schema.json → com_negocios.fields[updated]              |

**Used in:** `filters['com_negocios']` — `titulo ~ PATTERN`. `sanitize()` — `etapa`, `inativo`, `empresa_id`, `contato_principal_id`.

## com_eventos_integracao

| Field           | Type                          | Required | Source                                                       |
| --------------- | ----------------------------- | -------- | ------------------------------------------------------------ |
| external_id     | text                          | false    | schema.json → com_eventos_integracao.fields[external_id]     |
| evento_tipo     | text                          | false    | schema.json → com_eventos_integracao.fields[evento_tipo]     |
| status          | text                          | false    | schema.json → com_eventos_integracao.fields[status]          |
| sistema_origem  | text                          | false    | schema.json → com_eventos_integracao.fields[sistema_origem]  |
| idempotency_key | text                          | true     | schema.json → com_eventos_integracao.fields[idempotency_key] |
| payload         | text                          | false    | schema.json → com_eventos_integracao.fields[payload]         |
| created         | autodate (onCreate)           | false    | schema.json → com_eventos_integracao.fields[created]         |
| updated         | autodate (onCreate, onUpdate) | false    | schema.json → com_eventos_integracao.fields[updated]         |

**Used in:** `filters['com_eventos_integracao']` — `external_id ~ PATTERN`. `extIdFilter()` — `external_id`. Directed queries: `evento_tipo = 'contact_create'`, `evento_tipo = 'deal_create'`, `evento_tipo = 'deal_update'`, `evento_tipo = 'rollback'`. `sanitize()` — `evento_tipo`, `external_id`, `status`, `sistema_origem`.

## com_execucoes_sincronizacao

| Field          | Type                          | Required | Source                                                           |
| -------------- | ----------------------------- | -------- | ---------------------------------------------------------------- |
| payload        | text                          | false    | schema.json → com_execucoes_sincronizacao.fields[payload]        |
| status         | text                          | false    | schema.json → com_execucoes_sincronizacao.fields[status]         |
| sistema_origem | text                          | false    | schema.json → com_execucoes_sincronizacao.fields[sistema_origem] |
| inicio         | date                          | false    | schema.json → com_execucoes_sincronizacao.fields[inicio]         |
| fim            | date                          | false    | schema.json → com_execucoes_sincronizacao.fields[fim]            |
| erro           | text                          | false    | schema.json → com_execucoes_sincronizacao.fields[erro]           |
| created        | autodate (onCreate)           | false    | schema.json → com_execucoes_sincronizacao.fields[created]        |
| updated        | autodate (onCreate, onUpdate) | false    | schema.json → com_execucoes_sincronizacao.fields[updated]        |

**Used in:** `filters['com_execucoes_sincronizacao']` — `payload ~ PATTERN`. `payloadExtIdFilter()` — `payload`. `sanitize()` — `status`, `sistema_origem`, `inicio`, `fim`.

## com_vinculos_externos

| Field           | Type                          | Required | Source                                                      |
| --------------- | ----------------------------- | -------- | ----------------------------------------------------------- |
| external_id     | text                          | true     | schema.json → com_vinculos_externos.fields[external_id]     |
| external_type   | text                          | true     | schema.json → com_vinculos_externos.fields[external_type]   |
| collection_name | text                          | false    | schema.json → com_vinculos_externos.fields[collection_name] |
| record_id       | text                          | false    | schema.json → com_vinculos_externos.fields[record_id]       |
| sistema_origem  | text                          | true     | schema.json → com_vinculos_externos.fields[sistema_origem]  |
| created         | autodate (onCreate)           | false    | schema.json → com_vinculos_externos.fields[created]         |
| updated         | autodate (onCreate, onUpdate) | false    | schema.json → com_vinculos_externos.fields[updated]         |

**Used in:** `filters['com_vinculos_externos']` — `external_id ~ PATTERN`. `extIdFilter()` — `external_id`. Directed queries: `collection_name = 'com_contatos'`, `collection_name = 'com_negocios'`. `sanitize()` — `external_type`, `external_id`, `collection_name`, `record_id`, `sistema_origem`.

## com_snapshots_negocio

| Field      | Type                          | Required | Source                                                 |
| ---------- | ----------------------------- | -------- | ------------------------------------------------------ |
| snapshot   | text                          | false    | schema.json → com_snapshots_negocio.fields[snapshot]   |
| negocio_id | relation → com_negocios       | true     | schema.json → com_snapshots_negocio.fields[negocio_id] |
| origem     | text                          | false    | schema.json → com_snapshots_negocio.fields[origem]     |
| created    | autodate (onCreate)           | false    | schema.json → com_snapshots_negocio.fields[created]    |
| updated    | autodate (onCreate, onUpdate) | false    | schema.json → com_snapshots_negocio.fields[updated]    |

**Used in:** `filters['com_snapshots_negocio']` — `snapshot ~ PATTERN`. Directed query: `negocio_id = '...'`. `sanitize()` — `negocio_id`, `origem`.

## com_ocorrencias_qualidade

| Field       | Type                                   | Required | Source                                                      |
| ----------- | -------------------------------------- | -------- | ----------------------------------------------------------- |
| descricao   | text                                   | false    | schema.json → com_ocorrencias_qualidade.fields[descricao]   |
| execucao_id | relation → com_execucoes_sincronizacao | false    | schema.json → com_ocorrencias_qualidade.fields[execucao_id] |
| tipo        | text                                   | false    | schema.json → com_ocorrencias_qualidade.fields[tipo]        |
| severidade  | text                                   | false    | schema.json → com_ocorrencias_qualidade.fields[severidade]  |
| resolvida   | bool                                   | false    | schema.json → com_ocorrencias_qualidade.fields[resolvida]   |
| created     | autodate (onCreate)                    | false    | schema.json → com_ocorrencias_qualidade.fields[created]     |
| updated     | autodate (onCreate, onUpdate)          | false    | schema.json → com_ocorrencias_qualidade.fields[updated]     |

**Used in:** `filters['com_ocorrencias_qualidade']` — `descricao ~ PATTERN`. Directed query: `execucao_id = '...'`. `sanitize()` — `tipo`, `severidade`, `resolvida`, `execucao_id`.

## com_auditoria

| Field            | Type                                        | Required | Source                                               |
| ---------------- | ------------------------------------------- | -------- | ---------------------------------------------------- |
| valor_anterior   | text                                        | false    | schema.json → com_auditoria.fields[valor_anterior]   |
| valor_novo       | text                                        | false    | schema.json → com_auditoria.fields[valor_novo]       |
| acao             | select (create, update, inactivate, delete) | true     | schema.json → com_auditoria.fields[acao]             |
| collection_name  | text                                        | true     | schema.json → com_auditoria.fields[collection_name]  |
| record_id        | text                                        | true     | schema.json → com_auditoria.fields[record_id]        |
| origem_alteracao | text                                        | false    | schema.json → com_auditoria.fields[origem_alteracao] |
| justificativa    | text                                        | false    | schema.json → com_auditoria.fields[justificativa]    |
| usuario_id       | relation → users                            | false    | schema.json → com_auditoria.fields[usuario_id]       |
| created          | autodate (onCreate)                         | false    | schema.json → com_auditoria.fields[created]          |
| updated          | autodate (onCreate, onUpdate)               | false    | schema.json → com_auditoria.fields[updated]          |

**Used in:** `filters['com_auditoria']` — `valor_anterior ~ PATTERN`, `valor_novo ~ PATTERN`. `sanitize()` — `acao`, `collection_name` (as `audit_collection_name`), `record_id`, `origem_alteracao`. **NOT used for C1** (plan expects delta +0; `audit_negocios.js` uses `onRecordUpdateRequest` which does not fire on server-side `$app.save()`).

## com_parametros

| Field   | Type                          | Required | Source                                       |
| ------- | ----------------------------- | -------- | -------------------------------------------- |
| chave   | text                          | true     | schema.json → com_parametros.fields[chave]   |
| valor   | text                          | true     | schema.json → com_parametros.fields[valor]   |
| ativo   | bool                          | false    | schema.json → com_parametros.fields[ativo]   |
| tipo    | text                          | false    | schema.json → com_parametros.fields[tipo]    |
| versao  | number                        | true     | schema.json → com_parametros.fields[versao]  |
| created | autodate (onCreate)           | false    | schema.json → com_parametros.fields[created] |
| updated | autodate (onCreate, onUpdate) | false    | schema.json → com_parametros.fields[updated] |

**Used in:** `readParam()` — `chave = '...'`. Returns `valor`, `ativo`, `tipo`, `versao`, `created`, `updated`.
