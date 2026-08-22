# Plano de Entrada — Porta 2D.2B (Correção Consolidada Final)

## 0. Declaração Inicial

**Porta 2D.2B: NÃO INICIADA.**

Este é um documento de planejamento exclusivamente. Nenhuma rota, teste, query, webhook, chamada externa ou alteração de qualquer arquivo — exceto este próprio — foi executada. O escopo futuro descrito é um teste local, assinado, completo e controlado do endpoint de webhook existente, usando exclusivamente amostras sintéticas `[TESTE]`, sem registro de webhook no ActiveCampaign, sem tráfego originado pelo ActiveCampaign e sem chamadas a serviços externos.

**Estágio de análise estática: COMPLETO.** Todos os itens S1–S11 estão provados. S11 (delta de `com_auditoria`) tem o delta total provado como 0, fundamentado no fato de que o hook `audit_negocios.js` utiliza `onRecordUpdateRequest`, que não dispara em `$app.save()` server-side realizado por `ac_webhook.js` ou `ac_rollback.js`.

---

## 1. Objetivo e Fronteiras

### Objetivo

A Porta 2D.2B tem como objetivo planejar (não executar) um round futuro único, fechado e controlado que valide o endpoint de webhook ActiveCampaign existente (`POST /backend/v1/integracao/ac/webhook`) por meio de chamadas HTTP locais assinadas, usando exclusivamente amostras sintéticas `[TESTE]`, garantindo que todos os mecanismos de segurança, idempotência, normalização, snapshot, rollback e auditoria funcionem de forma observável.

### Dentro do Escopo (Futuro, Não Autorizado)

- Round único com sequência fixa de chamadas e resultado esperado por chamada.
- Amostras exclusivamente sintéticas (`[TESTE]`), prefixadas com `TESTE-2D2B-`.
- Assinatura HMAC sobre os bytes exatos do corpo recebido.
- Timestamp obrigatório dentro de janela de 5 minutos.
- Matriz de segurança com testes negativos (zero persistência).
- Testes funcionais positivos (deltas sintéticos pré-definidos).
- Rollback e repetição idempotente.
- Probe final com endpoint desabilitado.
- Contagens antes/depois em todas as coleções afetáveis.
- Coleta de evidências com IDs integrais no artefato privado de auditoria.

### Fora do Escopo

- ❌ Registro de webhook no ActiveCampaign.
- ❌ Tráfego originado pelo ActiveCampaign.
- ❌ Chamadas para qualquer serviço externo (ActiveCampaign ou outro).
- ❌ Criação, alteração ou exclusão de registros reais.
- ❌ Alterações em migrações, hooks, schema, regras de coleção, índices ou configurações.
- ❌ Alterações em RBAC, perfis, permissões ou guards.
- ❌ Alterações no frontend.
- ❌ Alterações no backend (código ou hooks).
- ❌ Alterações em `.env`, credenciais, tokens ou secrets.
- ❌ Modificação de locks em `com_parametros`.
- ❌ Reutilização ou reativação da compensação R13 v8.
- ❌ Publicação em produção.
- ❌ Início da Porta 2E.
- ❌ Execução da Porta 2D.2B sem nova autorização explícita.

---

## 2. Amostra Sintética

Toda amostra utilizada na Porta 2D.2B é **exclusivamente sintética** e identificada com a tag `[TESTE]`:

| Entidade                 | Correlation Key    | Tag                    |
| ------------------------ | ------------------ | ---------------------- |
| Contato                  | `TESTE-2D2B-FN-C1` | `[TESTE] 2D2B Contact` |
| Negócio                  | `TESTE-2D2B-FN-D1` | `[TESTE] 2D2B Negocio` |
| Negócio (sem mapeamento) | `TESTE-2D2B-FN-D2` | `[TESTE] 2D2B Sem Map` |

### Regras

- Nenhum dado real (mesmo parcial) é utilizado.
- Nenhum email real, telefone real ou CNPJ real é incluído.
- Todos os IDs externos são prefixados com `TESTE-2D2B-`.
- Todos os títulos/nomes contêm `[TESTE]`.
- Os registros sintéticos criados são preservados (não deletados) para auditoria.

---

## 3. Configuração do Webhook ActiveCampaign (Referência Futura)

> ⚠️ **NÃO CONFIGURAR.** Nenhum webhook deve ser registrado, ativado ou testado contra o ActiveCampaign.

| Propriedade          | Valor (futuro, não autorizado)                              |
| -------------------- | ----------------------------------------------------------- |
| Sistema de origem    | `activecampaign`                                            |
| URL do webhook       | `POST /backend/v1/integracao/ac/webhook`                    |
| Content-Type         | `application/json`                                          |
| Limite de corpo      | 256 KB (262144 bytes) — via `$apis.bodyLimit(262144)`       |
| Header de assinatura | `X-AC-Signature: <hex_hmac_sha256>`                         |
| Secret               | `AC_WEBHOOK_SECRET` (vault — não exposto)                   |
| Flag de ativação     | `ac_webhook_enabled` em `com_parametros` (server-side only) |
| Janela anti-replay   | 5 minutos (300000 ms), timestamp obrigatório                |

### Status Atual

- O endpoint existe (`ac_webhook.js`) e está **desabilitado** (`ac_webhook_enabled = false`).
- Nenhum webhook está registrado no ActiveCampaign.
- Nenhum tráfego externo é esperado ou permitido.

---

## 4. Autenticação e Semântica de Entrega

### 4.1 HMAC-SHA256 sobre Bytes Exatos do Corpo (Provado — S1)

A assinatura é computada sobre o **corpo bruto recebido** (raw body), sem nenhuma canonicalização JSON posterior. O código publicado em `ac_webhook.js` implementa o seguinte fluxo:

1. O corpo bruto da requisição é obtido via `toString(e.request.body)`, preservando os bytes exatos recebidos.
2. O header `X-AC-Signature` é validado quanto ao formato: deve ser uma string hexadecimal de exatamente 64 caracteres (`/^[0-9a-fA-F]{64}$/`).
3. A assinatura recebida é normalizada para lowercase.
4. Calcula-se `HMAC-SHA256(rawBody, AC_WEBHOOK_SECRET)` usando `$security.hs256(rawBody, webhookSecret)`.
5. Compara-se o resultado com a assinatura recebida usando **comparação em tempo constante** (XOR byte-a-byte sem short-circuit):
   ```javascript
   var sigDiff = 0
   for (var si = 0; si < expectedSig.length; si++) {
     sigDiff |= expectedSig.charCodeAt(si) ^ signature.charCodeAt(si)
   }
   if (sigDiff !== 0) {
     /* rejeitar */
   }
   ```
6. Rejeita-se se o header estiver ausente (HTTP 401), se o formato for inválido (HTTP 401), se o comprimento divergir (HTTP 401), ou se a comparação falhar (HTTP 401).
7. A validação da assinatura ocorre **antes** do `JSON.parse` e **antes** de qualquer persistência.
8. O body limit é aplicado via `$apis.bodyLimit(262144)` como middleware da rota, garantindo rejeição precoce de corpos excessivos.

O endpoint de rollback (`ac_rollback.js`) implementa o **mesmo contrato de assinatura**: validação de formato hex 64 chars, normalização para lowercase, `$security.hs256(rawBody, webhookSecret)` sobre `toString(e.request.body)`, e comparação em tempo constante.

### 4.2 API `$security.hs256()` — Provado (S1)

**Status: PROVADO.**

O código publicado em `ac_webhook.js` e `ac_rollback.js` utiliza `$security.hs256(rawBody, webhookSecret)` onde:

- `rawBody` é a string obtida de `toString(e.request.body)` — tratada como UTF-8 string.
- `webhookSecret` é a string lida de `$secrets.get('AC_WEBHOOK_SECRET')`.
- O resultado é comparado caractere-a-caractere (tempo constante) com a assinatura recebida, que é validada como hexadecimal de 64 caracteres e normalizada para lowercase.
- O comportamento é consistente entre os dois endpoints (webhook e rollback), ambos usando o mesmo algoritmo e fluxo de validação.

### 4.3 Timestamp Obrigatório

- O timestamp é **obrigatório** em todo payload de teste.
- Deve estar dentro da janela de 5 minutos (300000 ms) do momento do processamento.
- Deve ser incluído no material assinado (parte do raw body).
- Timestamp ausente, com formato inválido ou fora da janela → falha fechada (HTTP 400).
- Não há compatibilidade retroativa para payloads sem timestamp.
- A validação do timestamp ocorre **após** a validação da assinatura e **antes** de qualquer persistência.

### 4.4 Proteção Anti-Replay

- Quando o payload contém `timestamp`, a janela de 5 minutos é enforced.
- Eventos fora da janela são rejeitados com HTTP 400.
- O timestamp deve ser validado antes de qualquer persistência.

### 4.5 Idempotência

- Chave derivada: `SHA-256(sistema_origem + "|" + evento_tipo + "|" + external_id)`.
- Campo `idempotency_key` em `com_eventos_integracao` com índice UNIQUE (provado em S2 — `idx_com_eventos_integracao_idempotency`).
- Duplicatas retornam HTTP 409 com `{ duplicate: true, event_id, status }`.
- Nenhuma duplicata cria segundo evento funcional, contato, empresa, negócio, vínculo, auditoria ou snapshot.

### 4.6 Garantia de Entrega At-Least-Once

- Eventos são persistidos em `com_eventos_integracao` com status `received` antes do processamento.
- Após processamento bem-sucedido, status é atualizado para `processed`.
- Em caso de erro, status é `error` com mensagem sanitizada.
- A execução é registrada em `com_execucoes_sincronizacao` com status `processing` → `completed` / `error`.

---

## 5. Round Único — Sequência Fixa

### 5.1 Eliminação de Modos

Os modos `security-only` e `full` são **eliminados**. Existe um único round com uma sequência fixa de chamadas, um número exato de chamadas e um resultado esperado para cada chamada.

### 5.2 Estrutura do Round

O round é dividido em quatro fases sequenciais:

| Fase      | Descrição                                         | Número de Chamadas |
| --------- | ------------------------------------------------- | ------------------ |
| A         | Testes negativos de segurança (zero persistência) | 8 (A1–A8)          |
| B         | Testes positivos funcionais (deltas sintéticos)   | 5 (B1–B5)          |
| C         | Rollback e repetição idempotente                  | 2 (C1–C2)          |
| D         | Probe final com endpoint desabilitado             | 1 (D1)             |
| **Total** |                                                   | **16**             |

### 5.3 Ordem de Execução

1. Confirmar que `ac_webhook_enabled = false`.
2. **A1**: POST `/backend/v1/integracao/ac/webhook` → esperado HTTP **503** (endpoint desabilitado).
3. Habilitar `ac_webhook_enabled = true`.
4. **A2–A8**: 7 testes negativos (endpoint habilitado; cada um falha por seu motivo específico).
5. **B1–B5**: 5 testes funcionais positivos (assinados, timestamp válido).
6. **C1–C2**: 2 chamadas de rollback (primeira execução + repetição idempotente).
7. Restaurar `ac_webhook_enabled = false`.
8. **D1**: POST `/backend/v1/integracao/ac/webhook` → esperado HTTP **503** (endpoint desabilitado).

---

## 6. Estágio de Análise Estática — COMPLETO

Todos os itens S1–S11 estão provados.

| #   | Item a Provar                                                                                                                                                                                                                 | Fonte                                                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | API criptográfica usada (`$security.hs256`): recebe string; resultado hex; comportamento documentado e consistente entre webhook e rollback                                                                                   | Código de `ac_webhook.js` e `ac_rollback.js`                      | **Provado**                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S2  | Índice UNIQUE em `idempotency_key` em `com_eventos_integracao`                                                                                                                                                                | `schema.json` e migração 0044                                     | **Provado** — `idx_com_eventos_integracao_idempotency` (UNIQUE) confirmado no schema                                                                                                                                                                                                                                                                                                                                                                   |
| S3  | Estados válidos de eventos (`received`, `processed`, `error`) e execuções (`processing`, `completed`, `error`)                                                                                                                | Código de `ac_webhook.js`                                         | **Provado**                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S4  | Formato e campos do snapshot em `com_snapshots_negocio` (`negocio_id`, `snapshot`, `origem`)                                                                                                                                  | `schema.json` e migração 0045                                     | **Provado** — campos confirmados no schema                                                                                                                                                                                                                                                                                                                                                                                                             |
| S5  | Contrato literal do endpoint webhook (`POST /backend/v1/integracao/ac/webhook`)                                                                                                                                               | Código de `ac_webhook.js`                                         | **Provado**                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S6  | Contrato literal do endpoint rollback (`POST /backend/v1/integracao/ac/rollback`)                                                                                                                                             | Código de `ac_rollback.js`                                        | **Provado**                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S7  | Campos estruturais de `com_vinculos_externos` (`sistema_origem`, `external_type`, `external_id`, `collection_name`, `record_id`) distinguindo contato (`external_type = 'contact'`) de negócio (`external_type = 'business'`) | `schema.json` e migração 0042                                     | **Provado** — campos confirmados no schema                                                                                                                                                                                                                                                                                                                                                                                                             |
| S8  | B5 (`deal_create` com stage sem mapeamento) cria um vínculo em `com_vinculos_externos` — caminho de código em `ac_webhook.js` para novos negócios cria vínculo                                                                | Código de `ac_webhook.js`                                         | **Provado** — o caminho `!nRec` cria `new Record(vCol2)` e salva o vínculo                                                                                                                                                                                                                                                                                                                                                                             |
| S9  | C1 (rollback) NÃO cria um registro em `com_execucoes_sincronizacao` — análise do caminho de código em `ac_rollback.js`                                                                                                        | Código de `ac_rollback.js`                                        | **Provado** — o endpoint de rollback não cria registro em `com_execucoes_sincronizacao`                                                                                                                                                                                                                                                                                                                                                                |
| S10 | O endpoint de rollback (`ac_rollback.js`) implementa idempotência para C2 (repetição produz delta 0) via chave determinística sem `Date.now()`                                                                                | Código de `ac_rollback.js`                                        | **Provado** — idempotency_key usa `$security.sha256(sistemaOrigem + '\|rollback\|' + entityType + '\|' + externalId + '\|' + txRecordId + '\|' + snapshotId)` — determinística, sem `Date.now()`                                                                                                                                                                                                                                                       |
| S11 | Delta de `com_auditoria` durante o round — análise de todos os caminhos de código em `ac_webhook.js` e `ac_rollback.js` para criação server-side de registros de auditoria                                                    | Código de `ac_webhook.js`, `ac_rollback.js` e `audit_negocios.js` | **Provado** — delta total = 0. O delta direto dos dois endpoints é 0 (nenhum cria registros em `com_auditoria`). O hook indireto `audit_negocios.js` utiliza `onRecordUpdateRequest`, que é um hook de requisição HTTP e **não** dispara em `$app.save()` server-side. Portanto, os saves de `com_negocios` realizados por `ac_webhook.js` (B3, B4, B5) e `ac_rollback.js` (C1) não disparam `audit_negocios`, e o delta total de `com_auditoria` é 0. |

### Resultado do Estágio de Análise Estática

- S1–S11: **Provados.**
- S11: Delta total de `com_auditoria` = **0** (provado). O hook `audit_negocios.js` utiliza `onRecordUpdateRequest` (hook de requisição HTTP), que não dispara em `$app.save()` server-side. Os saves de `com_negocios` em B3, B4, B5 (via `ac_webhook.js`) e C1 (via `ac_rollback.js`) não acionam o hook de auditoria. Delta direto dos endpoints = 0; delta indireto = 0; delta total = 0.

---

## 7. Matriz Completa de Testes

### 7.1 Coleções Monitoradas

| Coleção                       | Campo no JSON |
| ----------------------------- | ------------- |
| `com_contatos`                | `contatos`    |
| `com_negocios`                | `negocios`    |
| `com_eventos_integracao`      | `eventos`     |
| `com_execucoes_sincronizacao` | `execucoes`   |
| `com_vinculos_externos`       | `vinculos`    |
| `com_snapshots_negocio`       | `snapshots`   |
| `com_ocorrencias_qualidade`   | `ocorrencias` |
| `com_auditoria`               | `auditoria`   |

Contagens são capturadas: antes do round, após cada chamada individual, e ao final.

> **Ver também:** Seção 7.7 — Tabela Consolidada de Monitoramento.

### 7.2 Fase A — Testes Negativos de Segurança (Zero Persistência)

> Todos os testes negativos devem produzir **delta zero** em todas as coleções monitoradas.

| #   | Método | Rota                                | Headers                                                                                      | Categoria do Payload                                                                | HTTP Esperado | Delta por Coleção |
| --- | ------ | ----------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------- | ----------------- |
| A1  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`                                                             | `{}` (endpoint desabilitado)                                                        | 503           | 0 em todas        |
| A2  | GET    | `/backend/v1/integracao/ac/webhook` | (nenhum)                                                                                     | (nenhum corpo)                                                                      | 405           | 0 em todas        |
| A3  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: text/plain`                                                                   | `{}`                                                                                | 400           | 0 em todas        |
| A4  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | `{"timestamp":"<timestamp_válido>"}` (sem `type`/`event`/`action` e sem ID externo) | 400           | 0 em todas        |
| A5  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`                                 | JSON malformado `not-json{`                                                         | 400           | 0 em todas        |
| A6  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | Payload > 256KB                                                                     | 400           | 0 em todas        |
| A7  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json` (sem `X-AC-Signature`)                                      | Payload de contato sintético `[TESTE]` com timestamp válido                         | 401           | 0 em todas        |
| A8  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: invalido`                                 | Payload de contato sintético `[TESTE]` com timestamp válido                         | 401           | 0 em todas        |

> **A4:** O payload é um corpo JSON sintético contendo apenas um timestamp válido (ex.: `{"timestamp":"2026-08-13T01:00:00.000Z"}`), sem campos `type`, `event` ou `action`, e sem nenhum ID externo (sem `contact.id`, `organization.id` ou `deal.id`). A assinatura HMAC é calculada sobre os bytes exatos desse corpo. Assinatura válida e timestamp válido garantem que a única razão de falha seja "Evento sem tipo ou id externo identificavel" (HTTP 400), e não ausência de assinatura ou timestamp inválido.
>
> **A6:** O body limit de 256KB é aplicado via `$apis.bodyLimit(262144)` como middleware da rota. Assinatura válida e timestamp válido garantem que a única razão de falha seja o tamanho do corpo (HTTP 400).

### 7.3 Fase B — Testes Positivos Funcionais (Deltas Sintéticos Pré-definidos)

> Após habilitar `ac_webhook_enabled = true`. Todos os payloads são assinados com HMAC sobre bytes exatos do raw body via `toString(e.request.body)`, com timestamp obrigatório válido. Nenhum valor de secret é exposto.

| #   | Método | Rota                                | Headers                                                                                      | Categoria do Payload                                           | HTTP Esperado | Delta por Coleção                                                  |
| --- | ------ | ----------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| B1  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | `contact_create` (`TESTE-2D2B-FN-C1`)                          | 200           | contatos +1, eventos +1, execuções +1, vinculos +1                 |
| B2  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | Replay idêntico de B1                                          | 409           | 0 em todas (duplicata)                                             |
| B3  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | `deal_create` (`TESTE-2D2B-FN-D1`, stage `prospects`)          | 200           | negocios +1, eventos +1, execuções +1, vinculos +1                 |
| B4  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | `deal_update` (`TESTE-2D2B-FN-D1`, stage `producao_proposta`)  | 200           | snapshots +1, eventos +1, execuções +1                             |
| B5  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | `deal_create` (`TESTE-2D2B-FN-D2`, stage `unmapped_stage_xyz`) | 200           | negocios +1, eventos +1, execuções +1, vinculos +1, ocorrencias +1 |

> **B5 — `com_vinculos_externos` +1 (PROVADO — S8):** O caminho de criação de novo negócio (`!nRec`) em `ac_webhook.js` cria um vínculo externo via `new Record(vCol2)` seguido de `$app.save(vRec2)`. Delta confirmado: +3 total para `com_vinculos_externos` (B1, B3, B5).

### 7.4 Fase C — Rollback e Repetição Idempotente

> **Requisito do plano:** As chamadas C1 e C2 devem incluir o header `Content-Type: application/json`. Este é um requisito de nível de plano para garantir entrega consistente do corpo JSON. O hook `ac_rollback.js` não contém validação explícita de `Content-Type` — a exigência é documentada aqui como requisito do plano, não como validação do hook.

| #   | Método | Rota                                 | Headers                                                                                      | Categoria do Payload                        | HTTP Esperado | Delta por Coleção                                    |
| --- | ------ | ------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------- | ---------------------------------------------------- |
| C1  | POST   | `/backend/v1/integracao/ac/rollback` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | Rollback de `TESTE-2D2B-FN-D1` (`business`) | 200           | eventos +1 (compensador); execuções +0; snapshots +0 |
| C2  | POST   | `/backend/v1/integracao/ac/rollback` | `Content-Type: application/json`, `X-AC-Signature: <válido>`, `timestamp: <válido no corpo>` | Replay idêntico de C1                       | 200           | 0 em todas (idempotente)                             |

#### Contrato de C1 (Primeira Execução) — PROVADO (S6, S9, S10)

| Aspecto                          | Valor                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP Esperado                    | 200                                                                                                                                                                                                      |
| Body Esperado                    | `{ success: true, idempotent: false, rolled_back: [{ collection: "com_negocios", record_id: <id>, action: "restored_from_snapshot" }] }`                                                                 |
| Comportamento                    | Negócio `TESTE-2D2B-FN-D1` restaurado a partir do snapshot mais recente dentro de uma transação atômica (`$app.runInTransaction`).                                                                       |
| Campos restaurados               | `titulo`, `valor`, `etapa`, `resultado` — restaurados por **presença de propriedade** no JSON do snapshot (`Object.prototype.hasOwnProperty.call(snapData, field)`), preservando zeros e strings vazias. |
| Cria execução?                   | **Não** (provado em S9 — o endpoint de rollback não cria registro em `com_execucoes_sincronizacao`).                                                                                                     |
| Cria snapshot?                   | **Não.**                                                                                                                                                                                                 |
| Cria evento compensador          | **Sim** (+1 em `com_eventos_integracao`) com `evento_tipo = "rollback"`, `status = "rollback_executed"`.                                                                                                 |
| Cria registro em `com_auditoria` | **Não.** Delta direto = 0 (provado em S11). Delta indireto = 0 (provado em S11 — `audit_negocios.js` usa `onRecordUpdateRequest`, que não dispara em `$app.save()` server-side). Delta total = 0.        |
| Deleção física                   | **Nenhuma.** Registros são restaurados, não deletados.                                                                                                                                                   |
| Chave de idempotência            | Determinística: `$security.sha256(sistemaOrigem + '\|rollback\|' + entityType + '\|' + externalId + '\|' + txRecordId + '\|' + snapshotId)` — sem `Date.now()`.                                          |

#### Contrato de C2 (Repetição Idempotente) — PROVADO (S10)

| Aspecto       | Valor                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP Esperado | **200**                                                                                                                                                                                                                                                      |
| Body Esperado | `{ success: true, rolled_back: [], idempotent: true }`                                                                                                                                                                                                       |
| Comportamento | Negócio NÃO é alterado. Nenhum novo evento compensador é criado. Nenhum snapshot adicional é criado. A chave de idempotência determinística (sem `Date.now()`) garante que o evento compensador existente seja encontrado e a repetição retorne idempotente. |
| Delta         | 0 em todas as coleções                                                                                                                                                                                                                                       |

> O contrato idempotente é **único e inequívoco**: C2 retorna HTTP 200 com `{ success: true, rolled_back: [], idempotent: true }` e delta 0. Não se aceita "200 ou 409". A idempotência é garantida pela chave determinística que inclui `snapshotId` (provado em S10).

### 7.5 Fase D — Probe Final

| #   | Método | Rota                                | Headers                          | HTTP Esperado | Delta      |
| --- | ------ | ----------------------------------- | -------------------------------- | ------------- | ---------- |
| D1  | POST   | `/backend/v1/integracao/ac/webhook` | `Content-Type: application/json` | 503           | 0 em todas |

### 7.6 Deltas Finais Totais

| Coleção                       | Delta Total Esperado |
| ----------------------------- | -------------------- |
| `com_contatos`                | +1                   |
| `com_negocios`                | +2                   |
| `com_eventos_integracao`      | +5                   |
| `com_execucoes_sincronizacao` | +4                   |
| `com_vinculos_externos`       | +3                   |
| `com_snapshots_negocio`       | +1                   |
| `com_ocorrencias_qualidade`   | +1                   |
| `com_auditoria`               | +0                   |

> **Nota sobre `com_eventos_integracao`:** O delta total é +5. Derivação linha a linha: B1 (+1), B2 (+0 — duplicata), B3 (+1), B4 (+1), B5 (+1), C1 (+1 — compensador), C2 (+0 — idempotente). Valor único — não existe +6.

> **Nota sobre `com_execucoes_sincronizacao`:** O delta é +4. C1 não cria execução (provado em S9 — o endpoint de rollback não cria registro em `com_execucoes_sincronizacao`). Derivação: B1 (+1), B3 (+1), B4 (+1), B5 (+1), C1 (+0), C2 (+0).

> **Nota sobre `com_vinculos_externos`:** O delta é +3 (provado em S8 — o caminho de criação de novo negócio em `ac_webhook.js` cria vínculo). Derivação: B1 (+1 — vínculo contato), B3 (+1 — vínculo negócio), B5 (+1 — vínculo negócio).

> **Nota sobre `com_auditoria`:** O delta total é **+0** (provado em S11). O delta direto dos endpoints `ac_webhook.js` e `ac_rollback.js` é 0 — nenhum dos dois cria registros em `com_auditoria` diretamente. O hook indireto `audit_negocios.js` utiliza `onRecordUpdateRequest`, que é um hook de requisição HTTP e **não** dispara em `$app.save()` server-side. Portanto, os saves de `com_negocios` realizados por `ac_webhook.js` (B3, B4, B5) e `ac_rollback.js` (C1) não acionam o hook de auditoria. Delta direto = 0; delta indireto = 0; delta total = 0.

---

## 7.7 Tabela Consolidada de Monitoramento

> Esta seção consolida em uma única tabela, para cada coleção monitorada, a contagem inicial (a capturar antes do round — sem valor numérico inventado), o delta exato esperado para o round completo, a fórmula da contagem final (`inicial + delta`) e as fases/chamadas responsáveis pelo delta.

| Coleção                       | Contagem Inicial          | Delta Exato Esperado (Round Completo) | Fórmula Contagem Final | Fases / Chamadas Responsáveis                                                                                                   |
| ----------------------------- | ------------------------- | ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `com_contatos`                | a capturar antes do round | +1                                    | inicial + 1            | B1 (contact_create `TESTE-2D2B-FN-C1`)                                                                                          |
| `com_negocios`                | a capturar antes do round | +2                                    | inicial + 2            | B3 (deal_create `TESTE-2D2B-FN-D1`), B5 (deal_create `TESTE-2D2B-FN-D2`)                                                        |
| `com_eventos_integracao`      | a capturar antes do round | +5                                    | inicial + 5            | B1, B3, B4, B5, C1 (compensador); B2=0, C2=0 (idempotentes)                                                                     |
| `com_execucoes_sincronizacao` | a capturar antes do round | +4 (provado em S9)                    | inicial + 4            | B1, B3, B4, B5; C1=0, C2=0                                                                                                      |
| `com_vinculos_externos`       | a capturar antes do round | +3 (provado em S8)                    | inicial + 3            | B1 (vínculo contato), B3 (vínculo negócio), B5 (vínculo negócio)                                                                |
| `com_snapshots_negocio`       | a capturar antes do round | +1                                    | inicial + 1            | B4 (deal_update `TESTE-2D2B-FN-D1`)                                                                                             |
| `com_ocorrencias_qualidade`   | a capturar antes do round | +1                                    | inicial + 1            | B5 (unmapped_stage `TESTE-2D2B-FN-D2`)                                                                                          |
| `com_auditoria`               | a capturar antes do round | +0 (provado em S11)                   | inicial + 0            | Nenhuma — delta direto = 0; delta indireto = 0 (`audit_negocios` usa `onRecordUpdateRequest`, não dispara em saves server-side) |

> **Nota sobre `com_eventos_integracao`:** O delta total é +5. Derivação: B1 (+1), B2 (+0), B3 (+1), B4 (+1), B5 (+1), C1 (+1), C2 (+0). Valor único — não existe +6.

> **Nota sobre `com_auditoria`:** O delta total é **+0** (provado em S11). O hook `audit_negocios.js` utiliza `onRecordUpdateRequest` (hook de requisição HTTP), que não dispara em `$app.save()` server-side. Os saves de `com_negocios` em B3, B4, B5 (via `ac_webhook.js`) e C1 (via `ac_rollback.js`) não acionam o hook de auditoria. Delta direto = 0; delta indireto = 0; delta total = 0.

### Bloco do Parâmetro `ac_webhook_enabled` (Registrado Separadamente)

| Aspecto                             | Valor                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Chave                               | `ac_webhook_enabled`                                                                      |
| Contagem / Valor inicial esperado   | `false` (confirmado antes do round)                                                       |
| Única transição autorizada (futuro) | `false → true → false`                                                                    |
| Estado final obrigatório            | `false`                                                                                   |
| Restauração automática após PARE    | Restaurar `ac_webhook_enabled = false` é a **única** ação corretiva automática permitida  |
| Outros parâmetros ou locks          | Fora do escopo — proibidos (nenhuma outra chave de `com_parametros` é lida ou modificada) |

> **Ver também:** Seção 8 — Parâmetro de Ativação para o detalhamento completo.

---

## 8. Parâmetro de Ativação

### `ac_webhook_enabled` — Parâmetro de Ativação (Não Lock)

| Aspecto                             | Valor                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Tipo                                | Parâmetro de ativação em `com_parametros`                                                 |
| Chave                               | `ac_webhook_enabled`                                                                      |
| Valor inicial esperado              | `false` (confirmado antes do round)                                                       |
| Única transição autorizada (futuro) | `false → true → false`                                                                    |
| Procedimento de restauração         | Ao final do round (ou em caso de falha), restaurar para `false` e confirmar via releitura |
| Outras chaves de `com_parametros`   | Nenhuma pode ser lida ou modificada                                                       |

### Remoção de `ac_r13_execution_lock`

O lock `ac_r13_execution_lock` é **removido do plano**. Não é lido, modificado, criado ou referenciado em qualquer parte deste documento.

---

## 9. PARE — Segurança e Correção Automática

### PARE — Pausar, Analisar, Refletir, Engajar

O PARE deve ser aplicado **imediatamente** se qualquer critério de NO-GO for disparado.

### Única Ação Corretiva Automática Permitida

Se uma falha ocorrer após a habilitação de `ac_webhook_enabled = true`, a **única** ação corretiva automática permitida é:

1. Restaurar `ac_webhook_enabled = false`.
2. Confirmar via releitura que o valor é `false`.

**Toda e qualquer outra ação deve parar imediatamente** sem correção automática. Nenhum rollback, compensação, deleção, desativação de registros ou outra correção é executada automaticamente.

### Critérios de PARE Imediato

1. 🔴 Qualquer teste negativo de segurança criar registros (delta > 0 em qualquer coleção).
2. 🔴 Qualquer chamada externa para ActiveCampaign ou serviço externo ser detectada.
3. 🔴 Qualquer dado real (não-`[TESTE]`) ser criado ou alterado.
4. 🔴 `ac_webhook_enabled` não puder ser restaurado para `false`.
5. 🔴 O probe final não retornar 503.
6. 🔴 O rollback falhar.
7. 🔴 O snapshot não for criado antes da atualização do negócio.
8. 🔴 Qualquer alteração fora do escopo `TESTE-2D2B-` ser detectada.
9. 🔴 Qualquer hook, migração, schema ou configuração for alterada.
10. 🔴 Qualquer credencial, token ou secret for exposto.
11. 🔴 Qualquer divergência de status, identidade, delta, flag, assinatura ou timestamp.
12. 🔴 Qualquer divergência nos contratos C1 ou C2 em relação ao documentado neste plano.

### Ação ao Disparar PARE

- Restaurar `ac_webhook_enabled = false` (única ação automática).
- Retornar toda a evidência coletada até o ponto de parada.
- Registrar o motivo da parada.
- Não iniciar nenhuma outra ação corretiva sem nova autorização explícita.

---

## 10. Rollback — Identificação por Correlação

### Identificação de Alvos

Os alvos de rollback são identificados **exclusivamente** por:

1. Correlation keys sintéticas (`TESTE-2D2B-FN-D1`, `TESTE-2D2B-FN-D2`).
2. Relações estruturais provadas em `com_vinculos_externos`:
   - `sistema_origem = 'activecampaign'`
   - `external_type = 'business'`
   - `external_id = 'TESTE-2D2B-FN-D1'`
   - `collection_name = 'com_negocios'`
   - `record_id` = ID interno do negócio

### Pré-requisitos Simultâneos do Endpoint de Rollback (Provado — S6)

O endpoint `POST /backend/v1/integracao/ac/rollback` exige, **simultaneamente**, todos os seguintes pré-requisitos antes de qualquer processamento:

1. **Flag habilitada:** `ac_webhook_enabled = true` em `com_parametros` (lê-se `valor === 'true' && ativo === true`).
2. **Autenticação:** Usuário autenticado (`e.auth.id` presente).
3. **Superadministrador:** O usuário deve ter `perfil_id.slug = 'superadministrador'` (via `perfil_id` direto ou via binding em `com_usuarios_equipes` com `ativo = true`).
4. **Body limit:** O body limit de 256KB é aplicado via `$apis.bodyLimit(262144)` + verificação de `Content-Length`.
5. **Raw body:** Corpo bruto obtido via `toString(e.request.body)`.
6. **Assinatura HMAC válida:** Header `X-AC-Signature` presente, formato hex 64 chars, normalizado para lowercase, comparado em tempo constante com `$security.hs256(rawBody, webhookSecret)`.
7. **Timestamp válido:** Campo `timestamp` ou `ts` no body, dentro da janela de 5 minutos.
8. **`entity_type = business`:** O campo `entity_type` no body deve ser exatamente `"business"`.

> **Nota sobre `Content-Type`:** O plano exige que as chamadas C1 e C2 incluam o header `Content-Type: application/json` como requisito de nível de plano. O hook `ac_rollback.js` **não** contém validação explícita de `Content-Type` — esta exigência é documentada como requisito do plano para garantir entrega consistente do corpo JSON, não como validação do hook.

Se qualquer um destes pré-requisitos falhar, a requisição é rejeitada **antes** de qualquer persistência.

### Proibições

- ❌ Não usar busca textual para inferir tipo de entidade.
- ❌ Não usar `record_id` isolado para inferir o tipo de registro.
- ❌ Não reutilizar ou reativar a compensação R13 v8.

### Contrato de Rollback — Provado (S6, S9, S10, S11)

| Execução      | HTTP Esperado | Body Esperado                                                                                                                            | Comportamento                                                                                                                                                                |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 (primeira) | 200           | `{ success: true, idempotent: false, rolled_back: [{ collection: "com_negocios", record_id: <id>, action: "restored_from_snapshot" }] }` | Negócio restaurado do snapshot mais recente dentro de transação atômica. Evento compensador criado. Sem execução, sem snapshot adicional, sem deleção física, sem auditoria. |
| C2 (replay)   | 200           | `{ success: true, rolled_back: [], idempotent: true }`                                                                                   | Negócio não alterado. Nenhum novo evento compensador. Delta 0.                                                                                                               |

> O contrato idempotente é **único e inequívoco**: C2 retorna HTTP 200 com `{ success: true, rolled_back: [], idempotent: true }` e delta 0. A idempotência é garantida pela chave determinística (provado em S10).

### Comportamento de Restauração de C1 (Provado — S6)

C1 restaura os seguintes campos do snapshot, **por presença de propriedade** no JSON do snapshot:

| Campo       | Preservação                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| `titulo`    | Restaurado se `snapData` tiver a propriedade `titulo`                        |
| `valor`     | Restaurado se `snapData` tiver a propriedade `valor` (preserva `0`)          |
| `etapa`     | Restaurado se `snapData` tiver a propriedade `etapa` (preserva string vazia) |
| `resultado` | Restaurado se `snapData` tiver a propriedade `resultado`                     |

A restauração usa `Object.prototype.hasOwnProperty.call(snapData, field)` para cada campo, garantindo que zeros e strings vazias sejam preservados.

### O que C1 NÃO faz (Provado — S6, S9, S11)

- ❌ Não cria registro em `com_execucoes_sincronizacao` (provado em S9).
- ❌ Não cria snapshot adicional em `com_snapshots_negocio`.
- ❌ Não cria registro em `com_auditoria` — delta direto = 0; delta indireto = 0 (provado em S11 — `audit_negocios.js` usa `onRecordUpdateRequest`, não dispara em saves server-side); delta total = 0.
- ❌ Não realiza deleção física de nenhum registro.
- ❌ Não altera `com_vinculos_externos`.

### Preservação de Histórico

- Snapshots são imutáveis (regra `updateRule: null`, `deleteRule: null`).
- Eventos compensadores são preservados.
- Nenhum registro é fisicamente deletado.
- A preservação segue o schema provado no estágio de análise estática.

---

## 11. GO/NO-GO

### GO (Todos devem ser verdadeiros e prováveis objetivamente)

1. ✅ Estágio de análise estática (S1–S11) totalmente provado.
2. ✅ `$security.hs256()` comportamento provado (S1) — opera sobre `toString(e.request.body)`, resultado comparado em tempo constante.
3. ✅ `ac_webhook_enabled` inicial é `false`.
4. ✅ Todos os 8 testes negativos (Fase A) produzem delta zero e retornam o HTTP esperado.
5. ✅ Todos os 5 testes funcionais (Fase B) produzem exatamente os deltas pré-definidos.
6. ✅ Rollback (C1) restaura o negócio do snapshot dentro de transação atômica e cria evento compensador.
7. ✅ Repetição idempotente (C2) retorna HTTP 200 com `{ success: true, rolled_back: [], idempotent: true }` e delta 0.
8. ✅ Probe final (D1) retorna 503.
9. ✅ `ac_webhook_enabled` é restaurado para `false` ao final.
10. ✅ Nenhuma chamada externa para ActiveCampaign ou serviço externo é feita.
11. ✅ Nenhum dado real (não-`[TESTE]`) é criado ou alterado.
12. ✅ Todas as contagens finais correspondem aos deltas totais definidos.
13. ✅ S8 provado: delta de `com_vinculos_externos` confirmado em +3.
14. ✅ S9 provado: delta de `com_execucoes_sincronizacao` confirmado em +4.
15. ✅ S10 provado: idempotência de C2 confirmada via chave determinística.
16. ✅ S11 provado: delta total de `com_auditoria` confirmado em +0 — `audit_negocios.js` usa `onRecordUpdateRequest` (hook de requisição HTTP), que não dispara em `$app.save()` server-side.

### NO-GO (Qualquer um dispara PARE)

1. ❌ Qualquer teste negativo criar registros (delta > 0).
2. ❌ Qualquer teste funcional produzir delta divergente do pré-definido.
3. ❌ Qualquer divergência de status HTTP em relação ao esperado.
4. ❌ Qualquer divergência de identidade (correlation key, external_id).
5. ❌ Qualquer divergência de flag (`ac_webhook_enabled`).
6. ❌ Qualquer divergência de assinatura ou timestamp.
7. ❌ Qualquer persistência não esperada.
8. ❌ Qualquer chamada externa detectada.
9. ❌ `ac_webhook_enabled` não restaurado para `false`.
10. ❌ Probe final não retornar 503.
11. ❌ Rollback não restaurar do snapshot dentro de transação atômica.
12. ❌ Repetição idempotente (C2) criar novos eventos ou alterar o negócio.
13. ❌ C2 retornar status diferente de 200 ou body diferente do contrato.
14. ❌ C1 não restaurar `titulo`, `valor`, `etapa`, `resultado` por presença de propriedade.
15. ❌ C1 criar registro em `com_execucoes_sincronizacao` (delta deve ser 0).
16. ❌ C1 criar snapshot adicional ou realizar deleção física.
17. ❌ C1 criar registro em `com_auditoria` (delta deve ser 0).
18. ❌ Qualquer dado real criado ou alterado.
19. ❌ Divergência nos contratos C1/C2 em relação ao documentado.

---

## 12. Evidências e Tratamento

### Artefato Privado de Auditoria

O artefato privado de auditoria deve conter:

- Resultados completos de cada chamada (HTTP status, corpo da resposta).
- IDs **integrais** de todos os registros criados (eventos, execuções, vínculos, contatos, negócios, snapshots, ocorrências).
- Contagens antes/depois por coleção para cada chamada.
- Valores da flag antes/durante/depois.
- Status do probe final.
- Contagem de chamadas externas (deve ser 0).

### Sanitização

- A sanitização de IDs (primeiros 8 caracteres) pode ser usada **apenas** no resumo de chat.
- O artefato privado de auditoria contém IDs integrais.
- Nenhuma credencial, token, secret ou senha é exposta em qualquer evidência.

---

## 13. Listas Separadas

### 13.1 Ações Futuras Explicitamente Autorizáveis

> Estas ações são **futuras** e **não autorizadas** no momento. A autorização será concedida externamente após aprovação deste plano.

1. Ler `ac_webhook_enabled` em `com_parametros` (apenas leitura).
2. Modificar `ac_webhook_enabled` de `false → true` e de `true → false`.
3. Chamar `POST /backend/v1/integracao/ac/webhook` com payloads sintéticos `[TESTE]` assinados.
4. Chamar `POST /backend/v1/integracao/ac/rollback` com correlation keys sintéticas.
5. Chamar `GET /backend/v1/integracao/ac/webhook` (probe de método).
6. Capturar contagens das coleções monitoradas (apenas leitura).
7. Restaurar `ac_webhook_enabled = false` em caso de falha (única ação corretiva automática).

> **Esclarecimento:** Chamar endpoints existentes não significa alterar o backend. Nenhum arquivo de código, hook, migração, schema ou configuração é alterado. A alteração de qualquer arquivo permanece proibida.

### 13.2 Ações Proibidas

1. ❌ Registrar webhook no ActiveCampaign.
2. ❌ Fazer qualquer chamada para ActiveCampaign ou serviço externo.
3. ❌ Criar, alterar ou excluir dados reais.
4. ❌ Criar, alterar ou excluir migrações.
5. ❌ Criar, alterar ou excluir hooks.
6. ❌ Criar, alterar ou excluir rotas (`routerAdd`).
7. ❌ Alterar schema, regras de coleção ou índices.
8. ❌ Alterar RBAC, perfis, permissões ou guards.
9. ❌ Alterar configurações, `.env`, ou variáveis de ambiente.
10. ❌ Revelar, expor ou logar credenciais, tokens, secrets ou senhas.
11. ❌ Modificar locks em `com_parametros`.
12. ❌ Deletar registros `[TESTE]` ou snapshots.
13. ❌ Publicar em produção.
14. ❌ Iniciar a Porta 2E.
15. ❌ Iniciar a Porta 2D.2B (execução) sem nova autorização explícita.
16. ❌ Criar scheduler, reconciliação ou carregamento de dados.
17. ❌ Alterar arquivos de sistema (`tsconfig.json`, `vite.config.ts`, etc.).
18. ❌ Alterar o frontend.
19. ❌ Alterar o backend (código ou hooks).
20. ❌ Alterar qualquer arquivo que não seja `PLAN_PORTA_2D2B_ENTRY.md`.
21. ❌ Reutilizar ou reativar a compensação R13 v8.

---

## 14. Autorização Futura Ainda Não Concedida

> **Autorização futura ainda não concedida.**

A autorização para executar a Porta 2D.2B será redigida externamente apenas após a aprovação deste plano corrigido. Nenhum texto executável, prompt ou instrução de execução é incluído nesta seção. Nenhuma ação deve ser tomada com base neste documento sem nova autorização explícita do project owner.

---

## 15. Relatório de Correções Item por Item

| #   | Correção                                                                                                                                                                                                                                                                | Status      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **Total e fases corrigidos:** 8 negativos (A1–A8), 5 funcionais (B1–B5), 2 rollback (C1–C2), 1 probe (D1) = **16 chamadas**. B6/B7 renomeados para C1/C2 em todas as tabelas, referências e relatório final.                                                            | ✅ Aplicada |
| 2   | **Ordem de execução corrigida:** confirmar flag=false; A1→503; habilitar true; A2–A8, B1–B5, C1–C2; restaurar false; D1→503.                                                                                                                                            | ✅ Aplicada |
| 3   | **`com_eventos_integracao` delta unificado:** valor único +5 (B1, B3, B4, B5, C1 compensador; B2=0, C2=0). Eliminado o valor +6 de todas as seções. Derivação linha a linha incluída.                                                                                   | ✅ Aplicada |
| 4   | **B5 vs `com_vinculos_externos` resolvido e provado (S8):** delta +3 (B1, B3, B5). S8 provado — o caminho `!nRec` em `ac_webhook.js` cria vínculo via `new Record(vCol2)` + `$app.save(vRec2)`.                                                                         | ✅ Aplicada |
| 5   | **C1 execução resolvido e provado (S9):** C1 não cria execução (delta +4 para `com_execucoes_sincronizacao`). S9 provado — o endpoint de rollback não cria registro em `com_execucoes_sincronizacao`.                                                                   | ✅ Aplicada |
| 6   | **C2 contrato único e provado (S10):** HTTP 200 com `{ success: true, rolled_back: [], idempotent: true }` e delta 0. S10 provado — idempotency_key determinística sem `Date.now()`.                                                                                    | ✅ Aplicada |
| 7   | **Coluna Headers adicionada:** B1–B5 e C1–C2 incluem coluna Headers com `Content-Type`, `X-AC-Signature: <válido>` e `timestamp: <válido no corpo>`, sem expor secrets.                                                                                                 | ✅ Aplicada |
| 8   | **`com_auditoria` delta provado (S11):** delta total = 0. O hook `audit_negocios.js` utiliza `onRecordUpdateRequest` (hook de requisição HTTP), que não dispara em `$app.save()` server-side. Delta direto = 0; delta indireto = 0; delta total = 0.                    | ✅ Aplicada |
| 9   | **A4 e A6 corrigidos:** ambos requerem assinatura válida E timestamp válido no corpo, garantindo que cada teste falha pelo motivo específico (A4: sem tipo/id externo; A6: corpo > 256KB). A4 payload substituído por corpo JSON sintético com apenas timestamp válido. | ✅ Aplicada |
| 10  | **S1–S11 como pré-requisitos provados:** S1–S11 todos provados com deltas únicos e definitivos.                                                                                                                                                                         | ✅ Aplicada |
| 11  | **Consistência geral:** todas as tabelas, GO/NO-GO, referências e relatório final atualizados para eliminar contradições.                                                                                                                                               | ✅ Aplicada |
| 12  | **HMAC documentado e provado (S1):** assinatura sobre `toString(e.request.body)` (raw body), sem canonicalização. `$security.hs256(rawBody, webhookSecret)`. Timestamp obrigatório, dentro de 5 minutos. Comparação em tempo constante.                                 | ✅ Aplicada |
| 13  | **Rollback documentado e provado (S6):** alvos identificados por correlation keys e relações estruturais. Pré-requisitos simultâneos: superadmin + HMAC + timestamp + `entity_type=business`. Contrato único para C1 e C2. R13 v8 não reutilizado.                      | ✅ Aplicada |
| 14  | **Prompt futuro removido:** seção "Autorização futura ainda não concedida" sem texto executável.                                                                                                                                                                        | ✅ Aplicada |
| 15  | **C1 restauração documentada:** `titulo`, `valor`, `etapa`, `resultado` restaurados por presença de propriedade (`hasOwnProperty`), preservando zeros e strings vazias.                                                                                                 | ✅ Aplicada |
| 16  | **Body limit documentado:** `$apis.bodyLimit(262144)` aplicado como middleware em ambos os endpoints (webhook e rollback).                                                                                                                                              | ✅ Aplicada |
| 17  | **C1 contrato final:** HTTP 200 com `success: true`, `idempotent: false`, `rolled_back` com exatamente 1 item contendo `collection`, `record_id`, `action: "restored_from_snapshot"`.                                                                                   | ✅ Aplicada |
| 18  | **`Content-Type` em C1/C2 documentado como requisito do plano:** o plano exige `Content-Type: application/json` nas chamadas C1/C2. O hook `ac_rollback.js` não contém validação explícita de `Content-Type`.                                                           | ✅ Aplicada |
| 19  | **S11 marcado como PROVADO:** delta total `com_auditoria = +0`. Removidas todas as expressões condicionais ("parcialmente provado", "condicionado", "pode ser >0", "a confirmar na execução") e fórmulas alternativas.                                                  | ✅ Aplicada |
| 20  | **Registro final:** bloco JSON exato registrado abaixo. Único arquivo alterado: `PLAN_PORTA_2D2B_ENTRY.md`.                                                                                                                                                             | ✅ Aplicada |

---

## 16. Registro Final

**Único arquivo alterado:** `PLAN_PORTA_2D2B_ENTRY.md`

**Nenhuma rota executada. Nenhum teste executado. Nenhuma query executada. Nenhum webhook executado. Nenhuma chamada externa feita. Nenhum dado alterado. Nenhum lock modificado. Nenhum código alterado. Nenhum hook alterado. Nenhum frontend alterado. Nenhum backend alterado. Nenhum schema alterado. Nenhuma migração alterada. Nenhuma configuração alterada. Nenhuma credencial exposta.**

**Estágio de análise estática: COMPLETO (S1–S11 provados).**

**Porta 2D.2B: NÃO INICIADA.**
**Porta 2E: NÃO INICIADA.**
**Aguardando nova autorização explícita para executar a Porta 2D.2B.**

```json
{
  "documentation_only": true,
  "files_modified": ["PLAN_PORTA_2D2B_ENTRY.md"],
  "analysis_executed": false,
  "static_analysis_completed": true,
  "static_analysis_items_proven": [
    "S1",
    "S2",
    "S3",
    "S4",
    "S5",
    "S6",
    "S7",
    "S8",
    "S9",
    "S10",
    "S11"
  ],
  "static_analysis_items_partially_proven": [],
  "routes_executed": 0,
  "tests_executed": 0,
  "records_created": 0,
  "records_updated": 0,
  "records_deleted": 0,
  "parameters_modified": 0,
  "activecampaign_calls": 0,
  "porta_2d2b_started": false,
  "porta_2d2b_authorized": false,
  "com_auditoria_delta": 0,
  "s11_proven": true
}
```
