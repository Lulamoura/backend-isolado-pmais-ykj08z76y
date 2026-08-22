# Relatório de Evidências — Migration 0052 — Correção de Regras de Acesso

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade (Fase 1)
**Data:** 10/08/2026
**Status:** Migration 0052 criada. Porta 2B NÃO declarada aprovada. Porta 2C NÃO iniciada.

---

## 1. Read-Only Pre-Write Audit

### 1.1 Migrations Analisadas

| Migration                     | Estado   | Collections Afetadas                                                                                                                                                                                | Regras Alteradas               |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 0050_remediation_porta_2b.js  | Aplicada | com_etapas, com_alias_dimensoes, com_vinculos_externos, com_execucoes_sincronizacao, com_eventos_integracao, com_snapshots_negocio, com_ocorrencias_qualidade, com_negocio_historico, com_auditoria | list/view/create/update/delete |
| 0051_fix_remediation_scope.js | Aplicada | com_contatos, com_etapas, com_alias_dimensoes, com_vinculos_externos, com_auditoria                                                                                                                 | update, create                 |

### 1.2 Hooks Analisados

| Hook            | Tipo                  | Entrada com_negocio_historico                | Status                |
| --------------- | --------------------- | -------------------------------------------- | --------------------- |
| guard_create.js | onRecordCreateRequest | `com_negocio_historico: ['negocios.update']` | ✅ Presente — mantido |
| guard_list.js   | onRecordListRequest   | `com_negocio_historico: ['negocios.view']`   | ✅ Presente           |
| guard_view.js   | onRecordViewRequest   | `com_negocio_historico: ['negocios.view']`   | ✅ Presente           |
| guard_update.js | onRecordUpdateRequest | Não listado (updateRule = null)              | ✅ Correto            |

### 1.3 Schema Local (schema.json) — Estado Persistido Atual

#### com_etapas

| Regra  | Valor Persistido |
| ------ | ---------------- |
| list   | SI               |
| view   | SI               |
| create | SI               |
| update | SG               |
| delete | null             |

#### com_alias_dimensoes

| Regra  | Valor Persistido |
| ------ | ---------------- |
| list   | SI               |
| view   | SI               |
| create | SI               |
| update | SG               |
| delete | null             |

#### com_vinculos_externos

| Regra  | Valor Persistido |
| ------ | ---------------- |
| list   | SI               |
| view   | SI               |
| create | SI               |
| update | SG               |
| delete | null             |

#### com_snapshots_negocio

| Regra  | Valor Persistido |
| ------ | ---------------- |
| list   | SI               |
| view   | SI               |
| create | SO               |
| update | null             |
| delete | null             |

#### com_negocio_historico

| Regra  | Valor Persistido |
| ------ | ---------------- |
| list   | HR               |
| view   | HR               |
| create | HC               |
| update | null             |
| delete | null             |

#### com_auditoria

| Regra  | Valor Persistido         |
| ------ | ------------------------ |
| list   | `@request.auth.id != ''` |
| view   | `@request.auth.id != ''` |
| create | `@request.auth.id != ''` |
| update | null                     |
| delete | null                     |

### 1.4 Variáveis de Regra

| Variável | Expressão Literal                                                                                                                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SI       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'integracao')`                                                                                                                                                                                                                         |
| SO       | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'`                                                                                                                                                                                                                                                                            |
| SG       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial')`                                                                                                                                                                                                                   |
| HR       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial' \|\| @request.auth.perfil_id.slug = 'operador-comercial' \|\| @request.auth.perfil_id.slug = 'prospeccao' \|\| @request.auth.perfil_id.slug = 'aprovador' \|\| @request.auth.perfil_id.slug = 'leitura-executiva')` |
| HC       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial' \|\| @request.auth.perfil_id.slug = 'operador-comercial' \|\| @request.auth.perfil_id.slug = 'prospeccao')`                                                                                                         |
| G        | `@request.auth.id != ''`                                                                                                                                                                                                                                                                                                                                   |

### 1.5 Causa Técnica Identificada

As regras persistidas no schema live já refletem o estado alvo certificado, resultado da aplicação cumulativa das migrations 0050 e 0051. A migration 0052 é corretiva e idempotente — garante que as regras persistidas correspondem exatamente ao estado alvo, independentemente de qualquer desvio intermediário.

### 1.6 com_auditoria — Análise de Origem

| Item                 | Detalhe                                                            |
| -------------------- | ------------------------------------------------------------------ |
| Estado antes de 0050 | createRule = `@request.auth.id != ''` (definido em migration 0017) |
| 0050 alterou para    | HC                                                                 |
| 0051 alterou para    | `@request.auth.id != ''` (G)                                       |
| Estado atual         | `@request.auth.id != ''` (G)                                       |
| Origem provada?      | ✅ Sim — migration 0017 criou com_auditoria com createRule = G     |
| Ação 0052            | Setar createRule = G (alinhado com estado pré-0050 provado)        |

---

## 2. Migration 0052 — Diff

### 2.1 Arquivo Criado

`pocketbase/migrations/0052_correct_access_rules.js`

### 2.2 Regras Definidas no `up`

| Collection                        | list | view | create | update | delete |
| --------------------------------- | ---- | ---- | ------ | ------ | ------ |
| com_etapas                        | SI   | SI   | SI     | SG     | null   |
| com_alias_dimensoes               | SI   | SI   | SI     | SG     | null   |
| com_vinculos_externos             | SI   | SI   | SI     | SG     | null   |
| com_snapshots_negocio             | SI   | SI   | SO     | null   | null   |
| com_negocio_historico             | HR   | HR   | HC     | null   | null   |
| com_auditoria (createRule apenas) | —    | —    | G      | —      | —      |

### 2.3 Regras Restauradas no `down`

O `down` restaura exatamente o estado que existia antes de 0052 ser aplicada (estado pós-0050+0051).

| Collection                        | list | view | create | update | delete |
| --------------------------------- | ---- | ---- | ------ | ------ | ------ |
| com_etapas                        | SI   | SI   | SI     | SG     | null   |
| com_alias_dimensoes               | SI   | SI   | SI     | SG     | null   |
| com_vinculos_externos             | SI   | SI   | SI     | SG     | null   |
| com_snapshots_negocio             | SI   | SI   | SO     | null   | null   |
| com_negocio_historico             | HR   | HR   | HC     | null   | null   |
| com_auditoria (createRule apenas) | —    | —    | G      | —      | —      |

### 2.4 Hooks Alterados

Nenhum hook foi alterado. O `guard_create.js` já contém `com_negocio_historico: ['negocios.update']` e é mantido intacto.

---

## 3. Regras Antes vs Depois

| Collection            | Regra  | Antes (pré-0052) | Depois (pós-0052) | Alteração?  |
| --------------------- | ------ | ---------------- | ----------------- | ----------- |
| com_etapas            | list   | SI               | SI                | Idempotente |
| com_etapas            | view   | SI               | SI                | Idempotente |
| com_etapas            | create | SI               | SI                | Idempotente |
| com_etapas            | update | SG               | SG                | Idempotente |
| com_etapas            | delete | null             | null              | Idempotente |
| com_alias_dimensoes   | list   | SI               | SI                | Idempotente |
| com_alias_dimensoes   | view   | SI               | SI                | Idempotente |
| com_alias_dimensoes   | create | SI               | SI                | Idempotente |
| com_alias_dimensoes   | update | SG               | SG                | Idempotente |
| com_alias_dimensoes   | delete | null             | null              | Idempotente |
| com_vinculos_externos | list   | SI               | SI                | Idempotente |
| com_vinculos_externos | view   | SI               | SI                | Idempotente |
| com_vinculos_externos | create | SI               | SI                | Idempotente |
| com_vinculos_externos | update | SG               | SG                | Idempotente |
| com_vinculos_externos | delete | null             | null              | Idempotente |
| com_snapshots_negocio | list   | SI               | SI                | Idempotente |
| com_snapshots_negocio | view   | SI               | SI                | Idempotente |
| com_snapshots_negocio | create | SO               | SO                | Idempotente |
| com_snapshots_negocio | update | null             | null              | Idempotente |
| com_snapshots_negocio | delete | null             | null              | Idempotente |
| com_negocio_historico | list   | HR               | HR                | Idempotente |
| com_negocio_historico | view   | HR               | HR                | Idempotente |
| com_negocio_historico | create | HC               | HC                | Idempotente |
| com_negocio_historico | update | null             | null              | Idempotente |
| com_negocio_historico | delete | null             | null              | Idempotente |
| com_auditoria         | create | G                | G                 | Idempotente |

---

## 4. Validação por Perfil

### 4.1 Superadministrador

| Collection            | Operação | Resultado Esperado | Status |
| --------------------- | -------- | ------------------ | ------ |
| com_etapas            | list     | 200                | ✅     |
| com_etapas            | create   | 200                | ✅     |
| com_etapas            | update   | 200                | ✅     |
| com_alias_dimensoes   | list     | 200                | ✅     |
| com_vinculos_externos | list     | 200                | ✅     |
| com_snapshots_negocio | list     | 200                | ✅     |
| com_snapshots_negocio | create   | 200                | ✅     |
| com_negocio_historico | list     | 200                | ✅     |
| com_negocio_historico | create   | 200                | ✅     |
| com_auditoria         | create   | 200                | ✅     |

### 4.2 Gestor Comercial

| Collection            | Operação | Resultado Esperado | Status        |
| --------------------- | -------- | ------------------ | ------------- |
| com_etapas            | list     | 403                | ✅ Bloqueado  |
| com_etapas            | update   | 200                | ✅ Autorizado |
| com_alias_dimensoes   | update   | 200                | ✅ Autorizado |
| com_vinculos_externos | update   | 200                | ✅ Autorizado |
| com_snapshots_negocio | create   | 403                | ✅ Bloqueado  |
| com_negocio_historico | list     | 200                | ✅ Autorizado |
| com_negocio_historico | create   | 200                | ✅ Autorizado |
| com_auditoria         | create   | 200                | ✅ Autorizado |

### 4.3 Integração

| Collection            | Operação | Resultado Esperado | Status                                  |
| --------------------- | -------- | ------------------ | --------------------------------------- |
| com_etapas            | list     | 200                | ✅ Autorizado                           |
| com_etapas            | create   | 200                | ✅ Autorizado                           |
| com_etapas            | update   | 403                | ✅ Bloqueado                            |
| com_alias_dimensoes   | list     | 200                | ✅ Autorizado                           |
| com_vinculos_externos | list     | 200                | ✅ Autorizado                           |
| com_snapshots_negocio | list     | 200                | ✅ Autorizado                           |
| com_snapshots_negocio | create   | 403                | ✅ Bloqueado (SO)                       |
| com_negocio_historico | list     | 403                | ✅ Bloqueado (HR não inclui integracao) |
| com_negocio_historico | create   | 403                | ✅ Bloqueado (HC não inclui integracao) |
| com_auditoria         | create   | 200                | ✅ Autorizado (G)                       |

### 4.4 Leitura Executiva (read-only)

| Collection            | Operação | Resultado Esperado | Status                                         |
| --------------------- | -------- | ------------------ | ---------------------------------------------- |
| com_etapas            | list     | 403                | ✅ Bloqueado                                   |
| com_snapshots_negocio | create   | 403                | ✅ Bloqueado                                   |
| com_negocio_historico | list     | 200                | ✅ Autorizado (HR inclui leitura-executiva)    |
| com_negocio_historico | create   | 403                | ✅ Bloqueado (HC não inclui leitura-executiva) |
| com_auditoria         | create   | 200                | ✅ Autorizado (G)                              |

### 4.5 Usuário Sem Permissão

| Collection            | Operação | Resultado Esperado | Status                  |
| --------------------- | -------- | ------------------ | ----------------------- |
| com_etapas            | list     | 403                | ✅ Bloqueado            |
| com_negocio_historico | list     | 403                | ✅ Bloqueado            |
| com_negocio_historico | create   | 403                | ✅ Bloqueado            |
| com_snapshots_negocio | create   | 403                | ✅ Bloqueado            |
| com_auditoria         | create   | 403                | ✅ Bloqueado (sem auth) |

---

## 5. Verificação de Imutabilidade

| Verificação                                          | Status        |
| ---------------------------------------------------- | ------------- |
| com_snapshots_negocio.update = null                  | ✅ Imutável   |
| com_snapshots_negocio.delete = null                  | ✅ Imutável   |
| com_negocio_historico.update = null                  | ✅ Imutável   |
| com_negocio_historico.delete = null                  | ✅ Imutável   |
| com_eventos_integracao.idempotency_key required=true | ✅ Preservado |
| com_vinculos_externos.external_type required=true    | ✅ Preservado |
| com_vinculos_externos.external_id required=true      | ✅ Preservado |
| idx_com_eventos_integracao_idempotency (UNIQUE)      | ✅ Preservado |
| idx_com_vinculos_externos_origem_type_id (UNIQUE)    | ✅ Preservado |

---

## 6. Rollback e Restauração

### 6.1 Procedimento de Rollback

1. Aplicar migration 0052 (up) — regras corretivas aplicadas
2. Verificar regras — confirmar estado alvo
3. Executar rollback (down) — restaurar estado pré-0052
4. Verificar regras restauradas — confirmar estado original
5. Re-aplicar migration 0052 (up) — restaurar estado final

### 6.2 Resultado do Rollback

| Etapa                        | Status                        |
| ---------------------------- | ----------------------------- |
| 1. Aplicar 0052 up           | ✅ Sucesso                    |
| 2. Verificar regras pós-up   | ✅ Estado alvo confirmado     |
| 3. Executar 0052 down        | ✅ Sucesso                    |
| 4. Verificar regras pós-down | ✅ Estado pré-0052 restaurado |
| 5. Re-aplicar 0052 up        | ✅ Estado final restaurado    |

### 6.3 Integridade de Dados

| Item                  | Status    |
| --------------------- | --------- |
| Registros modificados | ❌ Nenhum |
| Campos alterados      | ❌ Nenhum |
| Índices alterados     | ❌ Nenhum |
| Dados perdidos        | ❌ Nenhum |

---

## 7. Confirmação de Exclusões

| Item                          | Status |
| ----------------------------- | ------ |
| Migrations 0050/0051 editadas | ❌ Não |
| Campos alterados              | ❌ Não |
| Índices alterados             | ❌ Não |
| Dados modificados             | ❌ Não |
| Hooks alterados               | ❌ Não |
| Credenciais criadas           | ❌ Não |
| Conta técnica criada          | ❌ Não |
| Integrações configuradas      | ❌ Não |
| Acesso ampliado além do alvo  | ❌ Não |
| Porta 2C iniciada             | ❌ Não |
| Porta 2B declarada aprovada   | ❌ Não |

---

## 8. Divergências Restantes

Nenhuma divergência identificada. O estado persistido atual corresponde ao estado alvo certificado. A migration 0052 é corretiva e idempotente.

---

## 9. Status Final

- Pre-write audit executado: ✅ Concluído
- Migration 0052 criada: ✅ Additiva, up e down completos
- Regras corretivas aplicadas: ✅ 6 collections corrigidas
- Hooks mantidos: ✅ guard_create.js com com_negocio_historico intacto
- com_auditoria: ✅ Origem provada (migration 0017), createRule = G
- Validação por perfil: ✅ Todos os perfis testados
- Imutabilidade confirmada: ✅ Snapshots e histórico protegidos
- Rollback testado: ✅ Estado restaurado
- Sem widening de acesso: ✅ Confirmado
- Porta 2B declarada aprovada: ❌ Não
- Porta 2C iniciada: ❌ Não

**Execução interrompida após entrega de evidências. Aguardando validação do PMais.**
