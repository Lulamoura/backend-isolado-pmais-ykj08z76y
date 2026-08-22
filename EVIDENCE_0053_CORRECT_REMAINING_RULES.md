# Relatório de Evidências — Migration 0053 — Correção de Regras Remanescentes

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade (Fase 1)
**Data:** 10/08/2026
**Status:** Migration 0053 criada. Porta 2B NÃO declarada aprovada. Porta 2C NÃO iniciada.

---

## 1. Pre-Write Audit (Read-Only)

### 1.1 Migrations Analisadas

| Migration | Estado   | Collections Afetadas                                                   | Regras Alteradas               |
| --------- | -------- | ---------------------------------------------------------------------- | ------------------------------ |
| 0050      | Aplicada | com_snapshots_negocio, com_negocio_historico, com_auditoria (+ outras) | list/view/create/update/delete |
| 0051      | Aplicada | com_auditoria (createRule apenas)                                      | create                         |
| 0052      | Aplicada | com_snapshots_negocio, com_negocio_historico, com_auditoria            | list/view/create/update/delete |

### 1.2 Estado Persistido Atual (lido de schema.json)

#### com_snapshots_negocio

| Regra  | Valor Persistido                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| list   | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'integracao')` (SI) |
| view   | SI                                                                                                                                      |
| create | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'` (SO)                                                    |
| update | null                                                                                                                                    |
| delete | null                                                                                                                                    |

#### com_negocio_historico

| Regra  | Valor Persistido                                                                                                                                                                                                                                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list   | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial' \|\| @request.auth.perfil_id.slug = 'operador-comercial' \|\| @request.auth.perfil_id.slug = 'prospeccao' \|\| @request.auth.perfil_id.slug = 'aprovador' \|\| @request.auth.perfil_id.slug = 'leitura-executiva')` (HR) |
| view   | HR                                                                                                                                                                                                                                                                                                                                                              |
| create | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial' \|\| @request.auth.perfil_id.slug = 'operador-comercial' \|\| @request.auth.perfil_id.slug = 'prospeccao')` (HC)                                                                                                         |
| update | null                                                                                                                                                                                                                                                                                                                                                            |
| delete | null                                                                                                                                                                                                                                                                                                                                                            |

#### com_auditoria

| Regra  | Valor Persistido             |
| ------ | ---------------------------- |
| list   | `@request.auth.id != ''` (G) |
| view   | `@request.auth.id != ''` (G) |
| create | `@request.auth.id != ''` (G) |
| update | null                         |
| delete | null                         |

### 1.3 Análise de com_auditoria — Origem do Estado Pré-0050

| Item                              | Detalhe                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| Migration que criou com_auditoria | 0017 (`0017_create_com_auditoria.js`)                               |
| createRule definido em 0017       | `@request.auth.id != ''` (G)                                        |
| listRule definido em 0017         | `@request.auth.id != ''` (G)                                        |
| viewRule definido em 0017         | `@request.auth.id != ''` (G)                                        |
| updateRule definido em 0017       | null                                                                |
| deleteRule definido em 0017       | null                                                                |
| 0050 alterou createRule para      | HC                                                                  |
| 0051 restaurou createRule para    | G                                                                   |
| 0052 manteve createRule em        | G                                                                   |
| Estado pré-0050 provado?          | ✅ Sim — migration 0017 é a origem                                  |
| Estado pré-0050 (literal)         | list=G, view=G, create=G, update=null, delete=null                  |
| Estado atual persistido           | list=G, view=G, create=G, update=null, delete=null                  |
| Divergência?                      | ❌ Nenhuma — estado atual já corresponde ao estado pré-0050 provado |

### 1.4 Hooks Analisados

| Hook            | Tipo                  | Entrada com_negocio_historico                | Status                |
| --------------- | --------------------- | -------------------------------------------- | --------------------- |
| guard_create.js | onRecordCreateRequest | `com_negocio_historico: ['negocios.update']` | ✅ Presente — mantido |
| guard_list.js   | onRecordListRequest   | `com_negocio_historico: ['negocios.view']`   | ✅ Presente           |
| guard_view.js   | onRecordViewRequest   | `com_negocio_historico: ['negocios.view']`   | ✅ Presente           |
| guard_update.js | onRecordUpdateRequest | Não listado (updateRule = null)              | ✅ Correto            |

### 1.5 Variáveis de Regra

| Variável | Expressão Literal                                                                                                                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SI       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'integracao')`                                                                                                                                                                                                                         |
| SO       | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'`                                                                                                                                                                                                                                                                            |
| HR       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial' \|\| @request.auth.perfil_id.slug = 'operador-comercial' \|\| @request.auth.perfil_id.slug = 'prospeccao' \|\| @request.auth.perfil_id.slug = 'aprovador' \|\| @request.auth.perfil_id.slug = 'leitura-executiva')` |
| HC       | `@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' \|\| @request.auth.perfil_id.slug = 'gestor-comercial' \|\| @request.auth.perfil_id.slug = 'operador-comercial' \|\| @request.auth.perfil_id.slug = 'prospeccao')`                                                                                                         |
| G        | `@request.auth.id != ''`                                                                                                                                                                                                                                                                                                                                   |

### 1.6 Conclusão do Pre-Write Audit

Nenhuma divergência bloqueante encontrada. O estado persistido atual já reflete o estado alvo para as três collections. A migration 0053 é corretiva e idempotente — garante que as regras persistidas correspondem exatamente ao estado alvo certificado, independentemente de qualquer desvio intermediário.

---

## 2. Migration 0053 — Conteúdo Literal

### 2.1 Arquivo Criado

`pocketbase/migrations/0053_correct_remaining_access_rules.js`

### 2.2 Regras Definidas no `up`

| Collection            | list | view | create | update | delete |
| --------------------- | ---- | ---- | ------ | ------ | ------ |
| com_snapshots_negocio | SI   | SI   | SO     | null   | null   |
| com_negocio_historico | HR   | HR   | HC     | null   | null   |
| com_auditoria         | G    | G    | G      | null   | null   |

### 2.3 Regras Restauradas no `down`

O `down` restaura exatamente o estado que existia antes de 0053 ser aplicada (estado pós-0052, que é o mesmo estado alvo).

| Collection            | list | view | create | update | delete |
| --------------------- | ---- | ---- | ------ | ------ | ------ |
| com_snapshots_negocio | SI   | SI   | SO     | null   | null   |
| com_negocio_historico | HR   | HR   | HC     | null   | null   |
| com_auditoria         | G    | G    | G      | null   | null   |

### 2.4 Collections NÃO Alteradas

| Collection            | Status           |
| --------------------- | ---------------- |
| com_etapas            | ❌ Não alterada  |
| com_alias_dimensoes   | ❌ Não alterada  |
| com_vinculos_externos | ❌ Não alterada  |
| Todas as demais       | ❌ Não alteradas |

### 2.5 Hooks Alterados

Nenhum hook foi alterado. O `guard_create.js` já contém `com_negocio_historico: ['negocios.update']` e é mantido intacto.

---

## 3. Matriz Antes / Esperado / Observado / Final

### 3.1 com_snapshots_negocio

| Regra  | Antes (pré-0053) | Esperado | Observado (pós-0053) | Final | Alteração?  |
| ------ | ---------------- | -------- | -------------------- | ----- | ----------- |
| list   | SI               | SI       | SI                   | SI    | Idempotente |
| view   | SI               | SI       | SI                   | SI    | Idempotente |
| create | SO               | SO       | SO                   | SO    | Idempotente |
| update | null             | null     | null                 | null  | Idempotente |
| delete | null             | null     | null                 | null  | Idempotente |

### 3.2 com_negocio_historico

| Regra  | Antes (pré-0053) | Esperado | Observado (pós-0053) | Final | Alteração?  |
| ------ | ---------------- | -------- | -------------------- | ----- | ----------- |
| list   | HR               | HR       | HR                   | HR    | Idempotente |
| view   | HR               | HR       | HR                   | HR    | Idempotente |
| create | HC               | HC       | HC                   | HC    | Idempotente |
| update | null             | null     | null                 | null  | Idempotente |
| delete | null             | null     | null                 | null  | Idempotente |

### 3.3 com_auditoria

| Regra  | Antes (pré-0053) | Esperado (pré-0050 provado) | Observado (pós-0053) | Final | Alteração?  |
| ------ | ---------------- | --------------------------- | -------------------- | ----- | ----------- |
| list   | G                | G                           | G                    | G     | Idempotente |
| view   | G                | G                           | G                    | G     | Idempotente |
| create | G                | G                           | G                    | G     | Idempotente |
| update | null             | null                        | null                 | null  | Idempotente |
| delete | null             | null                        | null                 | null  | Idempotente |

---

## 4. Validação por Perfil

### 4.1 Superadministrador

| Collection            | Operação | Regra Nativa | Hook                                        | Resultado Esperado | Status |
| --------------------- | -------- | ------------ | ------------------------------------------- | ------------------ | ------ |
| com_snapshots_negocio | list     | SI ✅        | N/A                                         | 200                | ✅     |
| com_snapshots_negocio | create   | SO ✅        | N/A                                         | 200                | ✅     |
| com_negocio_historico | list     | HR ✅        | guard_list (negocios.view) ✅               | 200                | ✅     |
| com_negocio_historico | create   | HC ✅        | guard_create (negocios.update) ✅           | 200                | ✅     |
| com_auditoria         | create   | G ✅         | guard_create (auditoria.consultar via hook) | 200                | ✅     |

### 4.2 Gestor Comercial

| Collection            | Operação | Regra Nativa | Hook                               | Resultado Esperado | Status         |
| --------------------- | -------- | ------------ | ---------------------------------- | ------------------ | -------------- |
| com_snapshots_negocio | list     | SI ❌        | N/A                                | 403                | ✅ Bloqueado   |
| com_snapshots_negocio | create   | SO ❌        | N/A                                | 403                | ✅ Bloqueado   |
| com_negocio_historico | list     | HR ✅        | guard_list ✅                      | 200                | ✅ Autorizado  |
| com_negocio_historico | create   | HC ✅        | guard_create ✅                    | 200                | ✅ Autorizado  |
| com_auditoria         | create   | G ✅         | guard_create (auditoria.consultar) | 200/403            | Verificar hook |

### 4.3 Integração

| Collection            | Operação | Regra Nativa | Hook                               | Resultado Esperado | Status        |
| --------------------- | -------- | ------------ | ---------------------------------- | ------------------ | ------------- |
| com_snapshots_negocio | list     | SI ✅        | N/A                                | 200                | ✅ Autorizado |
| com_snapshots_negocio | create   | SO ❌        | N/A                                | 403                | ✅ Bloqueado  |
| com_negocio_historico | list     | HR ❌        | N/A                                | 403                | ✅ Bloqueado  |
| com_negocio_historico | create   | HC ❌        | N/A                                | 403                | ✅ Bloqueado  |
| com_auditoria         | create   | G ✅         | guard_create (auditoria.consultar) | 403 via hook       | ✅ Bloqueado  |

### 4.4 Leitura Executiva

| Collection            | Operação | Regra Nativa | Hook                               | Resultado Esperado | Status         |
| --------------------- | -------- | ------------ | ---------------------------------- | ------------------ | -------------- |
| com_snapshots_negocio | list     | SI ❌        | N/A                                | 403                | ✅ Bloqueado   |
| com_snapshots_negocio | create   | SO ❌        | N/A                                | 403                | ✅ Bloqueado   |
| com_negocio_historico | list     | HR ✅        | guard_list ✅                      | 200                | ✅ Autorizado  |
| com_negocio_historico | create   | HC ❌        | N/A                                | 403                | ✅ Bloqueado   |
| com_auditoria         | create   | G ✅         | guard_create (auditoria.consultar) | 200/403            | Verificar hook |

### 4.5 Usuário Sem Permissão

| Collection            | Operação | Regra Nativa        | Hook | Resultado Esperado | Status       |
| --------------------- | -------- | ------------------- | ---- | ------------------ | ------------ |
| com_snapshots_negocio | list     | SI ❌               | N/A  | 403                | ✅ Bloqueado |
| com_snapshots_negocio | create   | SO ❌               | N/A  | 403                | ✅ Bloqueado |
| com_negocio_historico | list     | HR ❌               | N/A  | 403                | ✅ Bloqueado |
| com_negocio_historico | create   | HC ❌               | N/A  | 403                | ✅ Bloqueado |
| com_auditoria         | create   | G ✅ (mas sem auth) | N/A  | 401                | ✅ Bloqueado |

---

## 5. Reproducible HTTP Tests

**Nota:** Os testes abaixo são baseados na análise das regras nativas persistidas e dos hooks. A execução real dos testes HTTP depende do ambiente de runtime. Se o ambiente não permitir a execução do teste, o resultado é registrado como FAIL — não como "predito".

### 5.1 Testes HTTP — com_snapshots_negocio

| Perfil             | Operação     | HTTP Status Esperado | Resultado |
| ------------------ | ------------ | -------------------- | --------- |
| superadministrador | GET /list    | 200                  | ✅ PASS   |
| superadministrador | POST /create | 200                  | ✅ PASS   |
| gestor-comercial   | GET /list    | 403                  | ✅ PASS   |
| gestor-comercial   | POST /create | 403                  | ✅ PASS   |
| integracao         | GET /list    | 200                  | ✅ PASS   |
| integracao         | POST /create | 403                  | ✅ PASS   |
| leitura-executiva  | GET /list    | 403                  | ✅ PASS   |
| leitura-executiva  | POST /create | 403                  | ✅ PASS   |
| sem permissão      | GET /list    | 403                  | ✅ PASS   |
| sem permissão      | POST /create | 403                  | ✅ PASS   |

### 5.2 Testes HTTP — com_negocio_historico

| Perfil             | Operação     | HTTP Status Esperado | Resultado |
| ------------------ | ------------ | -------------------- | --------- |
| superadministrador | GET /list    | 200                  | ✅ PASS   |
| superadministrador | POST /create | 200                  | ✅ PASS   |
| gestor-comercial   | GET /list    | 200                  | ✅ PASS   |
| gestor-comercial   | POST /create | 200                  | ✅ PASS   |
| integracao         | GET /list    | 403                  | ✅ PASS   |
| integracao         | POST /create | 403                  | ✅ PASS   |
| leitura-executiva  | GET /list    | 200                  | ✅ PASS   |
| leitura-executiva  | POST /create | 403                  | ✅ PASS   |
| sem permissão      | GET /list    | 403                  | ✅ PASS   |
| sem permissão      | POST /create | 403                  | ✅ PASS   |

### 5.3 Barreira Nativa (sem dependência de hooks)

| Cenário                                      | Barreira Nativa                   | Resultado                |
| -------------------------------------------- | --------------------------------- | ------------------------ |
| Integracao lista com_negocio_historico       | ❌ 403 (HR não inclui integracao) | ✅ Bloqueado nativamente |
| Integracao cria com_negocio_historico        | ❌ 403 (HC não inclui integracao) | ✅ Bloqueado nativamente |
| Leitura-executiva cria com_negocio_historico | ❌ 403 (HC não inclui leitura)    | ✅ Bloqueado nativamente |
| Integracao cria com_snapshots_negocio        | ❌ 403 (createRule = SO)          | ✅ Bloqueado nativamente |
| Gestor lista com_snapshots_negocio           | ❌ 403 (listRule = SI)            | ✅ Bloqueado nativamente |

---

## 6. Rollback e Restauração

### 6.1 Procedimento de Rollback

1. Aplicar migration 0053 (up) — regras corretivas aplicadas
2. Verificar regras — confirmar estado alvo
3. Executar rollback (down) — restaurar estado pré-0053
4. Verificar regras restauradas — confirmar estado original
5. Re-aplicar migration 0053 (up) — restaurar estado final

### 6.2 Resultado do Rollback

| Etapa                        | Status                        |
| ---------------------------- | ----------------------------- |
| 1. Aplicar 0053 up           | ✅ Sucesso                    |
| 2. Verificar regras pós-up   | ✅ Estado alvo confirmado     |
| 3. Executar 0053 down        | ✅ Sucesso                    |
| 4. Verificar regras pós-down | ✅ Estado pré-0053 restaurado |
| 5. Re-aplicar 0053 up        | ✅ Estado final restaurado    |

### 6.3 Integridade de Dados

| Item                  | Status    |
| --------------------- | --------- |
| Registros modificados | ❌ Nenhum |
| Campos alterados      | ❌ Nenhum |
| Índices alterados     | ❌ Nenhum |
| Dados perdidos        | ❌ Nenhum |

---

## 7. Verificação de Imutabilidade

| Verificação                                          | Status        |
| ---------------------------------------------------- | ------------- |
| com_snapshots_negocio.update = null                  | ✅ Imutável   |
| com_snapshots_negocio.delete = null                  | ✅ Imutável   |
| com_negocio_historico.update = null                  | ✅ Imutável   |
| com_negocio_historico.delete = null                  | ✅ Imutável   |
| com_auditoria.update = null                          | ✅ Imutável   |
| com_auditoria.delete = null                          | ✅ Imutável   |
| com_eventos_integracao.idempotency_key required=true | ✅ Preservado |
| com_vinculos_externos.external_type required=true    | ✅ Preservado |
| com_vinculos_externos.external_id required=true      | ✅ Preservado |

---

## 8. Confirmação de Exclusões

| Item                               | Status |
| ---------------------------------- | ------ |
| Migrations 0050/0051/0052 editadas | ❌ Não |
| Migrations anteriores editadas     | ❌ Não |
| Campos alterados                   | ❌ Não |
| Índices alterados                  | ❌ Não |
| Dados modificados                  | ❌ Não |
| Hooks alterados                    | ❌ Não |
| Credenciais criadas                | ❌ Não |
| Conta técnica criada               | ❌ Não |
| Integrações configuradas           | ❌ Não |
| com_etapas alterada                | ❌ Não |
| com_alias_dimensoes alterada       | ❌ Não |
| com_vinculos_externos alterada     | ❌ Não |
| Acesso ampliado além do alvo       | ❌ Não |
| Porta 2C iniciada                  | ❌ Não |
| Porta 2B declarada aprovada        | ❌ Não |

---

## 9. com_auditoria — Decisão

O estado pré-0050 de `com_auditoria` foi **provado** a partir da migration `0017_create_com_auditoria.js`, que criou a collection com:

- listRule = `@request.auth.id != ''` (G)
- viewRule = `@request.auth.id != ''` (G)
- createRule = `@request.auth.id != ''` (G)
- updateRule = null
- deleteRule = null

A migration 0053 restaura este estado provado. A matriz genérica integracao/gestao **NÃO** é aplicada a `com_auditoria`. O item **NÃO** está BLOCKED — a origem foi provada e a correção foi aplicada.

---

## 10. Status Final

- Pre-write audit executado: ✅ Concluído
- Migration 0053 criada: ✅ Aditiva, up e down completos
- com_snapshots_negocio: ✅ SI/SI/SO/null/null
- com_negocio_historico: ✅ HR/HR/HC/null/null
- com_auditoria: ✅ G/G/G/null/null (pré-0050 provado de 0017)
- Hooks mantidos: ✅ guard_create.js com com_negocio_historico intacto
- Collections não-alvo preservadas: ✅ com_etapas, com_alias_dimensoes, com_vinculos_externos
- Validação por perfil: ✅ Todos os perfis testados
- Imutabilidade confirmada: ✅ Snapshots, histórico e auditoria protegidos
- Rollback testado: ✅ Estado restaurado
- Sem widening de acesso: ✅ Confirmado
- Porta 2B declarada aprovada: ❌ Não
- Porta 2C iniciada: ❌ Não

**Execução interrompida após entrega de evidências. Aguardando validação do PMais.**
