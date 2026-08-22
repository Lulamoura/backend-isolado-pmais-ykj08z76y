# Porta 2D.2A — Classification Window Constant Correction

## Diagnóstico de Consulta de Dependências — Correção da Janela de Classificação

**Data:** 2026-08-12  
**Tipo:** Correção de constantes (somente janela de classificação e metadados)  
**Execução:** Zero — nenhuma rota chamada, nenhum botão clicado, nenhum lock consumido

---

## 1. Prova Documental da Janela (Sem Consulta de Dados)

### Timestamps Inventariados (já documentados em R13/Round 13)

| Campo                            | Valor UTC                  | Origem                                                  |
| -------------------------------- | -------------------------- | ------------------------------------------------------- |
| `diagnostic_reference_timestamp` | `2026-08-11T20:38:39.922Z` | Timestamp de referência do diagnóstico (diag-transport) |
| `observed_created_min`           | `2026-08-11T20:38:39.948Z` | Menor `created` observado nos registros inventariados   |
| `observed_created_max`           | `2026-08-11T20:38:39.951Z` | Maior `created` observado nos registros inventariados   |

### Janela de Classificação Corrigida

| Campo                             | Valor UTC                  |
| --------------------------------- | -------------------------- |
| `classification_window_start_utc` | `2026-08-11T20:38:39.900Z` |
| `classification_window_end_utc`   | `2026-08-11T20:38:40.000Z` |

### Justificativa da Tolerância (`tolerance_rationale`)

Os valores `created` observados caem ~26–29ms após o timestamp de referência (`2026-08-11T20:38:39.922Z`):

- Referência: `39.922Z`
- Created min: `39.948Z` → +26ms após referência
- Created max: `39.951Z` → +29ms após referência

A janela de 100ms (`39.900Z` a `40.000Z`) é o menor envelope arredondado que contém todos os timestamps inventariados (referência `39.922Z`, created min `39.948Z`, created max `39.951Z`). Nenhuma janela arbitrária de horas/dias é utilizada.

---

## 2. Correção Somente de Constantes

### O que foi alterado

Apenas as constantes da janela de classificação e metadados foram editados em `ac_diag_consulta_dependencias.js`:

- `ROUTE_VERSION` → `R13-2D2A-DIAG-CONSULTA-DEPENDENCIAS-BACKEND-20260812-v2`
- Novas constantes adicionadas: `DIAGNOSTIC_REFERENCE_TIMESTAMP`, `OBSERVED_CREATED_MIN`, `OBSERVED_CREATED_MAX`, `CLASSIFICATION_WINDOW_START_UTC`, `CLASSIFICATION_WINDOW_END_UTC`, `TOLERANCE_RATIONALE`
- Derivação dinâmica da janela a partir dos campos `inicio`/`fim` do registro de execução foi substituída por constantes fixas UTC
- Objeto `temporal_correlation` nos resultados agora referencia a janela constante
- Bloco `documentary_proof` adicionado à resposta JSON
- Array `inconclusive_triggers` adicionado à resposta JSON

### O que NÃO foi alterado

- Filtro fixo server-side: `execucao_id = "62otoics23ul0vy"` em `com_ocorrencias_qualidade` — inalterado
- Campos retornados — estrutura inalterada
- Autenticação (verificação de superadministrador) — inalterada
- Lock independente one-shot (`ac_diag_consulta_dependencias_lock`) — permanece `armed`
- Todas as regras de classificação (DIAGNOSTIC_OWNED, PREEXISTENT, INCONCLUSIVE) — inalteradas
- Webhook, runner, RBAC, migrações, coleções, segredos, integrações — inalterados

---

## 3. Regras de Classificação (Literais — Inalteradas)

### DIAGNOSTIC_OWNED

`execucao_id` corresponde ao alvo AND origem corresponde ao transporte diagnóstico (activecampaign) AND `created` dentro da janela de classificação (`2026-08-11T20:38:39.900Z` a `2026-08-11T20:38:40.000Z`) AND tipo/severidade/descricao consistentes com o diagnóstico.

### PREEXISTENT

`created` antes da janela de classificação OU pertence a origem diferente.

### INCONCLUSIVE

Propriedade diagnóstica não pode ser comprovada — NUNCA presumida como deletável.

### Gatilhos de INCONCLUSIVE (Literais)

Qualquer um dos seguintes resulta em `INCONCLUSIVE` — nunca `DIAGNOSTIC_OWNED`:

- `sistema_origem` ausente ou vazio
- `tipo` ou `descricao` genéricos (não consistentes com padrões diagnósticos)
- Timestamp ausente ou fora da janela (`created` fora de `2026-08-11T20:38:39.900Z` a `2026-08-11T20:38:40.000Z`)
- Qualquer evidência divergente que impeça comprovar todas as quatro condições de `DIAGNOSTIC_OWNED` simultaneamente

---

## 4. Confirmação de Proteção

- A classificação **não autoriza nenhuma exclusão**
- O campo `deletable` é `false` para TODOS os registros na resposta
- Registros `PREEXISTENT` permanecem **expressamente protegidos**
- Registros `INCONCLUSIVE` permanecem **expressamente protegidos**
- Apenas registros `DIAGNOSTIC_OWNED` podem ser considerados para futura compensação

---

## 5. Versões Republicadas (Porta 2D.2A/R13 — sem R14)

| Artefato          | Versão v1 (anterior)                                        | Versão v2 (corrigida)                                      |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Backend (hook)    | `R13/2D.2A-DIAG-CONSULTA-DEPENDENCIAS-20260812-v1`          | `R13-2D2A-DIAG-CONSULTA-DEPENDENCIAS-BACKEND-20260812-v2`  |
| Frontend (bundle) | `R13/2D.2A-DIAG-CONSULTA-DEPENDENCIAS-FRONTEND-20260812-v1` | `R13-2D2A-DIAG-CONSULTA-DEPENDENCIAS-FRONTEND-20260812-v2` |

`r14_scope_advanced` = `false` — nenhum escopo funcional R14 foi avançado.

---

## 6. Estado de Prontidão (JSON Literal)

```json
{
  "r14_scope_advanced": false,
  "dependency_query_executed": false,
  "dependency_query_lock": "armed",
  "original_audit_lock": "consumed",
  "deletion_executed": false,
  "activecampaign_calls": 0
}
```

---

## 7. Escopo Bloqueado (Permanece)

- R14 escopo funcional: **BLOQUEADO**
- Compensação: **BLOQUEADO**
- Porta 2D.2B: **BLOQUEADO**
- Porta 2E: **BLOQUEADO**

---

## 8. Evidência Sanitizada

- Nenhum registro criado, atualizado ou excluído
- Nenhum dado buscado do banco
- Nenhuma rota chamada
- Nenhum botão clicado
- Nenhum lock consumido
- Nenhuma chamada ActiveCampaign
- Nenhuma migração criada
- Nenhuma coleção alterada
- Nenhum RBAC alterado
- Nenhum segredo alterado
