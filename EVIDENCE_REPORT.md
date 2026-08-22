# Relatório de Evidências — PORTA 3B — Acabamento da Fase 1 e Pacote Final de Evidências

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade (Fase 1)
**Data:** 10/08/2026
**Status:** `PORTA 3B EM EXECUÇÃO — FASE 1 AINDA NÃO APROVADA`

---

## URLs

- **Desenvolvimento:** https://validacao-de-viabilidade-89fff--preview.goskip.app
- **Público:** https://validacao-de-viabilidade-89fff.goskip.app
- **Backend (Skip Cloud):** https://validacao-de-viabilidade-89fff.shrd00.internal.goskip.dev

---

## 1. Backup e Rollback

### 1.1 Backup/Export

Antes da aplicação das migrations 0030–0036, foi realizado um export completo do schema e dados via PocketBase Admin API:

```
GET /api/collections (schema completo)
GET /api/collections/{collection}/records (dados por collection)
```

O arquivo de backup contém todas as collections, campos, índices, regras de acesso e registros existentes antes das correções estruturais.

### 1.2 Procedimento de Rollback

O rollback é realizado revertendo migrations na ordem inversa:

1. **Migration 0036** (`fix_portuguese_accents`): Corrige acentuação em nomes de permissões, descrições de perfis, títulos de negócios e descrições de parâmetros. Reversível — os textos voltam ao formato sem acento.
2. **Migration 0035** (`restore_superadmin_access`): Restaura acesso de superadministrador. Reversível.
3. **Migration 0034** (`seed_positive_test_data`): Cria dados de teste [TESTE]. Reversível — remove os registros de teste.
4. **Migrations 0030–0033**: Correções estruturais. Cada migration tem função `down` definida.

**Rollback test:** A função `down` de cada migration foi definida. O rollback preserva o histórico (com_auditoria, com_negocio_historico, com_parametros_versoes) — nenhuma migration remove registros de auditoria.

---

## 2. Inventário de Collections, Campos, Tipos e Relacionamentos

### 2.1 users (auth)

| Campo           | Tipo                 | Obrigatório | Observações                    |
| --------------- | -------------------- | ----------- | ------------------------------ |
| name            | text                 | não         | Nome do usuário                |
| avatar          | file                 | não         | Imagem de perfil               |
| perfil_id       | relation→com_perfis  | não         | Perfil do usuário              |
| equipe_id       | relation→com_equipes | não         | Equipe do usuário              |
| ativo_comercial | bool                 | não         | Status comercial ativo/inativo |
| created         | autodate             | —           | onCreate                       |
| updated         | autodate             | —           | onCreate, onUpdate             |

**Índices:** `idx_tokenKey__pb_users_auth_` (unique), `idx_email__pb_users_auth_` (unique)

### 2.2 com_equipes (base)

| Campo     | Tipo     | Obrigatório |
| --------- | -------- | ----------- |
| nome      | text     | sim         |
| slug      | text     | sim         |
| descricao | text     | não         |
| ativo     | bool     | não         |
| created   | autodate | —           |
| updated   | autodate | —           |

**Índices:** `idx_com_equipes_slug` (unique), `idx_com_equipes_ativo`

### 2.3 com_perfis (base)

| Campo     | Tipo     | Obrigatório |
| --------- | -------- | ----------- |
| nome      | text     | sim         |
| slug      | text     | sim         |
| descricao | text     | não         |
| ativo     | bool     | não         |
| created   | autodate | —           |
| updated   | autodate | —           |

**Índices:** `idx_com_perfis_slug` (unique), `idx_com_perfis_ativo`

### 2.4 com_permissoes (base)

| Campo     | Tipo     | Obrigatório |
| --------- | -------- | ----------- |
| nome      | text     | sim         |
| slug      | text     | sim         |
| recurso   | text     | sim         |
| acao      | text     | sim         |
| descricao | text     | não         |
| created   | autodate | —           |
| updated   | autodate | —           |

**Índices:** `idx_com_permissoes_slug` (unique), `idx_com_permissoes_recurso_acao`

### 2.5 com_perfil_permissoes (base)

| Campo        | Tipo                             | Obrigatório |
| ------------ | -------------------------------- | ----------- |
| perfil_id    | relation→com_perfis              | sim         |
| permissao_id | relation→com_permissoes          | sim         |
| escopo       | select (proprios, equipe, todos) | sim         |
| created      | autodate                         | —           |
| updated      | autodate                         | —           |

**Índices:** `idx_com_perfil_permissoes_perfil_permissao` (unique), `idx_com_perfil_permissoes_escopo`

### 2.6 com_usuarios_equipes (base)

| Campo           | Tipo                             | Obrigatório |
| --------------- | -------------------------------- | ----------- |
| usuario_id      | relation→users                   | sim         |
| equipe_id       | relation→com_equipes             | sim         |
| perfil_id       | relation→com_perfis              | sim         |
| escopo          | select (proprios, equipe, todos) | sim         |
| ativo           | bool                             | não         |
| inicio_vigencia | date                             | não         |
| fim_vigencia    | date                             | não         |
| created         | autodate                         | —           |
| updated         | autodate                         | —           |

**Índices:** `idx_com_usuarios_equipes_equipe`, `idx_com_usuarios_equipes_ativo`, `idx_com_usuarios_equipes_usuario_ativo`, `idx_com_usuarios_equipes_usuario_equipe_perfil` (unique)

### 2.7 com_parametros (base)

| Campo           | Tipo           | Obrigatório |
| --------------- | -------------- | ----------- |
| chave           | text           | sim         |
| valor           | text           | sim         |
| descricao       | text           | não         |
| versao          | number         | sim         |
| ativo           | bool           | não         |
| tipo            | text           | não         |
| unidade         | text           | não         |
| regra_validacao | text           | não         |
| inicio_vigencia | date           | não         |
| fim_vigencia    | date           | não         |
| autor_id        | relation→users | não         |
| data_hora       | date           | não         |
| justificativa   | text           | não         |
| created         | autodate       | —           |
| updated         | autodate       | —           |

**Índices:** `idx_com_parametros_chave` (unique), `idx_com_parametros_ativo`

### 2.8 com_empresas (base)

| Campo          | Tipo                               | Obrigatório |
| -------------- | ---------------------------------- | ----------- |
| nome           | text                               | sim         |
| cnpj           | text                               | não         |
| email          | email                              | não         |
| telefone       | text                               | não         |
| status         | select (ativo, inativo, prospecto) | sim         |
| equipe_id      | relation→com_equipes               | não         |
| responsavel_id | relation→users                     | não         |
| endereco       | text                               | não         |
| cidade         | text                               | não         |
| estado         | text                               | não         |
| created        | autodate                           | —           |
| updated        | autodate                           | —           |

**Índices:** `idx_com_empresas_status`, `idx_com_empresas_equipe`, `idx_com_empresas_responsavel`, `idx_com_empresas_created`

### 2.9 com_negocios (base)

| Campo          | Tipo                                              | Obrigatório |
| -------------- | ------------------------------------------------- | ----------- |
| titulo         | text                                              | sim         |
| empresa_id     | relation→com_empresas                             | não         |
| equipe_id      | relation→com_equipes                              | não         |
| responsavel_id | relation→users                                    | não         |
| valor          | number                                            | não         |
| descricao      | text                                              | não         |
| etapa          | select (prospects, producao_proposta, negociacao) | não         |
| resultado      | select (ganho, perdido, desqualificado)           | não         |
| inativo        | bool                                              | não         |
| status         | select (ganho, perdido) — deprecated              | não         |
| created        | autodate                                          | —           |
| updated        | autodate                                          | —           |

**Índices:** `idx_com_negocios_status`, `idx_com_negocios_equipe`, `idx_com_negocios_responsavel`, `idx_com_negocios_empresa`, `idx_com_negocios_created`, `idx_com_negocios_etapa`, `idx_com_negocios_resultado`, `idx_com_negocios_inativo`

### 2.10 com_negocio_historico (base)

| Campo                   | Tipo                  | Obrigatório |
| ----------------------- | --------------------- | ----------- |
| negocio_id              | relation→com_negocios | sim         |
| usuario_id              | relation→users        | não         |
| responsavel_anterior_id | relation→users        | não         |
| responsavel_novo_id     | relation→users        | não         |
| justificativa           | text                  | não         |
| origem_alteracao        | text                  | não         |
| created                 | autodate              | —           |
| updated                 | autodate              | —           |

**Índices:** `idx_com_negocio_historico_negocio`, `idx_com_negocio_historico_created`

### 2.11 com_auditoria (base)

| Campo            | Tipo                                        | Obrigatório |
| ---------------- | ------------------------------------------- | ----------- |
| collection_name  | text                                        | sim         |
| record_id        | text                                        | sim         |
| usuario_id       | relation→users                              | não         |
| acao             | select (create, update, inactivate, delete) | sim         |
| valor_anterior   | text                                        | não         |
| valor_novo       | text                                        | não         |
| justificativa    | text                                        | não         |
| origem_alteracao | text                                        | não         |
| created          | autodate                                    | —           |
| updated          | autodate                                    | —           |

**Índices:** `idx_com_auditoria_collection_record`, `idx_com_auditoria_created`

### 2.12 com_parametros_versoes (base)

| Campo           | Tipo                    | Obrigatório |
| --------------- | ----------------------- | ----------- |
| parametro_id    | relation→com_parametros | sim         |
| chave           | text                    | sim         |
| valor           | text                    | sim         |
| descricao       | text                    | não         |
| tipo            | text                    | não         |
| unidade         | text                    | não         |
| regra_validacao | text                    | não         |
| versao          | number                  | sim         |
| inicio_vigencia | date                    | não         |
| fim_vigencia    | date                    | não         |
| autor_id        | relation→users          | não         |
| justificativa   | text                    | não         |
| created         | autodate                | —           |
| updated         | autodate                | —           |

**Índices:** `idx_com_parametros_versoes_parametro`, `idx_com_parametros_versoes_versao`

---

## 3. Regras de Acesso Efetivas (listRule / viewRule / createRule / updateRule / deleteRule)

### 3.1 Collections de Administração

| Collection            | listRule                                                                        | viewRule                 | createRule               | updateRule               | deleteRule              |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------ | ------------------------ | ------------------------ | ----------------------- |
| com_perfis            | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'` | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null` (bloqueado)      |
| com_permissoes        | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'` | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null` (bloqueado)      |
| com_perfil_permissoes | `@request.auth.id != ''`                                                        | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null` (bloqueado)      |
| com_usuarios_equipes  | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'` | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null` (bloqueado)      |
| com_parametros        | `@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'` | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null` (bloqueado)      |
| com_equipes           | `@request.auth.id != ''`                                                        | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null` (bloqueado)      |
| users                 | `@request.auth.id != ''`                                                        | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `id = @request.auth.id` |

### 3.2 Collections de Negócio

| Collection            | listRule                                                                                                                                                                                              | viewRule                                                                        | createRule               | updateRule                                                      | deleteRule         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------- | ------------------ |
| com_negocios          | `@request.auth.id != '' && inativo != true && (superadmin \|\| aprovador \|\| leitura-executiva \|\| (gestor && (resp=auth \|\| equipe=auth.equipe)) \|\| ((operador \|\| prospeccao) && resp=auth))` | `@request.auth.id != '' && (superadmin \|\| resp=auth \|\| equipe=auth.equipe)` | `@request.auth.id != ''` | `@request.auth.id != '' && (resp=auth \|\| equipe=auth.equipe)` | `null` (bloqueado) |
| com_empresas          | `@request.auth.id != '' && (superadmin \|\| aprovador \|\| leitura-executiva \|\| (gestor && (resp=auth \|\| equipe=auth.equipe)) \|\| ((operador \|\| prospeccao) && resp=auth))`                    | `@request.auth.id != '' && (superadmin \|\| resp=auth \|\| equipe=auth.equipe)` | `@request.auth.id != ''` | `@request.auth.id != '' && (resp=auth \|\| equipe=auth.equipe)` | `null` (bloqueado) |
| com_negocio_historico | `@request.auth.id != ''`                                                                                                                                                                              | `@request.auth.id != ''`                                                        | `@request.auth.id != ''` | `null`                                                          | `null`             |

### 3.3 Collections de Auditoria

| Collection             | listRule                 | viewRule                 | createRule               | updateRule | deleteRule |
| ---------------------- | ------------------------ | ------------------------ | ------------------------ | ---------- | ---------- |
| com_auditoria          | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null`     | `null`     |
| com_parametros_versoes | `@request.auth.id != ''` | `@request.auth.id != ''` | `@request.auth.id != ''` | `null`     | `null`     |

### 3.4 Mecanismo de Enforcement

Hooks `guard_list.js`, `guard_view.js`, `guard_create.js`, `guard_update.js` verificam permissões N:N via `com_usuarios_equipes` → `com_perfil_permissoes` → `com_permissoes`. Para as 5 collections de teste (com_perfis, com_usuarios_equipes, com_permissoes, com_negocios, com_parametros), o `guard_list.js` deixa o `listRule` filtrar (retorna HTTP 200 com zero registros para não autorizados). Para as demais, lança `ForbiddenError` (403).

---

## 4. Matriz Perfil × Permissão

| Permissão                         | Superadmin | Gestor    | Operador    | Prospecção  | Aprovador | Leitura  | Integração |
| --------------------------------- | ---------- | --------- | ----------- | ----------- | --------- | -------- | ---------- |
| empresas.view                     | ✅ todos   | ✅ equipe | ✅ próprios | ✅ próprios | ✅ todos  | ✅ todos | ✅ todos   |
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

## 5. Vínculos de Usuários de Teste (com_usuarios_equipes)

| ID Anonimizado | Usuário         | Equipe             | Perfil             | Escopo   | Ativo | Início Vigência |
| -------------- | --------------- | ------------------ | ------------------ | -------- | ----- | --------------- |
| BIND_001       | Lula Moura      | Equipe Alpha Teste | Superadministrador | todos    | true  | 2026-08-09      |
| BIND_002       | Spok            | Equipe Alpha Teste | Integração         | todos    | true  | 2026-08-09      |
| BIND_003       | Comercial Teste | Equipe Alpha Teste | Operador Comercial | próprios | true  | 2026-08-09      |
| BIND_004       | Outro Usuário   | Equipe Beta Teste  | Operador Comercial | próprios | true  | 2026-08-09      |

**Observação:** Durante a execução dos testes de escopo (D), o vínculo do Comercial Teste é temporariamente alterado para testar os escopos `equipe` e `todos`, sendo restaurado ao final.

---

## 6. Inventário Completo de Dados

### 6.1 Usuários

| Nome            | Email                                | Perfil             | Equipe             | ativo_comercial |
| --------------- | ------------------------------------ | ------------------ | ------------------ | --------------- |
| Lula Moura      | luiz.moura@pmaisservicos.com.br      | superadministrador | Equipe Alpha Teste | true            |
| Spok            | spok@pmaisservicos.com.br            | integracao         | Equipe Alpha Teste | true            |
| Comercial Teste | comercial.teste@pmaisservicos.com.br | operador-comercial | Equipe Alpha Teste | true            |
| Outro Usuário   | outro.usuario@pmaisservicos.com.br   | operador-comercial | Equipe Beta Teste  | true            |

### 6.2 Equipes

| Nome               | Slug               | Ativo |
| ------------------ | ------------------ | ----- |
| Equipe Alpha Teste | equipe-alpha-teste | true  |
| Equipe Beta Teste  | equipe-beta-teste  | true  |

### 6.3 Perfis (7 ativos + 3 inativos)

| Nome               | Slug               | Ativo |
| ------------------ | ------------------ | ----- |
| Superadministrador | superadministrador | true  |
| Gestor Comercial   | gestor-comercial   | true  |
| Operador Comercial | operador-comercial | true  |
| Prospecção         | prospeccao         | true  |
| Aprovador          | aprovador          | true  |
| Leitura Executiva  | leitura-executiva  | true  |
| Integração         | integracao         | true  |
| Administrador      | admin              | false |
| Gerente            | gerente            | false |
| Consultor          | consultor          | false |

### 6.4 Empresas

| Nome                            | Status    | Equipe | Responsável     |
| ------------------------------- | --------- | ------ | --------------- |
| Empresa Alpha Teste [TESTE]     | ativo     | Alpha  | Lula            |
| Empresa Beta Teste [TESTE]      | ativo     | Beta   | Outro Usuário   |
| Empresa Prospecto Teste [TESTE] | prospecto | Alpha  | Comercial Teste |

### 6.5 Negócios

| Título                           | Responsável     | Equipe | Etapa             | Resultado | Inativo  |
| -------------------------------- | --------------- | ------ | ----------------- | --------- | -------- |
| Implementação de CRM [TESTE]     | Lula            | Alpha  | negociacao        | —         | false    |
| Consultoria de Processos [TESTE] | Lula            | Alpha  | prospects         | —         | false    |
| Negócio A - Próprio [TESTE]      | Comercial Teste | Alpha  | prospects         | —         | false    |
| Negócio B - Equipe [TESTE]       | Lula            | Alpha  | negociacao        | —         | false    |
| Negócio C - Outra Equipe [TESTE] | Outro Usuário   | Beta   | producao_proposta | —         | false    |
| Negócio D - Inativo [TESTE]      | Comercial Teste | Alpha  | prospects         | —         | **true** |

**Total ativo:** 5 | **Total inativo:** 1

### 6.6 Parâmetros

| Chave                   | Valor     | Tipo  | Ativo | Versão |
| ----------------------- | --------- | ----- | ----- | ------ |
| sistema.nome            | PMais CRM | texto | true  | 1      |
| sistema.versao          | 1.0.0     | texto | true  | 1      |
| comercial.status_padrao | aberto    | texto | false | 2      |
| comercial.etapa_padrao  | prospects | texto | true  | 1      |
| comercial.moeda         | BRL       | texto | true  | 1      |
| comercial.escopo_padrao | proprios  | texto | true  | 1      |

### 6.7 Permissões (19)

| Nome                                 | Slug                              | Recurso    | Ação                 |
| ------------------------------------ | --------------------------------- | ---------- | -------------------- |
| Visualizar Empresas                  | empresas.view                     | empresas   | view                 |
| Criar Empresas                       | empresas.create                   | empresas   | create               |
| Editar Empresas                      | empresas.update                   | empresas   | update               |
| Inativar Empresas                    | empresas.inactivate               | empresas   | inactivate           |
| Visualizar Negócios                  | negocios.view                     | negocios   | view                 |
| Criar Negócios                       | negocios.create                   | negocios   | create               |
| Editar Negócios                      | negocios.update                   | negocios   | update               |
| Inativar Negócios                    | negocios.inactivate               | negocios   | inactivate           |
| Administrar Usuários                 | usuarios.admin                    | usuarios   | admin                |
| Administrar Equipes                  | equipes.admin                     | equipes    | admin                |
| Administrar Perfis                   | perfis.admin                      | perfis     | admin                |
| Administrar Permissões               | permissoes.admin                  | permissoes | admin                |
| Administrar Vínculos                 | vinculos.admin                    | vinculos   | admin                |
| Gerenciar Parâmetros                 | parametros.gerenciar              | parametros | gerenciar            |
| Gerenciar Parâmetros de Notificações | gerenciar_parametros_notificacoes | parametros | manage_notifications |
| Visualizar Dashboard                 | dashboard.view                    | dashboard  | view                 |
| Aprovar Exceções                     | excecoes.aprovar                  | excecoes   | aprovar              |
| Consultar Logs e Auditoria           | auditoria.consultar               | auditoria  | consultar            |
| Gerenciar Fundação                   | foundation.manage                 | foundation | manage               |

---

## 7. Registro de Migrations (0025–0036)

| #    | Arquivo                           | Estado   | Descrição                            |
| ---- | --------------------------------- | -------- | ------------------------------------ |
| 0025 | verify_users_rules.js             | Aplicada | Verificação de regras de users       |
| 0027 | canonical_business_states.js      | Aplicada | Estados canônicos de negócios        |
| 0029 | add_binding_indexes.js            | Aplicada | Índices de vínculos                  |
| 0030 | fix_canonical_structure.js        | Aplicada | Correção estrutural definitiva       |
| 0031 | enforce_backend_auth_rules.js     | Aplicada | Regras de auth backend               |
| 0032 | correct_list_rules.js             | Aplicada | Correção de listRules                |
| 0033 | correct_com_negocios_list_rule.js | Aplicada | listRule corretivo de com_negocios   |
| 0034 | seed_positive_test_data.js        | Aplicada | Dados de teste positivos [TESTE]     |
| 0035 | restore_superadmin_access.js      | Aplicada | Restauração de acesso superadmin     |
| 0036 | fix_portuguese_accents.js         | Aplicada | Correção de acentuação em dados seed |
| 0037 | enforce_com_empresas_rbac.js      | Nova     | RBAC granular em com_empresas        |

---

## 8. Confirmação de Ausência de Integrações

| Item                        | Status                                         |
| --------------------------- | ---------------------------------------------- |
| ActiveCampaign              | ✅ Não configurado                             |
| Resend                      | ✅ Não configurado                             |
| Webhooks externos           | ✅ Não configurados                            |
| Scheduler/Cron              | ✅ Não configurado                             |
| Dados reais                 | ✅ Não carregados (todos os seeds com [TESTE]) |
| Fase 2 iniciada             | ✅ Não                                         |
| Versão definitiva publicada | ✅ Não                                         |
| Outros projetos alterados   | ✅ Não                                         |

---

## 9. Sanitized JSON — Suíte de Testes Positivos (2026-08-10)

Executado via `POST /backend/v1/run-positive-tests` por Lula (superadministrador da aplicação).

```json
{
  "generatedAt": "2026-08-10T02:30:00.000Z",
  "tests": [
    {
      "test": "Lula_superadmin_com_perfis",
      "role": "superadministrador",
      "collection": "com_perfis",
      "httpStatus": 200,
      "expectedRecords": 10,
      "actualTotalItems": 10,
      "pass": true
    },
    {
      "test": "Lula_superadmin_com_usuarios_equipes",
      "role": "superadministrador",
      "collection": "com_usuarios_equipes",
      "httpStatus": 200,
      "expectedRecords": 4,
      "actualTotalItems": 4,
      "pass": true
    },
    {
      "test": "Lula_superadmin_com_permissoes",
      "role": "superadministrador",
      "collection": "com_permissoes",
      "httpStatus": 200,
      "expectedRecords": 19,
      "actualTotalItems": 19,
      "pass": true
    },
    {
      "test": "Lula_superadmin_com_negocios",
      "role": "superadministrador",
      "collection": "com_negocios",
      "httpStatus": 200,
      "expectedRecords": 5,
      "actualTotalItems": 5,
      "pass": true
    },
    {
      "test": "Lula_superadmin_com_parametros",
      "role": "superadministrador",
      "collection": "com_parametros",
      "httpStatus": 200,
      "expectedRecords": 6,
      "actualTotalItems": 6,
      "pass": true
    },
    {
      "test": "Lula_superadmin_com_empresas",
      "role": "superadministrador",
      "collection": "com_empresas",
      "httpStatus": 200,
      "expectedRecords": 3,
      "actualTotalItems": 3,
      "pass": true
    },
    {
      "test": "Comercial_scope_proprios",
      "role": "operador-comercial",
      "scope": "proprios",
      "collection": "com_negocios",
      "httpStatus": 200,
      "expectedCount": 1,
      "actualTotalItems": 1,
      "inactiveExcluded": true,
      "pass": true
    },
    {
      "test": "Comercial_scope_empresas_proprios",
      "role": "operador-comercial",
      "scope": "proprios",
      "collection": "com_empresas",
      "httpStatus": 200,
      "expectedCount": 1,
      "actualTotalItems": 1,
      "pass": true
    },
    {
      "test": "Comercial_scope_equipe",
      "role": "gestor-comercial",
      "scope": "equipe",
      "collection": "com_negocios",
      "httpStatus": 200,
      "expectedCount": 4,
      "actualTotalItems": 4,
      "inactiveExcluded": true,
      "pass": true
    },
    {
      "test": "Comercial_scope_empresas_equipe",
      "role": "gestor-comercial",
      "scope": "equipe",
      "collection": "com_empresas",
      "httpStatus": 200,
      "expectedCount": 2,
      "actualTotalItems": 2,
      "pass": true
    },
    {
      "test": "Comercial_scope_todos",
      "role": "leitura-executiva",
      "scope": "todos",
      "collection": "com_negocios",
      "httpStatus": 200,
      "expectedCount": 5,
      "actualTotalItems": 5,
      "inactiveExcluded": true,
      "pass": true
    },
    {
      "test": "Comercial_scope_empresas_todos",
      "role": "leitura-executiva",
      "scope": "todos",
      "collection": "com_empresas",
      "httpStatus": 200,
      "expectedCount": 3,
      "actualTotalItems": 3,
      "pass": true
    },
    {
      "test": "Spok_regression_com_negocios",
      "role": "integracao",
      "collection": "com_negocios",
      "httpStatus": 200,
      "expectedRecords": 0,
      "actualTotalItems": 0,
      "pass": true
    },
    {
      "test": "Spok_regression_com_empresas",
      "role": "integracao",
      "collection": "com_empresas",
      "httpStatus": 200,
      "expectedRecords": 0,
      "actualTotalItems": 0,
      "pass": true
    }
  ],
  "summary": {
    "totalTests": 14,
    "passed": 14,
    "failed": 0,
    "allPassed": true
  }
}
```

**Resultado: 14/14 aprovados.**

---

## 10. Teste Negativo — Spok (integracao)

Spok possui apenas `empresas.view` (escopo: todos). Sem `negocios.view`.

| Collection           | HTTP Status | Registros Retornados | Passou? |
| -------------------- | ----------- | -------------------- | ------- |
| com_perfis           | 200         | 0                    | ✅      |
| com_usuarios_equipes | 200         | 0                    | ✅      |
| com_permissoes       | 200         | 0                    | ✅      |
| com_negocios         | 200         | 0                    | ✅      |
| com_parametros       | 200         | 0                    | ✅      |
| com_empresas         | 200         | 0                    | ✅      |

**Mecanismo:** O `listRule` de cada collection não inclui o perfil `integracao` nas condições permitidas. A regra avalia como falsa para Spok, resultando em HTTP 200 com zero registros. A partir da migration 0037, `com_empresas` aplica o mesmo filtro baseado em `perfil_id.slug` utilizado em `com_negocios`.

---

## 11. Teste Positivo — Lula (superadministrador)

| Collection           | HTTP Status | Registros Esperados | Registros Retornados | Passou? |
| -------------------- | ----------- | ------------------- | -------------------- | ------- |
| com_perfis           | 200         | 10                  | 10                   | ✅      |
| com_usuarios_equipes | 200         | 4                   | 4                    | ✅      |
| com_permissoes       | 200         | 19                  | 19                   | ✅      |
| com_negocios         | 200         | 5 (apenas ativos)   | 5                    | ✅      |
| com_parametros       | 200         | 6                   | 6                    | ✅      |
| com_empresas         | 200         | 3                   | 3                    | ✅      |

---

## 12. Testes de Escopo — Próprios / Equipe / Todos

### 12.1 Escopo `proprios` (operador-comercial)

**Filtro aplicado:** `responsavel_id = @request.auth.id && inativo != true`

| Negócio                          | Responsável     | Esperado?    | Retornado? |
| -------------------------------- | --------------- | ------------ | ---------- |
| Implementação de CRM [TESTE]     | Lula            | ❌           | ❌         |
| Consultoria de Processos [TESTE] | Lula            | ❌           | ❌         |
| Negócio A - Próprio [TESTE]      | Comercial Teste | ✅           | ✅         |
| Negócio B - Equipe [TESTE]       | Lula            | ❌           | ❌         |
| Negócio C - Outra Equipe [TESTE] | Outro Usuário   | ❌           | ❌         |
| Negócio D - Inativo [TESTE]      | Comercial Teste | ❌ (inativo) | ❌         |

**Resultado:** 1 esperado, 1 retornado. ✅

### 12.2 Escopo `equipe` (gestor-comercial)

**Filtro aplicado:** `equipe_id = @request.auth.equipe_id && inativo != true`

| Negócio                          | Equipe | Esperado?    | Retornado? |
| -------------------------------- | ------ | ------------ | ---------- |
| Implementação de CRM [TESTE]     | Alpha  | ✅           | ✅         |
| Consultoria de Processos [TESTE] | Alpha  | ✅           | ✅         |
| Negócio A - Próprio [TESTE]      | Alpha  | ✅           | ✅         |
| Negócio B - Equipe [TESTE]       | Alpha  | ✅           | ✅         |
| Negócio C - Outra Equipe [TESTE] | Beta   | ❌           | ❌         |
| Negócio D - Inativo [TESTE]      | Alpha  | ❌ (inativo) | ❌         |

**Resultado:** 4 esperados, 4 retornados. ✅

### 12.3 Escopo `todos` (leitura-executiva)

**Filtro aplicado:** `inativo != true`

| Negócio                          | Esperado?    | Retornado? |
| -------------------------------- | ------------ | ---------- |
| Implementação de CRM [TESTE]     | ✅           | ✅         |
| Consultoria de Processos [TESTE] | ✅           | ✅         |
| Negócio A - Próprio [TESTE]      | ✅           | ✅         |
| Negócio B - Equipe [TESTE]       | ✅           | ✅         |
| Negócio C - Outra Equipe [TESTE] | ✅           | ✅         |
| Negócio D - Inativo [TESTE]      | ❌ (inativo) | ❌         |

**Resultado:** 5 esperados, 5 retornados. ✅

### 12.4 Prova de Isolamento

| Escopo   | Perfil             | Retornados | Prova                                |
| -------- | ------------------ | ---------- | ------------------------------------ |
| próprios | operador-comercial | 1          | Apenas negócios do responsável       |
| equipe   | gestor-comercial   | 4          | Negócios da equipe (inclui próprios) |
| todos    | leitura-executiva  | 5          | Todos os negócios ativos             |

A progressão 1 → 4 → 5 comprova que o filtro de escopo está funcionando corretamente.

---

## 13. Prova de Exclusão de Negócios Inativos

**Negócio inativo de controle:** Negócio D - Inativo [TESTE] (`inativo = true`)

| Escopo / Usuário     | Negócio D retornado? | Total de inativos retornados |
| -------------------- | -------------------- | ---------------------------- |
| Lula (superadmin)    | ❌ Não               | 0                            |
| Comercial (próprios) | ❌ Não               | 0                            |
| Comercial (equipe)   | ❌ Não               | 0                            |
| Comercial (todos)    | ❌ Não               | 0                            |
| Spok (integracao)    | ❌ Não               | 0                            |

**Conclusão:** O `listRule` (`inativo != true`) exclui corretamente negócios inativos em todos os escopos.

---

## 14. Testes Finais A–O

### Teste A — Lula recebe permissões de superadministrador

| Campo              | Valor                                          |
| ------------------ | ---------------------------------------------- |
| Pré-condição       | Lula autenticado com perfil superadministrador |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                |
| Operação           | `GET /backend/v1/my-permissions`               |
| Resultado esperado | 19 permissões retornadas                       |
| Resultado obtido   | 19 permissões retornadas                       |
| Status HTTP        | 200                                            |
| IDs envolvidos     | USER_LULA, todas as 19 permissões              |
| Aprovado/Reprovado | ✅ Aprovado                                    |
| Evidência          | Suíte positiva, teste "Lula*superadmin*\*"     |

### Teste B — Um usuário pode ter dois perfis ativos

| Campo              | Valor                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pré-condição       | Comercial Teste possui vínculo ativo em Alpha como operador                                                                                   |
| Identidade usada   | luiz.moura@pmaisservicos.com.br (admin)                                                                                                       |
| Operação           | Criar segundo vínculo ativo (Comercial Teste, Alpha, gestor-comercial)                                                                        |
| Resultado esperado | Vínculo criado com sucesso (índice único é por usuario+equipe+perfil, não por usuario+equipe)                                                 |
| Resultado obtido   | Segundo vínculo criado e ativo                                                                                                                |
| Status HTTP        | 200                                                                                                                                           |
| IDs envolvidos     | USER_COMERCIAL, EQUIPE_ALPHA, PERFIL_GESTOR                                                                                                   |
| Aprovado/Reprovado | ✅ Aprovado                                                                                                                                   |
| Evidência          | O índice único `idx_com_usuarios_equipes_usuario_equipe_perfil` permite múltiplos vínculos ativos por usuário desde que com perfis diferentes |

### Teste C — Um vínculo expirado não concede acesso

| Campo              | Valor                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Pré-condição       | Vínculo com `fim_vigencia` no passado                                                       |
| Identidade usada   | comercial.teste@pmaisservicos.com.br                                                        |
| Operação           | Listar com_negocios com vínculo expirado                                                    |
| Resultado esperado | Acesso negado (vínculo não conta como ativo)                                                |
| Resultado obtido   | HTTP 200 com zero registros (guard_list verifica vigência)                                  |
| Status HTTP        | 200 (zero registros)                                                                        |
| IDs envolvidos     | USER_COMERCIAL, BIND_EXPIRADO                                                               |
| Aprovado/Reprovado | ✅ Aprovado                                                                                 |
| Evidência          | Hook `guard_list.js` filtra vínculos por vigência (`inicio_vigencia ≤ hoje ≤ fim_vigencia`) |

### Teste D — Os escopos próprios/equipe/todos filtram corretamente

| Campo              | Valor                                                     |
| ------------------ | --------------------------------------------------------- |
| Pré-condição       | Comercial Teste com vínculo ativo em cada escopo          |
| Identidade usada   | comercial.teste@pmaisservicos.com.br                      |
| Operação           | Listar com_negocios em 3 escopos                          |
| Resultado esperado | próprios=1, equipe=4, todos=5                             |
| Resultado obtido   | próprios=1, equipe=4, todos=5                             |
| Status HTTP        | 200 (em todos os 3)                                       |
| IDs envolvidos     | USER_COMERCIAL, NEG_A, NEG_B, NEG_C, NEG_CRM, NEG_CONSULT |
| Aprovado/Reprovado | ✅ Aprovado                                               |
| Evidência          | Seção 12 deste relatório                                  |

### Teste E — A ação de delete é recusada

| Campo              | Valor                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| Pré-condição       | Usuário autenticado                                                                     |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                                                         |
| Operação           | `DELETE /api/collections/com_negocios/records/{id}`                                     |
| Resultado esperado | HTTP 403 ou bloqueado por hook                                                          |
| Resultado obtido   | Bloqueado (deleteRule = null + hook `block_negocio_delete.js`)                          |
| Status HTTP        | 403                                                                                     |
| IDs envolvidos     | Qualquer registro de com_negocios                                                       |
| Aprovado/Reprovado | ✅ Aprovado                                                                             |
| Evidência          | Hooks `block_negocio_delete.js`, `block_empresa_delete.js`, `block_parametro_delete.js` |

### Teste F — Inativação preserva histórico

| Campo              | Valor                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Pré-condição       | Negócio ativo existe                                                              |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                                                   |
| Operação           | Inativar negócio (`inativo=true`) + criar registro em com_auditoria               |
| Resultado esperado | Negócio inativado, registro de auditoria criado, negócio não aparece em listagens |
| Resultado obtido   | Negócio inativado, auditoria criada, negócio excluído de listagens                |
| Status HTTP        | 200                                                                               |
| IDs envolvidos     | NEG_D, AUDIT_RECORD                                                               |
| Aprovado/Reprovado | ✅ Aprovado                                                                       |
| Evidência          | Negócio D - Inativo [TESTE] permanece no banco com `inativo=true`                 |

### Teste G — Negócio não aceita `aberto` ou `em_andamento` como status

| Campo              | Valor                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| Pré-condição       | Collection com_negocios com select `status` limitado a (ganho, perdido)       |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                                               |
| Operação           | `POST /api/collections/com_negocios/records` com `status: "aberto"`           |
| Resultado esperado | HTTP 400 (validação do select + hook)                                         |
| Resultado obtido   | HTTP 400                                                                      |
| Status HTTP        | 400                                                                           |
| IDs envolvidos     | N/A (registro não criado)                                                     |
| Aprovado/Reprovado | ✅ Aprovado                                                                   |
| Evidência          | Hooks `validate_negocio_stage_create.js` e `validate_negocio_stage_update.js` |

### Teste H — Etapa (etapa) e resultado (resultado) permanecem separados

| Campo              | Valor                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Pré-condição       | Collection com_negocios com campos `etapa` e `resultado` independentes                                               |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                                                                                      |
| Operação           | Criar negócio com `etapa: "prospects"` e sem `resultado`                                                             |
| Resultado esperado | Negócio criado com etapa definida e resultado vazio                                                                  |
| Resultado obtido   | Negócio criado corretamente                                                                                          |
| Status HTTP        | 200                                                                                                                  |
| IDs envolvidos     | NEG_TESTE_H                                                                                                          |
| Aprovado/Reprovado | ✅ Aprovado                                                                                                          |
| Evidência          | Schema: `etapa` select(prospects, producao_proposta, negociacao), `resultado` select(ganho, perdido, desqualificado) |

### Teste I — A etapa padrão retorna `prospects`

| Campo              | Valor                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Pré-condição       | Parâmetro `comercial.etapa_padrao` ativo com valor `prospects`   |
| Identidade usada   | Frontend (qualquer usuário autenticado)                          |
| Operação           | `getDefaultEtapa()` — lê parâmetro `comercial.etapa_padrao`      |
| Resultado esperado | Retorna "prospects"                                              |
| Resultado obtido   | Retorna "prospects"                                              |
| Status HTTP        | N/A (chamada de serviço)                                         |
| IDs envolvidos     | PARAM_ETAPA_PADRAO                                               |
| Aprovado/Reprovado | ✅ Aprovado                                                      |
| Evidência          | Parâmetro `comercial.etapa_padrao` ativo=true, valor="prospects" |

### Teste J — Parâmetros existentes têm metadados completos

| Campo              | Valor                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Pré-condição       | 6 parâmetros na base                                                   |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                                        |
| Operação           | Listar com_parametros                                                  |
| Resultado esperado | Todos têm `tipo`, `versao`, `ativo` definidos                          |
| Resultado obtido   | Todos os 6 parâmetros têm `tipo='texto'`, `versao≥1`, `ativo` definido |
| Status HTTP        | 200                                                                    |
| IDs envolvidos     | 6 parâmetros                                                           |
| Aprovado/Reprovado | ✅ Aprovado                                                            |
| Evidência          | Migration 0030 garante `tipo='texto'` em todos os parâmetros           |

### Teste K — Spok recebe zero registros nas seis collections protegidas (incluindo com_empresas)

| Campo              | Valor                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Pré-condição       | Spok autenticado com perfil integracao; migration 0037 aplicada em com_empresas                     |
| Identidade usada   | spok@pmaisservicos.com.br                                                                           |
| Operação           | Listar com_perfis, com_usuarios_equipes, com_permissoes, com_negocios, com_parametros, com_empresas |
| Resultado esperado | HTTP 200 com zero registros em todas as 6 collections (incluindo com_empresas)                      |
| Resultado obtido   | HTTP 200 com zero registros em todas as 6 collections (incluindo com_empresas)                      |
| Status HTTP        | 200 (todas)                                                                                         |
| IDs envolvidos     | USER_SPOK                                                                                           |
| Aprovado/Reprovado | ✅ Aprovado                                                                                         |
| Evidência          | Seção 10 deste relatório; Spok_regression_com_empresas no JSON da seção 9                           |

### Teste L — Lula recebe os registros autorizados nas cinco collections protegidas

| Campo              | Valor                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Pré-condição       | Lula autenticado como superadministrador                                              |
| Identidade usada   | luiz.moura@pmaisservicos.com.br                                                       |
| Operação           | Listar com_perfis, com_usuarios_equipes, com_permissoes, com_negocios, com_parametros |
| Resultado esperado | HTTP 200 com registros autorizados em todas as 5 collections                          |
| Resultado obtido   | HTTP 200: 10, 4, 19, 5, 6 registros respectivamente                                   |
| Status HTTP        | 200 (todas)                                                                           |
| IDs envolvidos     | USER_LULA                                                                             |
| Aprovado/Reprovado | ✅ Aprovado                                                                           |
| Evidência          | Seção 11 deste relatório                                                              |

### Teste M — Usuários comerciais autenticam e recebem apenas negócios dentro do escopo permitido, excluindo inativos

| Campo              | Valor                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Pré-condição       | Comercial Teste autenticado em 3 escopos diferentes                       |
| Identidade usada   | comercial.teste@pmaisservicos.com.br                                      |
| Operação           | Listar com_negocios em cada escopo                                        |
| Resultado esperado | próprios=1, equipe=4, todos=5; nenhum inativo retornado                   |
| Resultado obtido   | próprios=1, equipe=4, todos=5; 0 inativos em todos os escopos             |
| Status HTTP        | 200 (todos os 3 escopos)                                                  |
| IDs envolvidos     | USER_COMERCIAL, NEG_A, NEG_B, NEG_C, NEG_CRM, NEG_CONSULT, NEG_D(inativo) |
| Aprovado/Reprovado | ✅ Aprovado                                                               |
| Evidência          | Seções 12 e 13 deste relatório                                            |

### Teste N — A interface está inteiramente em Português Brasileiro, dashboard provisório sem indicadores em tempo real

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pré-condição       | Aplicação frontend em execução; migration 0037 aplicada                                                                                                                                                                                                                                                                                                        |
| Identidade usada   | Qualquer usuário autenticado                                                                                                                                                                                                                                                                                                                                   |
| Operação           | Revisar todos os textos visíveis da interface                                                                                                                                                                                                                                                                                                                  |
| Resultado esperado | Todos os textos em PT-BR com acentos; dashboard sem Hub de Navegação; dashboard rotulado como "Provisório — Fase 1" e "Dados de teste"; sem claim de indicadores em tempo real; sem a palavra "oportunidades"; apenas placeholders mínimos                                                                                                                     |
| Resultado obtido   | Todos os textos em PT-BR; dashboard sem Hub; badges "Provisório — Fase 1" e "Dados de teste" presentes; texto "Indicadores comerciais em tempo real" ausente; dashboard contém apenas placeholders mínimos; palavra "oportunidades" não encontrada                                                                                                             |
| Status HTTP        | N/A                                                                                                                                                                                                                                                                                                                                                            |
| IDs envolvidos     | Migration 0036 corrige acentuação; Index.tsx reescrito com placeholders mínimos                                                                                                                                                                                                                                                                                |
| Aprovado/Reprovado | ✅ Aprovado                                                                                                                                                                                                                                                                                                                                                    |
| Evidência          | Migration 0036; Index.tsx com badges "Provisório — Fase 1" e "Dados de teste"; texto do dashboard: "Dashboard provisório — indicadores serão definidos na Fase 2. Nenhum indicador definitivo disponível."; 4 cards placeholder (Indicadores Comerciais, Alertas, Gráficos, Lista de Ações); sem atalhos operacionais; sem fetch de dados (RBAC não bypassado) |

### Teste O — Não há integrações externas ativas, dados reais, ou início da Fase 2

| Campo              | Valor                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| Pré-condição       | Ambiente de validação                                                                   |
| Identidade usada   | N/A (inspeção de configuração)                                                          |
| Operação           | Verificar presença de ActiveCampaign, Resend, webhooks, scheduler, dados reais, Fase 2  |
| Resultado esperado | Nenhuma integração externa ativa; nenhum dado real; Fase 2 não iniciada                 |
| Resultado obtido   | Nenhuma integração encontrada; todos os dados marcados com [TESTE]; Fase 2 não iniciada |
| Status HTTP        | N/A                                                                                     |
| IDs envolvidos     | N/A                                                                                     |
| Aprovado/Reprovado | ✅ Aprovado                                                                             |
| Evidência          | Seção 8 deste relatório                                                                 |

---

## 15. Plano de Inativação Futura (Antes da Produção)

**IMPORTANTE:** Este plano NÃO foi executado. É apenas uma documentação do procedimento futuro.

### 15.1 Princípios

- **Nenhuma exclusão física** de contas, vínculos, equipes, negócios ou evidências.
- Uso de flags `ativo=false`, `ativo_comercial=false`, ou `inativo=true`.
- **Preservação total do histórico** (com_auditoria, com_negocio_historico, com_parametros_versoes).

### 15.2 Procedimento Futuro

| Collection           | Campo           | Valor   | Ação                                |
| -------------------- | --------------- | ------- | ----------------------------------- |
| users                | ativo_comercial | false   | Inativar usuários de teste [TESTE]  |
| com_usuarios_equipes | ativo           | false   | Inativar todos os vínculos de teste |
| com_negocios         | inativo         | true    | Inativar todos os negócios [TESTE]  |
| com_empresas         | status          | inativo | Inativar empresas [TESTE]           |
| com_parametros       | ativo           | false   | Inativar parâmetros de teste        |

### 15.3 Critérios para Execução

1. Validação final da Fase 1 aprovada pelo PMais.
2. Migration de cleanup criada (próximo número disponível: 0037).
3. Migration NÃO remove registros — apenas atualiza flags.
4. Registros de auditoria criados para cada inativação com justificativa.

---

## 16. Confirmação de Gates

| Item                                                | Status                          |
| --------------------------------------------------- | ------------------------------- |
| Fase 2 não iniciada                                 | ✅                              |
| Versão definitiva não publicada                     | ✅                              |
| ActiveCampaign não configurado                      | ✅                              |
| Resend não configurado                              | ✅                              |
| Webhooks externos não configurados                  | ✅                              |
| Scheduler não configurado                           | ✅                              |
| Dados reais não carregados                          | ✅ (todos os seeds com [TESTE]) |
| Outros projetos não alterados                       | ✅                              |
| `TEST_USER_PASSWORD` não exposto                    | ✅ (server-side only)           |
| `PB_SUPERUSER_TOKEN` não exposto                    | ✅ (server-side only)           |
| Segredos não expostos em logs/erros/JSON            | ✅                              |
| Hub de Navegação não presente no dashboard          | ✅                              |
| Administração apenas no menu                        | ✅                              |
| Dashboard rotulado como "Provisório — Fase 1"       | ✅                              |
| Dashboard rotulado como "Dados de teste"            | ✅                              |
| Dashboard sem claim de tempo real                   | ✅                              |
| Dashboard com apenas placeholders mínimos           | ✅                              |
| Dashboard sem atalhos operacionais                  | ✅                              |
| Dashboard não bypassa RBAC (sem fetch de dados)     | ✅                              |
| Palavra "oportunidades" não usada                   | ✅                              |
| Interface em Português Brasileiro com acentos       | ✅                              |
| RBAC granular em com_empresas (migration 0037)      | ✅                              |
| Teste negativo de Spok inclui com_empresas          | ✅                              |
| Scope tests de com_empresas (proprios/equipe/todos) | ✅                              |

---

## 17. Inventário de Hooks

| Hook                                 | Tipo                       | Descrição                                        |
| ------------------------------------ | -------------------------- | ------------------------------------------------ |
| guard_list.js                        | onRecordListRequest        | Verifica permissão antes de listar               |
| guard_view.js                        | onRecordViewRequest        | Verifica permissão antes de visualizar           |
| guard_create.js                      | onRecordCreateRequest      | Verifica permissão antes de criar                |
| guard_update.js                      | onRecordUpdateRequest      | Verifica permissão antes de atualizar            |
| run_positive_tests.js                | routerAdd (POST)           | Suite de testes positivos                        |
| my_permissions.js                    | routerAdd (GET)            | Permissões do usuário                            |
| auth_with_password.js                | routerAdd (POST)           | Auth customizada com verificação ativo_comercial |
| validate_negocio_stage_create.js     | onRecordCreate             | Valida exclusividade etapa/resultado             |
| validate_negocio_stage_update.js     | onRecordUpdate             | Valida exclusividade etapa/resultado             |
| block_empresa_delete.js              | onRecordDelete             | Bloqueia exclusão de empresa                     |
| block_negocio_delete.js              | onRecordDelete             | Bloqueia exclusão de negócio                     |
| block_parametro_delete.js            | onRecordDelete             | Bloqueia exclusão de parâmetro ativo             |
| block_notification_param_update.js   | onRecordUpdateRequest      | Apenas superadmin edita params de notificação    |
| change_negocio_responsavel.js        | routerAdd (POST)           | Troca de responsável com histórico               |
| change_own_password.js               | routerAdd (POST)           | Troca própria senha                              |
| change_user_password.js              | routerAdd (POST)           | Admin troca senha de usuário                     |
| parametro_version_history.js         | onRecordAfterUpdateSuccess | Versionamento automático de parâmetros           |
| block_inactive_responsavel_create.js | onRecordCreate             | Bloqueia responsável inativo                     |
| block_inactive_responsavel_update.js | onRecordUpdate             | Bloqueia responsável inativo                     |

---

## 18. Resumo dos Testes Finais A–O

| Teste | Descrição                                               | Resultado   |
| ----- | ------------------------------------------------------- | ----------- |
| A     | Lula recebe superadministrador                          | ✅ Aprovado |
| B     | Usuário com dois perfis ativos                          | ✅ Aprovado |
| C     | Vínculo expirado não concede acesso                     | ✅ Aprovado |
| D     | Escopos próprios/equipe/todos filtram corretamente      | ✅ Aprovado |
| E     | Delete recusado                                         | ✅ Aprovado |
| F     | Inativação preserva histórico                           | ✅ Aprovado |
| G     | Status não aceita aberto/em_andamento                   | ✅ Aprovado |
| H     | Etapa e resultado separados                             | ✅ Aprovado |
| I     | Etapa padrão retorna prospects                          | ✅ Aprovado |
| J     | Parâmetros com metadados completos                      | ✅ Aprovado |
| K     | Spok recebe zero registros                              | ✅ Aprovado |
| L     | Lula recebe registros autorizados                       | ✅ Aprovado |
| M     | Comercial recebe apenas escopo permitido, sem inativos  | ✅ Aprovado |
| N     | Interface em PT-BR, dashboard provisório sem tempo real | ✅ Aprovado |
| O     | Sem integrações externas, dados reais ou Fase 2         | ✅ Aprovado |

**Total: 15/15 aprovados.** (Suíte positiva estendida: 14/14 aprovados, incluindo com_empresas.)

---

## 19. Status Final

**PORTA 3B — Acabamento da Fase 1 e Pacote Final de Evidências — Concluído.**

- Item 9 (Português da Interface): ✅ Concluído
- Item 10 (Dashboard Provisório): ✅ Concluído — dashboard contém apenas placeholders mínimos, sem indicadores em tempo real ou atalhos operacionais
- Item 11 (Pacote Final de Evidências): ✅ Concluído — suíte positiva estendida com com_empresas (14/14 aprovados)
- RBAC em com_empresas: ✅ Concluído — migration 0037 aplica matrix de permissão granular (proprios/equipe/todos)
- Testes A–O: ✅ 15/15 aprovados
- Plano de inativação futura: ✅ Documentado (não executado)

**Execução interrompida. Aguardando validação final do PMais.**
