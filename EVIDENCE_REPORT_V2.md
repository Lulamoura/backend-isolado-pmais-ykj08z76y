# Relatório de Evidências V2 — Porta 3A — Correção Estrutural Definitiva

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade (Fase 1)
**Data:** 10/08/2026
**Status:** PORTA 3A — Correção estrutural e autorização server-side implementadas.

---

## 1. Migration Aplicada

| #    | Arquivo                           | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0030 | `0030_fix_canonical_structure.js` | Garante 7 perfis canônicos ativos, inativa perfis antigos, cria 19 permissões granulares, remove permissões de delete, migra negócios para etapa/resultado, remove `aberto`/`em_andamento` do select `status`, cria `comercial.etapa_padrao`, inativa `comercial.status_padrao`, garante `tipo` em todos os parâmetros, remove `negocios.view` do perfil `integracao`, adiciona campos de vigência em `com_usuarios_equipes`, atualiza índice único, define `deleteRule=null` em todas as collections protegidas |

---

## 2. Regras de Acesso Efetivas (Effective Access Rules)

A autorização é executada **server-side** via hooks `onRecordListRequest`, `onRecordViewRequest`, `onRecordCreateRequest`, `onRecordUpdateRequest` em conjunto com as regras de collection do PocketBase.

### 2.1 Collections de Administração

| Collection              | List                                       | View                                       | Create                 | Update                 | Delete                  |
| ----------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------- | ---------------------- | ----------------------- |
| `com_perfis`            | `perfis.admin`                             | `perfis.admin`                             | `perfis.admin`         | `perfis.admin`         | `null` (bloqueado)      |
| `com_permissoes`        | `permissoes.admin`                         | `permissoes.admin`                         | `permissoes.admin`     | `permissoes.admin`     | `null` (bloqueado)      |
| `com_perfil_permissoes` | `permissoes.admin`                         | `permissoes.admin`                         | `permissoes.admin`     | `permissoes.admin`     | `null` (bloqueado)      |
| `com_usuarios_equipes`  | `vinculos.admin`                           | `vinculos.admin`                           | `vinculos.admin`       | `vinculos.admin`       | `null` (bloqueado)      |
| `com_parametros`        | `parametros.gerenciar` ou `dashboard.view` | `parametros.gerenciar` ou `dashboard.view` | `parametros.gerenciar` | `parametros.gerenciar` | `null` (bloqueado)      |
| `com_equipes`           | `@request.auth.id != ''`                   | `@request.auth.id != ''`                   | `equipes.admin`        | `equipes.admin`        | `null` (bloqueado)      |
| `users`                 | `@request.auth.id != ''`                   | `@request.auth.id != ''`                   | `usuarios.admin`       | `usuarios.admin`       | `id = @request.auth.id` |

### 2.2 Collections de Negócio

| Collection              | List                                        | View                     | Create                   | Update                     | Delete             |
| ----------------------- | ------------------------------------------- | ------------------------ | ------------------------ | -------------------------- | ------------------ |
| `com_negocios`          | `negocios.view` + filtro responsavel/equipe | `negocios.view` + filtro | `negocios.create`        | `negocios.update` + filtro | `null` (bloqueado) |
| `com_empresas`          | `empresas.view` + filtro responsavel/equipe | `empresas.view` + filtro | `empresas.create`        | `empresas.update` + filtro | `null` (bloqueado) |
| `com_negocio_historico` | `negocios.view`                             | `negocios.view`          | `@request.auth.id != ''` | `null`                     | `null`             |

### 2.3 Collections de Auditoria

| Collection               | List                                            | View                                            | Create                   | Update | Delete |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------- | ------------------------ | ------ | ------ |
| `com_auditoria`          | `auditoria.consultar`                           | `auditoria.consultar`                           | `@request.auth.id != ''` | `null` | `null` |
| `com_parametros_versoes` | `auditoria.consultar` ou `parametros.gerenciar` | `auditoria.consultar` ou `parametros.gerenciar` | `parametros.gerenciar`   | `null` | `null` |

### 2.4 Mecanismo de Verificação

Cada hook (`guard_list.js`, `guard_view.js`, `guard_create.js`, `guard_update.js`):

1. Identifica a collection via `e.collection.name`
2. Se a collection não está no mapa de proteção → `e.next()` (regras normais aplicam)
3. Se superuser → `e.next()` (bypass)
4. Consulta `com_usuarios_equipes` para vínculos ativos (`ativo=true`) do usuário
5. Filtra por vigência (`inicio_vigencia ≤ hoje ≤ fim_vigencia`)
6. Para cada vínculo ativo, consulta `com_perfil_permissoes` → `com_permissoes`
7. Constrói set de permissões (slugs)
8. Verifica se pelo menos uma permissão requerida está presente
9. Se não → `throw new ForbiddenError()` (HTTP 403)

---

## 3. Perfis Canônicos e Matriz de Permissões

### 3.1 Perfis Ativos (7)

| Slug                 | Nome               | Escopo Padrão |
| -------------------- | ------------------ | ------------- |
| `superadministrador` | Superadministrador | todos         |
| `gestor-comercial`   | Gestor Comercial   | equipe        |
| `operador-comercial` | Operador Comercial | proprios      |
| `prospeccao`         | Prospecção         | proprios      |
| `aprovador`          | Aprovador          | todos         |
| `leitura-executiva`  | Leitura Executiva  | todos         |
| `integracao`         | Integração         | todos         |

### 3.2 Perfis Inativados (3)

| Slug        | Nome          | Status                     |
| ----------- | ------------- | -------------------------- |
| `admin`     | Administrador | `ativo=false` (preservado) |
| `gerente`   | Gerente       | `ativo=false` (preservado) |
| `consultor` | Consultor     | `ativo=false` (preservado) |

### 3.3 Permissões Granulares (19)

| Slug                                | Recurso    | Ação                 |
| ----------------------------------- | ---------- | -------------------- |
| `empresas.view`                     | empresas   | view                 |
| `empresas.create`                   | empresas   | create               |
| `empresas.update`                   | empresas   | update               |
| `empresas.inactivate`               | empresas   | inactivate           |
| `negocios.view`                     | negocios   | view                 |
| `negocios.create`                   | negocios   | create               |
| `negocios.update`                   | negocios   | update               |
| `negocios.inactivate`               | negocios   | inactivate           |
| `usuarios.admin`                    | usuarios   | admin                |
| `equipes.admin`                     | equipes    | admin                |
| `perfis.admin`                      | perfis     | admin                |
| `permissoes.admin`                  | permissoes | admin                |
| `vinculos.admin`                    | vinculos   | admin                |
| `parametros.gerenciar`              | parametros | gerenciar            |
| `gerenciar_parametros_notificacoes` | parametros | manage_notifications |
| `dashboard.view`                    | dashboard  | view                 |
| `excecoes.aprovar`                  | excecoes   | aprovar              |
| `auditoria.consultar`               | auditoria  | consultar            |
| `foundation.manage`                 | foundation | manage               |

**Permissões removidas:** `empresas.delete`, `negocios.delete`

### 3.4 Matriz Perfil × Permissão (resumo)

| Permissão                         | Superadmin | Gestor    | Operador    | Prospecção  | Aprovador | Leitura  | Integração |
| --------------------------------- | ---------- | --------- | ----------- | ----------- | --------- | -------- | ---------- |
| empresas.view                     | ✅ todos   | ✅ equipe | ✅ proprios | ✅ proprios | ✅ todos  | ✅ todos | ✅ todos   |
| empresas.create                   | ✅         | ✅        | ✅          | ✅          | ❌        | ❌       | ❌         |
| empresas.update                   | ✅         | ✅        | ✅          | ❌          | ❌        | ❌       | ❌         |
| empresas.inactivate               | ✅         | ✅        | ❌          | ❌          | ❌        | ❌       | ❌         |
| negocios.view                     | ✅         | ✅        | ✅          | ✅          | ✅        | ✅       | ❌         |
| negocios.create                   | ✅         | ✅        | ✅          | ✅          | ❌        | ❌       | ❌         |
| negocios.update                   | ✅         | ✅        | ✅          | ❌          | ❌        | ❌       | ❌         |
| negocios.inactivate               | ✅         | ✅        | ❌          | ❌          | ❌        | ❌       | ❌         |
| usuarios.admin                    | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| equipes.admin                     | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| perfis.admin                      | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| permissoes.admin                  | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| vinculos.admin                    | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| parametros.gerenciar              | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| gerenciar_parametros_notificacoes | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |
| dashboard.view                    | ✅         | ✅        | ✅          | ✅          | ✅        | ✅       | ❌         |
| excecoes.aprovar                  | ✅         | ❌        | ❌          | ❌          | ✅        | ❌       | ❌         |
| auditoria.consultar               | ✅         | ✅        | ❌          | ❌          | ✅        | ✅       | ❌         |
| foundation.manage                 | ✅         | ❌        | ❌          | ❌          | ❌        | ❌       | ❌         |

---

## 4. Export Anonimizado (estrutura final)

### 4.1 com_perfis

```
| id | nome | slug | ativo |
|----|------|------|-------|
| RECORD_001 | Superadministrador | superadministrador | true |
| RECORD_002 | Gestor Comercial | gestor-comercial | true |
| RECORD_003 | Operador Comercial | operador-comercial | true |
| RECORD_004 | Prospecção | prospeccao | true |
| RECORD_005 | Aprovador | aprovador | true |
| RECORD_006 | Leitura Executiva | leitura-executiva | true |
| RECORD_007 | Integração | integracao | true |
| RECORD_008 | Administrador | admin | false |
| RECORD_009 | Gerente | gerente | false |
| RECORD_010 | Consultor | consultor | false |
```

### 4.2 com_usuarios_equipes (anonimizado)

```
| id | usuario_id | equipe_id | perfil_id | escopo | ativo | inicio_vigencia |
|----|-----------|-----------|-----------|--------|-------|-----------------|
| BIND_001 | USER_ANON_001 | EQUIPE_ANON_001 | RECORD_001 (superadmin) | todos | true | 2026-08-09 |
| BIND_002 | USER_ANON_002 | EQUIPE_ANON_001 | RECORD_007 (integracao) | todos | true | 2026-08-09 |
```

### 4.3 com_permissoes

```
| slug | recurso | acao |
|------|---------|------|
| empresas.view | empresas | view |
| empresas.create | empresas | create |
| empresas.update | empresas | update |
| empresas.inactivate | empresas | inactivate |
| negocios.view | negocios | view |
| negocios.create | negocios | create |
| negocios.update | negocios | update |
| negocios.inactivate | negocios | inactivate |
| usuarios.admin | usuarios | admin |
| equipes.admin | equipes | admin |
| perfis.admin | perfis | admin |
| permissoes.admin | permissoes | admin |
| vinculos.admin | vinculos | admin |
| parametros.gerenciar | parametros | gerenciar |
| gerenciar_parametros_notificacoes | parametros | manage_notifications |
| dashboard.view | dashboard | view |
| excecoes.aprovar | excecoes | aprovar |
| auditoria.consultar | auditoria | consultar |
| foundation.manage | foundation | manage |
```

**Nota:** `empresas.delete` e `negocios.delete` NÃO existem na base.

### 4.4 com_negocios (estrutura)

```
| campo | tipo | valores válidos |
|-------|------|-----------------|
| titulo | text | — |
| empresa_id | relation | — |
| equipe_id | relation | — |
| responsavel_id | relation | — |
| valor | number | — |
| etapa | select | prospects, producao_proposta, negociacao |
| resultado | select | ganho, perdido, desqualificado |
| status | select (deprecated) | ganho, perdido (apenas) |
| inativo | bool | — |
| descricao | text | — |
```

**Nota:** `aberto` e `em_andamento` foram removidos do select `status`. Todos os registros existentes têm `status=''` (vazio). Valores migrados para `etapa` e `resultado`.

### 4.5 com_parametros

```
| chave | valor | tipo | ativo | versao |
|-------|-------|------|-------|--------|
| sistema.nome | PMais CRM | texto | true | 1 |
| sistema.versao | 1.0.0 | texto | true | 1 |
| comercial.status_padrao | aberto | texto | false | 2 |
| comercial.etapa_padrao | prospects | texto | true | 1 |
| comercial.moeda | BRL | texto | true | 1 |
| comercial.escopo_padrao | proprios | texto | true | 1 |
```

**Nota:** Todos os parâmetros têm `tipo='texto'`. `comercial.status_padrao` está inativo (`ativo=false`). `comercial.etapa_padrao` está ativo.

---

## 5. Testes Negativos por Perfil (Negative API Tests)

### 5.1 Cenário: Spok (perfil `integracao`)

Permissões de Spok: apenas `empresas.view` (escopo: todos).

| Collection             | Operação  | Permissão Requerida                        | Spok tem? | Resultado Esperado |
| ---------------------- | --------- | ------------------------------------------ | --------- | ------------------ |
| `com_perfis`           | GET /list | `perfis.admin`                             | ❌        | **403 Forbidden**  |
| `com_usuarios_equipes` | GET /list | `vinculos.admin`                           | ❌        | **403 Forbidden**  |
| `com_permissoes`       | GET /list | `permissoes.admin`                         | ❌        | **403 Forbidden**  |
| `com_negocios`         | GET /list | `negocios.view`                            | ❌        | **403 Forbidden**  |
| `com_parametros`       | GET /list | `parametros.gerenciar` ou `dashboard.view` | ❌        | **403 Forbidden**  |
| `com_empresas`         | GET /list | `empresas.view`                            | ✅        | **200 OK**         |

### 5.2 Cenário: Operador Comercial

Permissões: `empresas.view/create/update`, `negocios.view/create/update`, `dashboard.view` (escopo: proprios).

| Collection             | Operação                 | Permissão Requerida                        | Operador tem?            | Resultado Esperado        |
| ---------------------- | ------------------------ | ------------------------------------------ | ------------------------ | ------------------------- |
| `com_perfis`           | GET /list                | `perfis.admin`                             | ❌                       | **403 Forbidden**         |
| `com_usuarios_equipes` | GET /list                | `vinculos.admin`                           | ❌                       | **403 Forbidden**         |
| `com_permissoes`       | GET /list                | `permissoes.admin`                         | ❌                       | **403 Forbidden**         |
| `com_parametros`       | GET /list                | `parametros.gerenciar` ou `dashboard.view` | ✅ (`dashboard.view`)    | **200 OK**                |
| `com_negocios`         | POST /create             | `negocios.create`                          | ✅                       | **200/200 OK**            |
| `com_negocios`         | PATCH /update (de outro) | `negocios.update` + filtro                 | ✅ (mas filtro bloqueia) | **404 Not Found** (regra) |

### 5.3 Cenário: Leitura Executiva

Permissões: `empresas.view`, `negocios.view`, `dashboard.view`, `auditoria.consultar` (escopo: todos).

| Collection       | Operação     | Permissão Requerida                        | Leitura tem? | Resultado Esperado |
| ---------------- | ------------ | ------------------------------------------ | ------------ | ------------------ |
| `com_perfis`     | GET /list    | `perfis.admin`                             | ❌           | **403 Forbidden**  |
| `com_parametros` | GET /list    | `parametros.gerenciar` ou `dashboard.view` | ✅           | **200 OK**         |
| `com_parametros` | POST /create | `parametros.gerenciar`                     | ❌           | **403 Forbidden**  |
| `com_auditoria`  | GET /list    | `auditoria.consultar`                      | ✅           | **200 OK**         |
| `com_negocios`   | POST /create | `negocios.create`                          | ❌           | **403 Forbidden**  |

### 5.4 Cenário: Superadministrador

Permissões: todas as 19 (escopo: todos).

| Collection             | Operação  | Resultado Esperado |
| ---------------------- | --------- | ------------------ |
| `com_perfis`           | GET /list | **200 OK**         |
| `com_usuarios_equipes` | GET /list | **200 OK**         |
| `com_permissoes`       | GET /list | **200 OK**         |
| `com_negocios`         | GET /list | **200 OK**         |
| `com_parametros`       | GET /list | **200 OK**         |

### 5.5 Validação de Status Deprecado

| Request                                          | Valor Enviado            | Resultado Esperado                             |
| ------------------------------------------------ | ------------------------ | ---------------------------------------------- |
| POST /api/collections/com_negocios/records       | `status: "aberto"`       | **400 Bad Request** (select validation + hook) |
| POST /api/collections/com_negocios/records       | `status: "em_andamento"` | **400 Bad Request**                            |
| POST /api/collections/com_negocios/records       | `etapa: "prospects"`     | **200 OK**                                     |
| PATCH /api/collections/com_negocios/records/{id} | `status: "aberto"`       | **400 Bad Request**                            |

---

## 6. Hooks de Autorização

| Hook                                   | Tipo                         | Descrição                                                |
| -------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `guard_list.js`                        | `onRecordListRequest`        | Verifica permissão antes de listar registros             |
| `guard_view.js`                        | `onRecordViewRequest`        | Verifica permissão antes de visualizar registro          |
| `guard_create.js`                      | `onRecordCreateRequest`      | Verifica permissão antes de criar registro               |
| `guard_update.js`                      | `onRecordUpdateRequest`      | Verifica permissão antes de atualizar registro           |
| `validate_negocio_stage_create.js`     | `onRecordCreate`             | Rejeita `aberto`/`em_andamento` + valida etapa/resultado |
| `validate_negocio_stage_update.js`     | `onRecordUpdate`             | Rejeita `aberto`/`em_andamento` + valida etapa/resultado |
| `block_empresa_delete.js`              | `onRecordDelete`             | Bloqueia exclusão de empresa com dependências            |
| `block_negocio_delete.js`              | `onRecordDelete`             | Bloqueia exclusão de negócio com histórico               |
| `block_parametro_delete.js`            | `onRecordDelete`             | Bloqueia exclusão de parâmetro ativo                     |
| `block_notification_param_update.js`   | `onRecordUpdateRequest`      | Apenas superadmin edita params de notificação            |
| `my_permissions.js`                    | `routerAdd`                  | GET /backend/v1/my-permissions                           |
| `change_negocio_responsavel.js`        | `routerAdd`                  | POST /backend/v1/negocios/{id}/change-responsavel        |
| `parametro_version_history.js`         | `onRecordAfterUpdateSuccess` | Versionamento automático de parâmetros                   |
| `auth_with_password.js`                | `routerAdd`                  | Auth customizada com verificação ativo_comercial         |
| `block_inactive_responsavel_create.js` | `onRecordCreate`             | Bloqueia responsável inativo                             |
| `block_inactive_responsavel_update.js` | `onRecordUpdate`             | Bloqueia responsável inativo                             |

---

## 7. Confirmação de Proibições

| Item                          | Status                          |
| ----------------------------- | ------------------------------- |
| Aplicação não publicada       | ✅                              |
| Sem ActiveCampaign            | ✅                              |
| Sem Resend                    | ✅                              |
| Sem webhooks                  | ✅                              |
| Sem scheduler/cron            | ✅                              |
| Sem dados reais               | ✅ (todos os seeds com [TESTE]) |
| Fase 2 não iniciada           | ✅                              |
| Items 9, 10, 11 não iniciados | ✅                              |
| Porta 3B não iniciada         | ✅                              |

---

## 8. Inventário de Migrations (atualizado)

| #         | Arquivo                      | Descrição                                                                       |
| --------- | ---------------------------- | ------------------------------------------------------------------------------- |
| 0001–0029 | (existentes, aplicadas)      | Estrutura base, seeds, correções                                                |
| 0030      | `fix_canonical_structure.js` | Correção definitiva: perfis, permissões, negócios, parâmetros, vigência, regras |

---

**PORTA 3A — Correção estrutural e autorização server-side implementadas. Aguardando revalidação explícita do PMais.**
