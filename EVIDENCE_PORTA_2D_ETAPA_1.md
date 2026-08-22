# Porta 2D — Etapa 1: Preparação da Integração ActiveCampaign

## Visão Geral

Esta entrega é **puramente preparatória**. Nenhum webhook é registrado no ActiveCampaign, nenhuma chamada externa é feita, nenhum dado (mesmo sintético) é carregado, e nenhuma credencial é exposta ou inventada. O endpoint do webhook existe mas está **desabilitado para tráfego externo** via feature flag.

## Arquivos Criados

| Arquivo                           | Tipo         | Descrição                                              |
| --------------------------------- | ------------ | ------------------------------------------------------ |
| `pocketbase/hooks/ac_precheck.js` | Hook (GET)   | Pre-check de secrets — reporta apenas PRESENTE/AUSENTE |
| `pocketbase/hooks/ac_webhook.js`  | Hook (POST)  | Endpoint de webhook (desabilitado) com fluxo completo  |
| `pocketbase/hooks/ac_rollback.js` | Hook (POST)  | Endpoint de rollback (desabilitado) por entidade       |
| `EVIDENCE_PORTA_2D_ETAPA_1.md`    | Documentação | Esta evidência                                         |

## Nenhuma alteração em arquivos existentes

- Nenhuma migração criada ou modificada (0017 e 0050–0058 intocadas)
- Nenhum guard hook modificado
- Nenhuma regra de coleção alterada
- Nenhum perfil, permissão ou conta modificada
- Nenhum hook permanente alterado

---

## 1. Pre-check de Secrets

### Rota

```
GET /backend/v1/integracao/ac/precheck
```

### Acesso

Superadministrador apenas (via `perfil_id.slug = 'superadministrador'` ou binding em `com_usuarios_equipes`).

### Secrets verificados

| Secret              | Status              |
| ------------------- | ------------------- |
| `AC_API_URL`        | PRESENTE ou AUSENTE |
| `AC_API_KEY`        | PRESENTE ou AUSENTE |
| `AC_WEBHOOK_SECRET` | PRESENTE ou AUSENTE |

### Garantias

- A resposta **nunca** inclui valor, tamanho, hash, Base64 ou fragmento de qualquer secret
- Usa exclusivamente `$secrets.has()` — nunca `$secrets.get()`
- Se um secret estiver ausente, apenas o nome do secret ausente é reportado
- Nenhum secret é utilizado, inserido em código, log ou evidência
- Nenhum secret alternativo ou fallback é criado

### Resposta de exemplo

```json
{
  "stage": "porta-2d-etapa-1",
  "secrets": {
    "AC_API_URL": "AUSENTE",
    "AC_API_KEY": "AUSENTE",
    "AC_WEBHOOK_SECRET": "AUSENTE"
  },
  "allPresent": false,
  "ready": false,
  "absentSecrets": ["AC_API_URL", "AC_API_KEY", "AC_WEBHOOK_SECRET"],
  "message": "Secrets ausentes. Aguardando PMais registrar no vault: AC_API_URL, AC_API_KEY, AC_WEBHOOK_SECRET"
}
```

---

## 2. Endpoint de Webhook (Desabilitado)

### Rota planejada

```
POST /backend/v1/integracao/ac/webhook
```

### Status

**DESHABILITADO** — feature flag `WEBHOOK_ENABLED = false` retorna HTTP 503 para toda requisição.

### Nenhum registro externo

- Nenhum webhook é registrado no ActiveCampaign
- Nenhuma chamada de API é feita para o ActiveCampaign
- Nenhum scheduler, reconciliação ou carregamento de amostra é iniciado

### Content-Type e limite de tamanho

- Content-Type deve ser `application/json`
- Limite de corpo: 256 KB (262144 bytes)

---

## 3. Algoritmo de Validação de Assinatura

### Header customizado

```
X-AC-Signature: <hex_hmac_sha256>
```

### Algoritmo

1. Preservar o corpo bruto (raw body) antes de qualquer parse
2. Calcular `HMAC-SHA256(rawBody, AC_WEBHOOK_SECRET)` usando `$security.hs256(body, secret)`
3. Comparar com a assinatura recebida no header `X-AC-Signature` usando **comparação em tempo constante** (XOR byte-a-byte sem short-circuit)
4. Rejeitar se ausente ou se a comparação falhar

### Comparação em tempo constante

```javascript
var sigDiff = 0
for (var i = 0; i < expectedSig.length; i++) {
  sigDiff |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i)
}
if (sigDiff !== 0) return e.unauthorizedError('Assinatura invalida')
```

### Nota sobre raw body

O JSVM do PocketBase não expõe diretamente o corpo bruto antes do parse. A implementação usa `JSON.stringify(e.requestInfo().body)` como corpo para a validação. Quando o webhook for ativado, recomenda-se capturar o corpo bruto via middleware Go nativo para garantir validação exata byte-a-byte.

---

## 4. Janela Anti-replay

- Quando o payload contém `timestamp` ou `ts`, a janela de 5 minutos (300000 ms) é enforced
- Eventos fora da janela são rejeitados com HTTP 400
- Se nenhum timestamp estiver presente, a verificação é pulada (compatibilidade)

---

## 5. Estratégia de Idempotência

### Derivação da chave

```
idempotency_key = SHA-256(sistema_origem + "|" + evento_tipo + "|" + external_id)
```

### Campos usados

| Campo            | Origem                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `sistema_origem` | Constante: `"activecampaign"`                                                              |
| `evento_tipo`    | Campo real do payload (`body.type`, `body.event`, ou `body.action`)                        |
| `external_id`    | ID real da entidade no payload (`body.contact.id`, `body.organization.id`, `body.deal.id`) |

### Garantias

- **Nenhum `event_id` presumido** — a chave é derivada apenas de campos reais
- A chave é determinística: o mesmo evento sempre produz a mesma chave
- O campo `idempotency_key` em `com_eventos_integracao` tem **índice UNIQUE** (proteção adicional no banco)
- Duplicatas retornam resposta segura e determinística: `{ received: true, duplicate: true, event_id, status }`
- Duplicatas **não** criam segundo evento funcional, **não** alteram o status do evento original, **não** duplicam contato, empresa, negócio, vínculo, auditoria ou snapshot

---

## 6. Mapeamento Evento → Coleção → Operação

| Evento (evento_tipo)    | entityType | Coleção        | Operação                          |
| ----------------------- | ---------- | -------------- | --------------------------------- |
| `contact.*`             | contact    | `com_contatos` | create / update                   |
| `organization.*`        | company    | `com_empresas` | create / update                   |
| `deal.*` / `business.*` | business   | `com_negocios` | create / update (etapa/resultado) |

### Detecção de operação

- `create`: evento_tipo contém "create"
- `update`: caso contrário

---

## 7. Campos Mínimos Persistidos

### com_eventos_integracao

| Campo             | Valor                              |
| ----------------- | ---------------------------------- |
| `sistema_origem`  | `"activecampaign"`                 |
| `evento_tipo`     | Tipo do evento                     |
| `external_id`     | ID externo real                    |
| `idempotency_key` | SHA-256 derivado                   |
| `payload`         | JSON serializado (máx 4000 chars)  |
| `status`          | `received` → `processed` / `error` |

### com_execucoes_sincronizacao

| Campo            | Valor                                |
| ---------------- | ------------------------------------ |
| `sistema_origem` | `"activecampaign"`                   |
| `status`         | `processing` → `completed` / `error` |
| `payload`        | JSON serializado (máx 4000 chars)    |
| `inicio`         | ISO timestamp                        |
| `fim`            | ISO timestamp                        |

### com_vinculos_externos

| Campo             | Valor                                            |
| ----------------- | ------------------------------------------------ |
| `sistema_origem`  | `"activecampaign"`                               |
| `external_type`   | `contact` / `company` / `business`               |
| `external_id`     | ID externo real                                  |
| `collection_name` | `com_contatos` / `com_empresas` / `com_negocios` |
| `record_id`       | ID interno do registro criado/atualizado         |

### com_snapshots_negocio

| Campo        | Valor                         |
| ------------ | ----------------------------- |
| `negocio_id` | ID do negócio (relation)      |
| `snapshot`   | JSON com estado pré-alteração |
| `origem`     | `"activecampaign"`            |

### com_ocorrencias_qualidade

| Campo         | Valor                     |
| ------------- | ------------------------- |
| `execucao_id` | ID da execução (relation) |
| `tipo`        | `normalization_miss`      |
| `severidade`  | `warning`                 |
| `descricao`   | Descrição sanitizada      |
| `resolvida`   | `false`                   |

---

## 8. Normalização via Catálogos Versionados

### Catálogos usados

- `com_etapas` — catálogo canônico de etapas e resultados
- `com_alias_dimensoes` — mapeamento de valores externos para canônicos

### Fluxo de normalização

1. Receber valor externo (ex: `stage` do deal)
2. Buscar em `com_alias_dimensoes` onde `dimensao = 'etapa'` e `valor_original = valor_externo`
3. Se encontrado: obter `canonico_ref` → buscar em `com_etapas` → usar `codigo` canônico
4. Se **não encontrado**: preservar valor original, registrar ocorrência de qualidade em `com_ocorrencias_qualidade`, **não inventar** valor canônico

### Garantias

- **Nenhum mapa hardcoded** em hooks
- Apenas catálogos versionados são usados
- Valores originais são preservados quando não há mapeamento
- Ocorrências de qualidade são registradas para auditoria

---

## 9. Fluxo de Processamento

```
Evento recebido
    ↓
Content-Type validado
    ↓
Tamanho do corpo validado (≤ 256KB)
    ↓
Assinatura HMAC-SHA256 validada (comparação em tempo constante)
    ↓
Janela anti-replay verificada (se timestamp presente)
    ↓
Campos do evento extraídos (tipo, external_id, entityType)
    ↓
Chave de idempotência derivada: SHA-256(origem|tipo|external_id)
    ↓
Idempotência verificada em com_eventos_integracao
    ↓ (se duplicata: retornar resposta segura)
Evento persistido em com_eventos_integracao
    ↓
Execução registrada em com_execucoes_sincronizacao
    ↓
Vínculo externo verificado em com_vinculos_externos
    ↓
Normalização via com_etapas + com_alias_dimensoes
    ↓ (se miss: ocorrência de qualidade em com_ocorrencias_qualidade)
Registro criado/atualizado (com_contatos / com_empresas / com_negocios)
    ↓
Snapshot criado em com_snapshots_negocio (antes de update de negócio)
    ↓
Vínculo externo criado em com_vinculos_externos (se novo registro)
    ↓
Evento marcado como "processed"
    ↓
Execução marcada como "completed"
    ↓
Resposta 200 { received: true, event_id, status: "processed" }
```

### Tratamento de falhas

- Erros são logados em forma sanitizada (sem secret ou PII desnecessário)
- Evento marcado como `error` com mensagem truncada
- Execução marcada como `error`
- HTTP 500 retornado ao cliente

---

## 10. Snapshot e Rollback

### Snapshot

- **Quando**: antes de qualquer alteração em um negócio (`[TESTE]`)
- **Onde**: `com_snapshots_negocio`
- **Conteúdo**: JSON mínimo com `titulo`, `valor`, `etapa`, `resultado`
- **Imutável**: `updateRule = null`, `deleteRule = null`
- **Origem**: registrada no campo `origem`

### Rollback

- **Rota planejada**: `POST /backend/v1/integracao/ac/rollback`
- **Status**: DESHABILITADO (feature flag)
- **Acesso**: Superadministrador apenas
- **Localização**: via `com_vinculos_externos` (link composto) + `record_id` interno
- **Restauração**: a partir do snapshot mais recente em `com_snapshots_negocio`
- **Compensação**: evento compensador criado em `com_eventos_integracao`
- **Histórico**: preservado (snapshots e eventos não são deletados)
- **Sem deletes físicos**: registros são desativados (`ativo = false`) ou restaurados, nunca removidos
- **Não executado nesta etapa**

---

## 11. RBAC

### Conta técnica

- Perfil: `integracao` (existente, least-privilege)
- Nenhum superadministrador em runtime
- Nenhuma expansão de permissão

### Matriz de permissões do perfil `integracao` (existente)

| Coleção                     | view | create | update | delete |
| --------------------------- | ---- | ------ | ------ | ------ |
| com_contatos                | ✅   | ✅     | ❌     | ❌     |
| com_etapas                  | ✅   | ✅     | ❌     | ❌     |
| com_alias_dimensoes         | ✅   | ✅     | ❌     | ❌     |
| com_vinculos_externos       | ✅   | ✅     | ❌     | ❌     |
| com_execucoes_sincronizacao | ✅   | ✅     | ❌     | ❌     |
| com_eventos_integracao      | ✅   | ✅     | ❌     | ❌     |
| com_snapshots_negocio       | ✅   | ❌     | ❌     | ❌     |
| com_ocorrencias_qualidade   | ✅   | ✅     | ❌     | ❌     |

### Operações bloqueadas

- Update/delete em auditoria e snapshots
- Create/update/delete em com_negocios (via API — operações server-side no webhook usam `$app.save()`)
- Administração de usuários, perfis, equipes, parâmetros

---

## 12. Matriz de Testes Planejada

| #   | Teste                                                | Resultado Esperado                                | Status     |
| --- | ---------------------------------------------------- | ------------------------------------------------- | ---------- |
| 1   | GET precheck sem auth                                | 401 Unauthorized                                  | BLOQUEADO  |
| 2   | GET precheck com usuário não-superadmin              | 403 Forbidden                                     | BLOQUEADO  |
| 3   | GET precheck com superadmin                          | 200 com PRESENTE/AUSENTE por secret               | BLOQUEADO  |
| 4   | Verificar que resposta não contém valor de secret    | Apenas PRESENTE/AUSENTE                           | BLOQUEADO  |
| 5   | POST webhook (desabilitado)                          | 503 com `enabled: false`                          | BLOQUEADO  |
| 6   | POST rollback (desabilitado)                         | 503 com `enabled: false`                          | BLOQUEADO  |
| 7   | Ativar flag → POST sem assinatura                    | 401 Unauthorized                                  | BLOQUEADO  |
| 8   | Ativar flag → POST com assinatura inválida           | 401 Unauthorized                                  | BLOQUEADO  |
| 9   | Ativar flag → POST com assinatura válida             | 200 com event_id                                  | BLOQUEADO  |
| 10  | Ativar flag → POST duplicata (mesma idempotency_key) | 200 com `duplicate: true`                         | BLOQUEADO  |
| 11  | Ativar flag → POST com Content-Type errado           | 400 Bad Request                                   | BLOQUEADO  |
| 12  | Ativar flag → POST com corpo > 256KB                 | 400 Bad Request                                   | BLOQUEADO  |
| 13  | Ativar flag → POST com timestamp fora da janela      | 400 Bad Request                                   | BLOQUEADO  |
| 14  | Ativar flag → evento com etapa sem mapeamento        | Ocorrência de qualidade criada                    | BLOQUEADO  |
| 15  | Ativar flag → update de negócio                      | Snapshot criado antes do update                   | BLOQUEADO  |
| 16  | Ativar flag → rollback de negócio                    | Restaurado do snapshot, evento compensador criado | BLOQUEADO  |
| 17  | Verificar zero chamadas externas                     | Nenhum $http.send para ActiveCampaign             | VERIFICADO |
| 18  | Verificar zero dados reais                           | Nenhum dado carregado                             | VERIFICADO |

---

## 13. Prova de Zero Chamadas Externas e Zero Dados Reais

### Zero chamadas externas

- Nenhum `$http.send()` para `api.activecampaign.com` ou qualquer URL externa
- Nenhum registro de webhook no ActiveCampaign
- Nenhum scheduler ou reconciliação iniciada
- Os únicos `$http.send()` no projeto existem em hooks pré-existentes (`auth_with_password.js`, `change_own_password.js`, `run_positive_tests.js`) — **nenhum novo foi adicionado**

### Zero dados reais

- Nenhum dado (mesmo sintético) é carregado
- Nenhum seed migration criado
- O endpoint do webhook está desabilitado e rejeita toda requisição
- O endpoint de rollback está desabilitado e rejeita toda requisição
- Nenhuma amostra `[TESTE]` é criada

### Zero uso de secrets

- O precheck usa apenas `$secrets.has()` — nunca `$secrets.get()`
- O webhook (desabilitado) contém código que usaria `$secrets.get('AC_WEBHOOK_SECRET')` apenas quando ativado
- Nenhum secret é exibido, logado, hash, ou transmitido em qualquer resposta

---

## 14. Constraints e Ponto de Parada

### NÃO executado nesta etapa

- Nenhum webhook registrado no ActiveCampaign
- Nenhuma chamada de API ao ActiveCampaign
- Nenhum scheduler, reconciliação ou carregamento de amostra
- Nenhuma alteração em conta, perfil, guards, regras ou migrações 0017 e 0050–0058
- Nenhuma publicação em produção
- **Porta 2E permanece bloqueada**
- **Porta 2D NÃO declarada aprovada**

### Ponto de parada

Se qualquer um dos três secrets (`AC_API_URL`, `AC_API_KEY`, `AC_WEBHOOK_SECRET`) estiver ausente, o processo **deve parar** e aguardar PMais registrar e validar o backup no vault antes de qualquer ativação.

### Próximos passos (após confirmação de PMais)

1. Executar `GET /backend/v1/integracao/ac/precheck` para confirmar que todos os secrets estão PRESENTE
2. Ativar feature flag `WEBHOOK_ENABLED = true` em `ac_webhook.js`
3. Executar testes da matriz (items 7–16)
4. Registrar webhook no ActiveCampaign (apenas após validação completa)
5. Remover hooks temporários após validação final
