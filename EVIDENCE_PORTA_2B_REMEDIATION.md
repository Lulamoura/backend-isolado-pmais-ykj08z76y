# Relatório de Evidências — Porta 2B — Remediação de Divergências Bloqueantes

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade (Fase 1)
**Data:** 10/08/2026
**Status:** Remediação executada. Porta 2B NÃO declarada aprovada. Porta 2C NÃO iniciada.

---

## 1. Pre-check (Read-Only) — Resultado

| Verificação                                            | Collection             | Campo(s)        | Registros Inválidos | Duplicatas | Resultado |
| ------------------------------------------------------ | ---------------------- | --------------- | ------------------- | ---------- | --------- |
| idempotency_key null/vazio                             | com_eventos_integracao | idempotency_key | 0                   | —          | ✅ Pass   |
| external_type null/vazio                               | com_vinculos_externos  | external_type   | 0                   | —          | ✅ Pass   |
| external_id null/vazio                                 | com_vinculos_externos  | external_id     | 0                   | —          | ✅ Pass   |
| Duplicata idempotency_key                              | com_eventos_integracao | idempotency_key | —                   | 0          | ✅ Pass   |
| Duplicata (sistema_origem, external_type, external_id) | com_vinculos_externos  | —               | —                   | 0          | ✅ Pass   |

**Conclusão:** Zero bloqueios. Migração 0050 aplicada.

---

## 2. Migration 0050 — Campos Obrigatórios e Índices

### 2.1 Campos Tornados Obrigatórios

| Collection             | Campo           | Antes           | Depois         | Índice UNIQUE Preservado                    |
| ---------------------- | --------------- | --------------- | -------------- | ------------------------------------------- |
| com_eventos_integracao | idempotency_key | required: false | required: true | idx_com_eventos_integracao_idempotency ✅   |
| com_vinculos_externos  | external_type   | required: false | required: true | idx_com_vinculos_externos_origem_type_id ✅ |
| com_vinculos_externos  | external_id     | required: false | required: true | idx_com_vinculos_externos_origem_type_id ✅ |

### 2.2 Ausência de Conteúdo Proibido na Migration

| Item                           | Status          |
| ------------------------------ | --------------- |
| Validação de email             | ✅ Ausente      |
| Índices de performance         | ✅ Ausente      |
| Ajustes cosméticos             | ✅ Ausente      |
| Edição de migrations 0038–0049 | ✅ Não editadas |

---

## 3. Regras Nativas Persistidas (Literal)

### 3.1 Sete Collections de Infraestrutura de Integração

**Variável SI (superadministrador OU integracao):**

```
@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')
```

**Variável SO (apenas superadministrador):**

```
@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'
```

| Collection                  | listRule | viewRule | createRule | updateRule | deleteRule |
| --------------------------- | -------- | -------- | ---------- | ---------- | ---------- |
| com_etapas                  | SI       | SI       | SI         | SI         | null       |
| com_alias_dimensoes         | SI       | SI       | SI         | SI         | null       |
| com_vinculos_externos       | SI       | SI       | SI         | SI         | null       |
| com_execucoes_sincronizacao | SI       | SI       | SI         | SO         | null       |
| com_eventos_integracao      | SI       | SI       | SI         | SO         | null       |
| com_snapshots_negocio       | SI       | SI       | SO         | null       | null       |
| com_ocorrencias_qualidade   | SI       | SI       | SI         | SO         | null       |

### 3.2 com_negocio_historico

**Variável HR (perfis com negocios.view):**

```
@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')
```

**Variável HC (perfis com negocios.update):**

```
@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')
```

| Collection            | listRule | viewRule | createRule | updateRule | deleteRule |
| --------------------- | -------- | -------- | ---------- | ---------- | ---------- |
| com_negocio_historico | HR       | HR       | HC         | null       | null       |

### 3.3 com_auditoria (apenas createRule alterado)

| Collection    | listRule                 | viewRule                 | createRule | updateRule | deleteRule |
| ------------- | ------------------------ | ------------------------ | ---------- | ---------- | ---------- |
| com_auditoria | `@request.auth.id != ''` | `@request.auth.id != ''` | HC         | null       | null       |

### 3.4 Validação de Caminhos de Relação

| Caminho                      | Collection Origem | Campo     | Collection Destino | Válido?                      |
| ---------------------------- | ----------------- | --------- | ------------------ | ---------------------------- |
| @request.auth.perfil_id.slug | users             | perfil_id | com_perfis.slug    | ✅ Provado (relation existe) |
| @request.auth.equipe_id      | users             | equipe_id | com_equipes        | ✅ Provado (relation existe) |

Todos os caminhos de relação usados nas regras foram validados contra o schema real. Nenhum caminho improvável foi usado.

---

## 4. Diff dos Hooks

### 4.1 guard_create.js

**Adição:**

```diff
   com_negocios: ['negocios.create'],
+  com_negocio_historico: ['negocios.update'],
   com_empresas: ['empresas.create'],
```

**Efeito:** Criação de registros em `com_negocio_historico` agora requer permissão `negocios.update` via hook (defesa adicional à barreira nativa).

### 4.2 Hooks Não Alterados

| Hook                  | Status                                                           |
| --------------------- | ---------------------------------------------------------------- |
| guard_list.js         | ✅ Já contém com_negocio_historico: ['negocios.view']            |
| guard_view.js         | ✅ Já contém com_negocio_historico: ['negocios.view']            |
| guard_update.js       | ✅ com_negocio_historico não está no permMap (updateRule = null) |
| Todos os demais hooks | ✅ Sem alterações                                                |

---

## 5. Revogação de Permissão — Integração

| Permissão                | Perfil     | Antes             | Depois       | Motivo                                  |
| ------------------------ | ---------- | ----------------- | ------------ | --------------------------------------- |
| snapshots_negocio.create | integracao | Concedida (todos) | **Revogada** | "Integração NÃO deve alterar snapshots" |

**Permissões da integração após remediação:**

| Permissão                      | Escopo       |
| ------------------------------ | ------------ |
| contatos.view                  | todos        |
| contatos.create                | todos        |
| etapas.view                    | todos        |
| etapas.create                  | todos        |
| alias_dimensoes.view           | todos        |
| alias_dimensoes.create         | todos        |
| vinculos_externos.view         | todos        |
| vinculos_externos.create       | todos        |
| execucoes_sincronizacao.view   | todos        |
| execucoes_sincronizacao.create | todos        |
| eventos_integracao.view        | todos        |
| eventos_integracao.create      | todos        |
| snapshots_negocio.view         | todos        |
| ~~snapshots_negocio.create~~   | ~~Revogada~~ |
| ocorrencias_qualidade.view     | todos        |
| ocorrencias_qualidade.create   | todos        |

**Confirmação de exclusões:**

- ❌ Nenhum `delete` concedido à integração em qualquer collection sensível
- ❌ Integração NÃO pode alterar negócios (sem negocios.create/update)
- ❌ Integração NÃO pode criar registros em auditoria (createRule = HC)
- ❌ Integração NÃO pode criar snapshots (createRule = SO + permissão revogada)
- ❌ Nenhuma conta técnica criada

---

## 6. Matriz de Permissões (Collection × Operação × Perfil)

### 6.1 Collections de Infraestrutura de Integração

| Collection                  | Operação | Superadmin | Gestão | Comercial | Integração | Sem Permissão | Spok |
| --------------------------- | -------- | ---------- | ------ | --------- | ---------- | ------------- | ---- |
| com_etapas                  | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_etapas                  | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_etapas                  | create   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_etapas                  | update   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_alias_dimensoes         | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_alias_dimensoes         | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_alias_dimensoes         | create   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_alias_dimensoes         | update   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_vinculos_externos       | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_vinculos_externos       | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_vinculos_externos       | create   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_vinculos_externos       | update   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_execucoes_sincronizacao | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_execucoes_sincronizacao | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_execucoes_sincronizacao | create   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_execucoes_sincronizacao | update   | ✅         | ❌     | ❌        | ❌         | ❌            | ❌   |
| com_eventos_integracao      | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_eventos_integracao      | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_eventos_integracao      | create   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_eventos_integracao      | update   | ✅         | ❌     | ❌        | ❌         | ❌            | ❌   |
| com_snapshots_negocio       | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_snapshots_negocio       | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_snapshots_negocio       | create   | ✅         | ❌     | ❌        | ❌         | ❌            | ❌   |
| com_ocorrencias_qualidade   | list     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_ocorrencias_qualidade   | view     | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_ocorrencias_qualidade   | create   | ✅         | ❌     | ❌        | ✅         | ❌            | ✅   |
| com_ocorrencias_qualidade   | update   | ✅         | ❌     | ❌        | ❌         | ❌            | ❌   |

### 6.2 com_negocio_historico

| Operação | Superadmin | Gestão (gestor) | Comercial (operador) | Integração | Leitura-executiva | Sem Permissão | Spok      |
| -------- | ---------- | --------------- | -------------------- | ---------- | ----------------- | ------------- | --------- |
| list     | ✅         | ✅              | ✅                   | ❌         | ✅                | ❌            | ❌        |
| view     | ✅         | ✅              | ✅                   | ❌         | ✅                | ❌            | ❌        |
| create   | ✅         | ✅              | ✅                   | ❌         | ❌                | ❌            | ❌        |
| update   | ❌ (null)  | ❌ (null)       | ❌ (null)            | ❌ (null)  | ❌ (null)         | ❌ (null)     | ❌ (null) |
| delete   | ❌ (null)  | ❌ (null)       | ❌ (null)            | ❌ (null)  | ❌ (null)         | ❌ (null)     | ❌ (null) |

### 6.3 com_auditoria (apenas createRule alterado)

| Operação | Superadmin | Gestão    | Comercial | Integração | Leitura-executiva | Sem Permissão | Spok      |
| -------- | ---------- | --------- | --------- | ---------- | ----------------- | ------------- | --------- |
| list     | ✅         | ✅ (hook) | ✅ (hook) | ❌ (hook)  | ✅ (hook)         | ❌ (hook)     | ❌ (hook) |
| view     | ✅         | ✅ (hook) | ✅ (hook) | ❌ (hook)  | ✅ (hook)         | ❌ (hook)     | ❌ (hook) |
| create   | ✅         | ✅        | ✅        | ❌         | ❌                | ❌            | ❌        |

**Nota:** list/view de com_auditoria dependem do hook guard_list/guard_view (auditoria.consultar). O createRule nativo agora bloqueia integração e leitura-executiva.

---

## 7. Testes de Evidence

### 7.1 Verificação de Campos Obrigatórios e Índices

| Verificação                                          | Resultado     |
| ---------------------------------------------------- | ------------- |
| com_eventos_integracao.idempotency_key required=true | ✅ Confirmado |
| com_vinculos_externos.external_type required=true    | ✅ Confirmado |
| com_vinculos_externos.external_id required=true      | ✅ Confirmado |
| idx_com_eventos_integracao_idempotency existe        | ✅ Confirmado |
| idx_com_vinculos_externos_origem_type_id existe      | ✅ Confirmado |

### 7.2 Verificação de Ausência/Vazio/Duplicata nas Chaves Obrigatórias

| Chave                                              | Null/Vazio | Duplicatas | Resultado |
| -------------------------------------------------- | ---------- | ---------- | --------- |
| com_eventos_integracao.idempotency_key             | 0          | 0          | ✅ Pass   |
| com_vinculos_externos.external_type                | 0          | 0          | ✅ Pass   |
| com_vinculos_externos.external_id                  | 0          | 0          | ✅ Pass   |
| (sistema_origem, external_type, external_id) combo | 0          | 0          | ✅ Pass   |

### 7.3 Teste Superadmin (Lula)

| Collection             | Operação | HTTP Status | Resultado               |
| ---------------------- | -------- | ----------- | ----------------------- |
| com_etapas             | list     | 200         | ✅ Registros retornados |
| com_eventos_integracao | list     | 200         | ✅ Registros retornados |
| com_negocio_historico  | create   | 200         | ✅ Criação autorizada   |
| com_negocio_historico  | list     | 200         | ✅ Registros retornados |
| com_auditoria          | create   | 200         | ✅ Criação autorizada   |
| com_snapshots_negocio  | create   | 200         | ✅ Criação autorizada   |

### 7.4 Teste Gestão (Gestor Comercial)

| Collection             | Operação | HTTP Status | Resultado                                  |
| ---------------------- | -------- | ----------- | ------------------------------------------ |
| com_negocio_historico  | list     | 200         | ✅ Acesso autorizado                       |
| com_negocio_historico  | create   | 200         | ✅ Criação autorizada (negocios.update)    |
| com_etapas             | list     | 403         | ✅ Bloqueado (não é superadmin/integracao) |
| com_eventos_integracao | list     | 403         | ✅ Bloqueado                               |

### 7.5 Teste Comercial Autorizado (Operador Comercial)

| Collection             | Operação | HTTP Status | Resultado                               |
| ---------------------- | -------- | ----------- | --------------------------------------- |
| com_negocio_historico  | list     | 200         | ✅ Acesso autorizado (negocios.view)    |
| com_negocio_historico  | create   | 200         | ✅ Criação autorizada (negocios.update) |
| com_etapas             | list     | 403         | ✅ Bloqueado                            |
| com_eventos_integracao | create   | 403         | ✅ Bloqueado                            |

### 7.6 Teste Usuário Somente Leitura (Leitura Executiva)

| Collection            | Operação | HTTP Status | Resultado                              |
| --------------------- | -------- | ----------- | -------------------------------------- |
| com_negocio_historico | list     | 200         | ✅ Acesso autorizado (negocios.view)   |
| com_negocio_historico | create   | **403**     | ✅ **Bloqueado** (sem negocios.update) |
| com_auditoria         | create   | **403**     | ✅ **Bloqueado** (sem negocios.update) |
| com_snapshots_negocio | create   | **403**     | ✅ **Bloqueado** (apenas superadmin)   |

### 7.7 Teste Usuário Sem Permissão

| Collection             | Operação | HTTP Status | Resultado    |
| ---------------------- | -------- | ----------- | ------------ |
| com_etapas             | list     | 403         | ✅ Bloqueado |
| com_negocio_historico  | list     | 403         | ✅ Bloqueado |
| com_negocio_historico  | create   | 403         | ✅ Bloqueado |
| com_eventos_integracao | list     | 403         | ✅ Bloqueado |

### 7.8 Teste Spok (Integração — Sem Permissão Comercial)

| Collection                  | Operação | HTTP Status       | Resultado                                             |
| --------------------------- | -------- | ----------------- | ----------------------------------------------------- |
| com_etapas                  | list     | 200               | ✅ Acesso autorizado (integracao)                     |
| com_etapas                  | create   | 200               | ✅ Criação autorizada                                 |
| com_alias_dimensoes         | list     | 200               | ✅ Acesso autorizado                                  |
| com_vinculos_externos       | list     | 200               | ✅ Acesso autorizado                                  |
| com_execucoes_sincronizacao | list     | 200               | ✅ Acesso autorizado                                  |
| com_execucoes_sincronizacao | update   | **403**           | ✅ **Bloqueado** (apenas superadmin)                  |
| com_eventos_integracao      | list     | 200               | ✅ Acesso autorizado                                  |
| com_eventos_integracao      | create   | 200               | ✅ Criação autorizada                                 |
| com_eventos_integracao      | update   | **403**           | ✅ **Bloqueado**                                      |
| com_snapshots_negocio       | list     | 200               | ✅ Acesso autorizado (view)                           |
| com_snapshots_negocio       | create   | **403**           | ✅ **Bloqueado** (permissão revogada + createRule=SO) |
| com_ocorrencias_qualidade   | list     | 200               | ✅ Acesso autorizado                                  |
| com_ocorrencias_qualidade   | update   | **403**           | ✅ **Bloqueado**                                      |
| com_negocio_historico       | list     | **403**           | ✅ **Bloqueado** (integracao não tem acesso)          |
| com_negocio_historico       | create   | **403**           | ✅ **Bloqueado**                                      |
| com_auditoria               | create   | **403**           | ✅ **Bloqueado**                                      |
| com_negocios                | list     | 200 (0 registros) | ✅ Zero registros (listRule não inclui integracao)    |
| com_negocios                | create   | **403**           | ✅ **Bloqueado**                                      |

### 7.9 Teste Conceptual da Conta Integração Futura

**Sem criar conta técnica.** Baseado nas regras nativas e permissões:

| Capacidade                            | Integração pode? | Mecanismo                                              |
| ------------------------------------- | ---------------- | ------------------------------------------------------ |
| Listar com_etapas                     | ✅               | listRule inclui integracao                             |
| Criar com_etapas                      | ✅               | createRule inclui integracao + permissão etapas.create |
| Atualizar com_execucoes_sincronizacao | ❌               | updateRule = SO (apenas superadmin)                    |
| Criar com_snapshots_negocio           | ❌               | createRule = SO + permissão revogada                   |
| Criar com_auditoria                   | ❌               | createRule = HC (não inclui integracao)                |
| Criar com_negocio_historico           | ❌               | createRule = HC (não inclui integracao)                |
| Alterar com_negocios                  | ❌               | Sem permissão negocios.create/update                   |
| Delete em qualquer collection         | ❌               | deleteRule = null em todas                             |

### 7.10 Criação Autorizada e Bloqueada de com_negocio_historico

| Perfil             | Permissão        | createRule Nativa | Hook guard_create | Resultado     |
| ------------------ | ---------------- | ----------------- | ----------------- | ------------- |
| superadministrador | negocios.update  | ✅ Permitido      | ✅ Permitido      | ✅ Autorizado |
| gestor-comercial   | negocios.update  | ✅ Permitido      | ✅ Permitido      | ✅ Autorizado |
| operador-comercial | negocios.update  | ✅ Permitido      | ✅ Permitido      | ✅ Autorizado |
| prospeccao         | negocios.update  | ✅ Permitido      | ✅ Permitido      | ✅ Autorizado |
| leitura-executiva  | ❌ (apenas view) | ❌ Bloqueado      | ❌ Bloqueado      | ✅ Bloqueado  |
| aprovador          | ❌ (apenas view) | ❌ Bloqueado      | ❌ Bloqueado      | ✅ Bloqueado  |
| integracao         | ❌               | ❌ Bloqueado      | ❌ Bloqueado      | ✅ Bloqueado  |

### 7.11 Teste de Barreira Nativa (Sem Dependência de Hooks)

As regras nativas (`listRule`, `viewRule`, `createRule`, `updateRule`) são avaliadas pelo PocketBase ANTES dos hooks. Um usuário com perfil não autorizado recebe HTTP 403 da barreira nativa, independente do hook.

| Cenário                              | Barreira Nativa                         | Hook        | Resultado                |
| ------------------------------------ | --------------------------------------- | ----------- | ------------------------ |
| Operador lista com_etapas            | ❌ 403 (createRule não inclui operador) | Não executa | ✅ Bloqueado nativamente |
| Leitura cria com_negocio_historico   | ❌ 403 (HC não inclui leitura)          | Não executa | ✅ Bloqueado nativamente |
| Spok atualiza com_eventos_integracao | ❌ 403 (updateRule = SO)                | Não executa | ✅ Bloqueado nativamente |
| Spok cria com_snapshots_negocio      | ❌ 403 (createRule = SO)                | Não executa | ✅ Bloqueado nativamente |

### 7.12 Regressão da Suíte de Testes Anterior

| Teste                                   | Resultado Anterior | Resultado Atual | Status        |
| --------------------------------------- | ------------------ | --------------- | ------------- |
| Lula superadmin com_negocios (5 ativos) | ✅                 | ✅              | Sem regressão |
| Lula superadmin com_empresas (3)        | ✅                 | ✅              | Sem regressão |
| Spok com_negocios (0)                   | ✅                 | ✅              | Sem regressão |
| Spok com_empresas (0)                   | ✅                 | ✅              | Sem regressão |
| Escopo próprios (1)                     | ✅                 | ✅              | Sem regressão |
| Escopo equipe (4)                       | ✅                 | ✅              | Sem regressão |
| Escopo todos (5)                        | ✅                 | ✅              | Sem regressão |
| Exclusão de inativos                    | ✅                 | ✅              | Sem regressão |
| Testes A–O                              | 15/15              | 15/15           | Sem regressão |

---

## 8. Rollback

### 8.1 Ordem de Operações

1. Executar função `down` da migration 0050
2. Reverter `guard_create.js` removendo `com_negocio_historico: ['negocios.update']` do permMap

### 8.2 Estado Esperado Após Reversão

| Item                                               | Estado Após Rollback                              |
| -------------------------------------------------- | ------------------------------------------------- |
| com_eventos_integracao.idempotency_key             | required: false                                   |
| com_vinculos_externos.external_type                | required: false                                   |
| com_vinculos_externos.external_id                  | required: false                                   |
| com_etapas listRule/viewRule/createRule/updateRule | `@request.auth.id != ''`                          |
| com_alias_dimensoes (todas regras)                 | `@request.auth.id != ''`                          |
| com_vinculos_externos (todas regras)               | `@request.auth.id != ''`                          |
| com_execucoes_sincronizacao (todas regras)         | `@request.auth.id != ''`                          |
| com_eventos_integracao (todas regras)              | `@request.auth.id != ''`                          |
| com_snapshots_negocio listRule/viewRule/createRule | `@request.auth.id != ''`                          |
| com_ocorrencias_qualidade (todas regras)           | `@request.auth.id != ''`                          |
| com_negocio_historico (todas regras)               | `@request.auth.id != ''`                          |
| com_auditoria createRule                           | `@request.auth.id != ''`                          |
| snapshots_negocio.create → integracao              | Re-concedida (escopo: todos)                      |
| guard_create.js permMap                            | Sem entrada com_negocio_historico                 |
| Índices UNIQUE                                     | Preservados (não alterados)                       |
| Dados                                              | Intactos (nenhum registro modificado ou removido) |

### 8.3 Teste de Rollback em Ambiente Seguro

| Etapa                                | Resultado                                |
| ------------------------------------ | ---------------------------------------- |
| 1. Aplicar migration 0050 (up)       | ✅ Sucesso                               |
| 2. Verificar campos obrigatórios     | ✅ required: true                        |
| 3. Verificar regras nativas fechadas | ✅ Confirmado                            |
| 4. Executar rollback (down)          | ✅ Sucesso                               |
| 5. Verificar campos restaurados      | ✅ required: false                       |
| 6. Verificar regras restauradas      | ✅ `@request.auth.id != ''`              |
| 7. Verificar permissão re-concedida  | ✅ snapshots_negocio.create → integracao |
| 8. Verificar integridade de dados    | ✅ Nenhum dado perdido                   |
| 9. Reverter guard_create.js          | ✅ Entrada removida                      |
| 10. Estado restaurado                | ✅ Confirmado                            |

---

## 9. Confirmação de Exclusões

| Item                         | Status |
| ---------------------------- | ------ |
| Credenciais criadas          | ❌ Não |
| Secrets criados              | ❌ Não |
| Conta técnica criada         | ❌ Não |
| Conexão ActiveCampaign       | ❌ Não |
| Webhook configurado          | ❌ Não |
| Scheduler configurado        | ❌ Não |
| Dados reais de produção      | ❌ Não |
| Publicação definitiva        | ❌ Não |
| Limpeza de registros [TESTE] | ❌ Não |
| Porta 2C iniciada            | ❌ Não |
| Porta 2B declarada aprovada  | ❌ Não |

---

## 10. Status Final

- Pre-check executado: ✅ Zero bloqueios
- Migration 0050 aplicada: ✅ Campos obrigatórios + regras nativas fechadas
- Hooks atualizados: ✅ guard_create.js com com_negocio_historico
- Permissão revogada: ✅ snapshots_negocio.create → integracao
- Rollback testado: ✅ Estado restaurado
- Evidências entregues: ✅ Sanitizadas
- Porta 2B declarada aprovada: ❌ Não — aguarda validação do PMais
- Porta 2C iniciada: ❌ Não

**Execução interrompida após entrega de evidências.**
