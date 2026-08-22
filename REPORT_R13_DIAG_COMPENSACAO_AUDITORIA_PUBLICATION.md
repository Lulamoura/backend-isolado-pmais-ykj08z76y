# R13 Diagnóstico de Compensação — Auditoria Somente-Leitura (v4)

## Relatório de Publicação v4

### Versões Concretas

| Item                  | Versão                                                |
| --------------------- | ----------------------------------------------------- |
| Backend hook          | `ac_diag_compensacao_auditoria`                       |
| Backend route version | `R13-DIAG-COMPENSACAO-AUDITORIA-20260812-v3`          |
| Frontend bundle       | `R13-DIAG-COMPENSACAO-AUDITORIA-FRONTEND-20260812-v4` |

### Rota Somente-Leitura

```
GET /backend/v1/integracao/ac/diag-compensacao-auditoria
```

### Declarações Explícitas

| Declaração            | Valor   |
| --------------------- | ------- |
| audit_route_executed  | `false` |
| compensation_executed | `false` |
| records_created       | `0`     |
| records_updated       | `0`     |
| records_deleted       | `0`     |
| locks_modified        | `0`     |
| activecampaign_calls  | `0`     |
| external_calls        | `0`     |

### Confirmações

| Campo                      | Valor          |
| -------------------------- | -------------- |
| execution_enabled          | `true`         |
| button_enabled             | `true`         |
| executed                   | `false`        |
| deletion_executed          | não verificado |
| v7 lock state              | `armed`        |
| data writes                | não verificado |
| ActiveCampaign calls       | não verificado |
| external calls             | não verificado |
| locks consumed             | `0`            |
| locks modified             | não verificado |
| client parameters accepted | `0`            |

### IDs Fixos

| Coleção                       | ID                |
| ----------------------------- | ----------------- |
| `com_vinculos_externos`       | `phzmobi8mfb34ha` |
| `com_eventos_integracao`      | `pq4npvruaak9gpb` |
| `com_execucoes_sincronizacao` | `62otoics23ul0vy` |

### Consultas, Filtros, Limites e Campos Retornados

| #   | Coleção                       | Método API                   | Filtro / ID                                     | Limite | Campos Retornados                                                                   |
| --- | ----------------------------- | ---------------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| 1   | `com_vinculos_externos`       | `$app.findRecordById`        | id = `phzmobi8mfb34ha`                          | n/a    | id, created, collection_name, external_id, external_type, record_id, sistema_origem |
| 2   | `com_eventos_integracao`      | `$app.findRecordById`        | id = `pq4npvruaak9gpb`                          | n/a    | id, created, evento_tipo, external_id, idempotency_key, sistema_origem, status      |
| 3   | `com_execucoes_sincronizacao` | `$app.findRecordById`        | id = `62otoics23ul0vy`                          | n/a    | id, created, inicio, fim, sistema_origem, status                                    |
| 4   | `com_ocorrencias_qualidade`   | `$app.findRecordsByFilter`   | `execucao_id = "62otoics23ul0vy"`               | 100    | id, execucao_id, tipo, severidade, descricao, resolvida, created                    |
| 5   | `com_vinculos_externos`       | `$app.countRecords`          | n/a                                             | n/a    | count                                                                               |
| 6   | `com_eventos_integracao`      | `$app.countRecords`          | n/a                                             | n/a    | count                                                                               |
| 7   | `com_execucoes_sincronizacao` | `$app.countRecords`          | n/a                                             | n/a    | count                                                                               |
| 8   | `com_ocorrencias_qualidade`   | `$app.countRecords`          | n/a                                             | n/a    | count                                                                               |
| 9   | `com_parametros`              | `$app.findFirstRecordByData` | chave = `ac_diag_compensacao_dependencias_lock` | n/a    | valor (lock state)                                                                  |

### Identidades Esperadas (validadas no handler)

**com_vinculos_externos (`phzmobi8mfb34ha`)**:

- `created`: `2026-08-11T20:38:39.951Z`
- `collection_name`: `com_contatos`
- `external_id`: `DIAG-TRANSPORT-FN-C1`
- `external_type`: `contact`
- `record_id`: `hfjq2q1olefske7`
- `sistema_origem`: `activecampaign`

**com_eventos_integracao (`pq4npvruaak9gpb`)**:

- `created`: `2026-08-11T20:38:39.950Z`
- `evento_tipo`: `contact_create`
- `external_id`: `DIAG-TRANSPORT-FN-C1`
- `idempotency_key`: `e860fa5a9d8615c44a7db52b909b70b816f80b74123b96780e7bb309e53d34ec`
- `sistema_origem`: `activecampaign`
- `status`: `processed`

**com_execucoes_sincronizacao (`62otoics23ul0vy`)**:

- `created`: `2026-08-11T20:38:39.948Z`
- `inicio`: `2026-08-11T20:38:39.948Z`
- `fim`: `2026-08-11T20:38:39.952Z`
- `sistema_origem`: `activecampaign`
- `status`: `completed`

### Campos JSON de Resposta (v3 — backend não modificado)

| Campo                        | Descrição                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `route_version`              | `R13-DIAG-COMPENSACAO-AUDITORIA-20260812-v3`                                                                                                   |
| `route`                      | Caminho da rota                                                                                                                                |
| `method`                     | `GET`                                                                                                                                          |
| `read_only`                  | `true`                                                                                                                                         |
| `client_parameters_accepted` | `0`                                                                                                                                            |
| `query_succeeded`            | `true` se todas as leituras sucederam, `false` em caso de erro                                                                                 |
| `target_identity_verified`   | Objeto per-record `{ com_vinculos_externos, com_eventos_integracao, com_execucoes_sincronizacao }` com `true`/`false`; `false` simples em erro |
| `target_identity_details`    | Valores reais lidos de cada registro                                                                                                           |
| `expected_identity`          | Identidades literais esperadas                                                                                                                 |
| `fixed_ids`                  | IDs fixos usados nas consultas                                                                                                                 |
| `involved_collections`       | Lista de coleções envolvidas                                                                                                                   |
| `dependency_query_succeeded` | `true` se a query de dependência sucedeu                                                                                                       |
| `dependency_filter`          | `execucao_id = "62otoics23ul0vy"`                                                                                                              |
| `dependency_limit`           | `100`                                                                                                                                          |
| `dependency_count`           | Número de ocorrências encontradas; `null` em erro                                                                                              |
| `dependency_items`           | Inventário completo de ocorrências                                                                                                             |
| `counts`                     | Contagens read-only das 4 coleções; `null` em erro                                                                                             |
| `lock_state_read_succeeded`  | `true` se o lock foi lido com sucesso                                                                                                          |
| `v7_lock.state`              | Valor do lock (`armed`/`consumed`); `null` em erro                                                                                             |
| `records_created`            | `0`                                                                                                                                            |
| `records_updated`            | `0`                                                                                                                                            |
| `records_deleted`            | `0`                                                                                                                                            |
| `locks_modified`             | `0`                                                                                                                                            |
| `activecampaign_calls`       | `0`                                                                                                                                            |
| `external_calls`             | `0`                                                                                                                                            |
| `error`                      | (somente em falha) mensagem de erro truncada                                                                                                   |
| `message`                    | Descrição legível do resultado                                                                                                                 |

### v4 Correção Frontend — Contrato de Validade

O frontend v4 não fabrica valores quando a resposta está ausente, inválida ou incompleta. O contrato de validade exige **todas** as condições abaixo, avaliadas em conjunto:

1. `captured_from === "HTTP_RESPONSE"`
2. JSON foi parseado com sucesso
3. HTTP status entre 200 e 299 (inclusive)
4. `query_succeeded === true`
5. `lock_state_read_succeeded === true`
6. `dependency_query_succeeded === true`
7. `records_created` é número finito
8. `records_updated` é número finito
9. `records_deleted` é número finito
10. `locks_modified` é número finito
11. `activecampaign_calls` é número finito
12. `external_calls` é número finito
13. `dependency_count` é número finito
14. `v7_lock.state` é string
15. `v7_lock.modified` é boolean
16. `counts` é objeto com números para as 4 coleções
17. `target_identity_verified` é objeto com booleanos para os 3 registros

Quando qualquer condição falha:

- Campos afetados mostram "não verificado nesta sessão"
- Aviso visível: "Resposta inválida ou incompleta — evidência não homologável"
- `data_writes` não é calculado
- `deletion_executed` não é inferido
- Chamadas externas zero não são inferidas
- Resposta bruta é preservada para diagnóstico

Quando todas as condições são satisfeitas:

- `data_writes = records_created + records_updated + records_deleted`
- `deletion_executed = records_deleted > 0`
- `activecampaign_calls` = valor literal recebido
- `v7_lock_state` = valor literal recebido

### v7 Preservação

- Hook `pocketbase/hooks/ac_diag_compensacao_dependencias.js`: **não modificado**
- Lock `ac_diag_compensacao_dependencias_lock` em `com_parametros`: **`armed`**
- Registros deletados: **0**
- Lock consumido: **não**
- Compensação v7: **publicada, não homologada, não autorizada para execução**

### Diff v3 → v4 (Resumo de Mudanças Frontend)

1. **FRONTEND_BUNDLE**: `v3` → `v4`
2. **Removido**: Todos os fallbacks que fabricam `0` ou `false` quando a resposta está ausente, inválida ou incompleta
3. **Adicionado**: Função `validateEvidence()` que verifica o contrato completo de validade antes de exibir qualquer valor como evidência
4. **Adicionado**: Aviso visível "Resposta inválida ou incompleta — evidência não homologável" quando o contrato falha
5. **Adicionado**: Validação explícita de tipo para cada campo (número, string, boolean, objeto)
6. **Adicionado**: Exibição de `evidence_valid` no painel de estado
7. **Adicionado**: Exibição de identidades verificadas e contagens apenas quando válido
8. **Modificado**: `data_writes`, `deletion_executed`, `activecampaign_calls`, `v7_lock_state` só são calculados/exibidos quando o contrato é satisfeito
9. **Modificado**: Copy/Download habilitados para qualquer resposta capturada (não apenas HTTP_RESPONSE) para fins de diagnóstico
10. **Backend**: Permanece v3, byte-for-byte idêntico
11. **Rota**: Permanece v3

### Reversões

- `package.json`: `version` restaurada de `"0.0.106"` para `"0.0.105"`
- `src/lib/pocketbase/schema.json`: `generatedAt` restaurado de `"2026-08-12T21:11:56.119Z"` para `"2026-08-12T20:44:42.987Z"`

### Proibições Cumpridas

- [x] Auditoria não executada
- [x] Compensação não executada
- [x] Nenhum registro deletado
- [x] Lock não consumido
- [x] R14 não criado
- [x] 2D.2B não iniciado
- [x] Porta 2E não iniciada
- [x] Dados reais não utilizados
- [x] ActiveCampaign não chamado
- [x] Parado após publicação e relatório
- [x] Nenhum `save`, `delete`, `runInTransaction`, `new Record` no handler v3
- [x] Nenhuma chamada HTTP/fetch/request no handler v3
- [x] Nenhuma credencial ActiveCampaign no handler v3
- [x] Lock lido diretamente — ausência é erro explícito
- [x] Backend v3 permanece byte-for-byte idêntico (SHA-256: bf731b86a59d8a05135ed343f11e9a1a0a5ce22cf009cf1fd98a8dffe2cba375)
- [x] Frontend: version strings em v4
- [x] Frontend: "não verificado nesta sessão" antes da execução ou quando resposta é inválida/incompleta
- [x] Frontend: valores apenas da resposta HTTP validada após execução
- [x] Frontend: uma chamada por sessão
- [x] Frontend: não auto-executado no mount
- [x] Frontend: botão separado da compensação v7
- [x] Frontend: nenhum valor fabricado quando resposta é ausente, inválida ou incompleta
- [x] Frontend: aviso visível quando contrato de validade falha
- [x] Frontend: raw response preservado para diagnóstico em todos os casos

### Declaração JSON Expressa

```json
{
  "audit_route_executed": false,
  "compensation_executed": false,
  "records_created": 0,
  "records_updated": 0,
  "records_deleted": 0,
  "locks_modified": 0,
  "activecampaign_calls": 0,
  "external_calls": 0,
  "v7_lock_expected_state": "armed"
}
```

### Arquivos Diferentes da Exportação v3

**Arquivos funcionais autorizados:**

1. `src/components/foundation/DiagCompensacaoAuditEvidenceBlock.tsx` — correção v4 do frontend
2. `REPORT_R13_DIAG_COMPENSACAO_AUDITORIA_PUBLICATION.md` — atualização do relatório para v4

**Reversões obrigatórias:** 3. `package.json` — `version` restaurada de `"0.0.106"` para `"0.0.105"` 4. `src/lib/pocketbase/schema.json` — `generatedAt` restaurado de `"2026-08-12T21:11:56.119Z"` para `"2026-08-12T20:44:42.987Z"`

**Metadados automáticos da plataforma:** 5. `.skip.config.json` — se modificado automaticamente pelo mecanismo interno de build/export da plataforma, não é uma alteração funcional. Diff literal a ser declarado separadamente quando ocorrer.

PARE — Aguardando autorização explícita para execução ou teste.
