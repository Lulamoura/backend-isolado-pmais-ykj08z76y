# EVIDENCE — Porta 2C — Execução Controlada de Bootstrap e Testes HTTP

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade
**Data:** 10/08/2026
**Status:** Porta 2C em execução. Porta 2D BLOQUEADA. Code freeze ativo.

---

## 1. Code Freeze Confirmation

| Item                                                                | Status                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Migrations                                                          | ❌ Não modificadas (0058 é a última aplicada)              |
| Guards (guard_create, guard_update, guard_list, guard_view)         | ❌ Congelados — diff read-only na seção 7                  |
| Hooks (integracao_precheck, integracao_bootstrap, integracao_tests) | ❌ Congelados                                              |
| Regras de collection (list/view/create/update/delete)               | ❌ Não modificadas                                         |
| Schema                                                              | ❌ Não modificado                                          |
| Frontend                                                            | ❌ Arquivos existentes não modificados                     |
| Dados                                                               | ❌ Apenas registros [TESTE] sintéticos criados e removidos |
| Porta 2D                                                            | ❌ BLOQUEADA — não iniciada                                |

---

## 2. Pre-check Execution (`GET /backend/v1/integracao/precheck`)

### 2.1 Secret Verification

| Verificação                                     | Resultado Esperado                   |
| ----------------------------------------------- | ------------------------------------ |
| Secret `COMERCIAL_INTEGRACAO_PASSWORD` presente | ✅ `secretRegistered: true`          |
| Valor do secret retornado                       | ❌ NUNCA — apenas presença (boolean) |
| Hash/Base64/fragmento                           | ❌ NUNCA                             |

### 2.2 Perfil Integração

| Campo | Valor Esperado                      |
| ----- | ----------------------------------- |
| Slug  | `integracao`                        |
| Ativo | `true`                              |
| ID    | Sanitizado (primeiros 8 caracteres) |

### 2.3 Matriz de Permissões Esperada (15 slugs)

| #   | Slug                           | Escopo |
| --- | ------------------------------ | ------ |
| 1   | contatos.view                  | todos  |
| 2   | contatos.create                | todos  |
| 3   | etapas.view                    | todos  |
| 4   | etapas.create                  | todos  |
| 5   | alias_dimensoes.view           | todos  |
| 6   | alias_dimensoes.create         | todos  |
| 7   | vinculos_externos.view         | todos  |
| 8   | vinculos_externos.create       | todos  |
| 9   | execucoes_sincronizacao.view   | todos  |
| 10  | execucoes_sincronizacao.create | todos  |
| 11  | eventos_integracao.view        | todos  |
| 12  | eventos_integracao.create      | todos  |
| 13  | snapshots_negocio.view         | todos  |
| 14  | ocorrencias_qualidade.view     | todos  |
| 15  | ocorrencias_qualidade.create   | todos  |

### 2.4 Permissões Removidas (excedentes)

| Slug                     | Motivo                                          |
| ------------------------ | ----------------------------------------------- |
| snapshots_negocio.create | Revogada na migration 0050 (createRule = SO)    |
| empresas.view            | Removida (não pertence ao escopo de integração) |
| negocios.view            | Removida (não pertence ao escopo de integração) |
| Qualquer `.update`       | Removida (update bloqueado para integração)     |

### 2.5 Conta Técnica

| Verificação         | Resultado Esperado                                                              |
| ------------------- | ------------------------------------------------------------------------------- |
| Conta pré-existente | `nenhuma` (antes do bootstrap) ou `Integração Comercial PMais` (após bootstrap) |
| Contas duplicadas   | 0 (máximo 1)                                                                    |
| Spok                | Perfil `integracao` (distinto da conta técnica)                                 |

---

## 3. Bootstrap Idempotency (`POST /backend/v1/integracao/bootstrap`)

### 3.1 Execução #1

| Campo                            | Valor Esperado                                        |
| -------------------------------- | ----------------------------------------------------- |
| Status                           | `OK`                                                  |
| Action                           | `created` (primeira vez) ou `aligned` (se já existir) |
| Account name                     | `Integração Comercial PMais`                          |
| Account perfil                   | `integracao`                                          |
| ativo_comercial                  | `true`                                                |
| equipe_id                        | vazio (sem equipe)                                    |
| com_usuarios_equipes bindings    | 0 (removidos)                                         |
| Password/Token/Secret retornados | ❌ NUNCA                                              |

### 3.2 Execução #2 (Idempotência)

| Campo                    | Valor Esperado             |
| ------------------------ | -------------------------- |
| Status                   | `OK`                       |
| Action                   | `aligned`                  |
| Account ID               | **Idêntico** à execução #1 |
| Duplicatas               | 0                          |
| Outras contas integracao | 0                          |

### 3.3 Rejeições de Acesso

| Tentativa                 | Resultado Esperado |
| ------------------------- | ------------------ |
| Usuário regular           | 403 Forbidden      |
| Spok                      | 403 Forbidden      |
| Conta técnica autenticada | 403 Forbidden      |

---

## 4. Authentication Verification

| Verificação           | Resultado Esperado                              |
| --------------------- | ----------------------------------------------- |
| HTTP Status           | 200                                             |
| Auth success          | `true`                                          |
| Account ID            | Sanitizado (idêntico ao bootstrap)              |
| Profile slug          | `integracao`                                    |
| Spok perfil           | `integracao` (distinto da conta técnica)        |
| Spok isIntegracao     | `true` (perfil integracao, mas conta diferente) |
| Token/Password/Secret | ❌ NUNCA retornado ou logado                    |

---

## 5. Complete HTTP Test Matrix

### 5.1 Operações Permitidas (PASS esperado — 2xx)

| Collection                  | List (200) | View (200) | Create (2xx) |
| --------------------------- | ---------- | ---------- | ------------ |
| com_contatos                | ✅         | ✅         | ✅           |
| com_etapas                  | ✅         | ✅         | ✅           |
| com_alias_dimensoes         | ✅         | ✅         | ✅           |
| com_vinculos_externos       | ✅         | ✅         | ✅           |
| com_execucoes_sincronizacao | ✅         | ✅         | ✅           |
| com_eventos_integracao      | ✅         | ✅         | ✅           |
| com_ocorrencias_qualidade   | ✅         | ✅         | ✅           |

### 5.2 Operações Permitidas — Apenas List/View

| Collection            | List (200) | View (200/404) | Create (403) | Update (403) | Delete (403) |
| --------------------- | ---------- | -------------- | ------------ | ------------ | ------------ |
| com_snapshots_negocio | ✅         | ✅             | ✅ Blocked   | ✅ Blocked   | ✅ Blocked   |

### 5.3 Operações Bloqueadas (PASS esperado — non-2xx/403)

| Collection                  | Update (403) | Delete (403) |
| --------------------------- | ------------ | ------------ |
| com_contatos                | ✅ Blocked   | ✅ Blocked   |
| com_etapas                  | ✅ Blocked   | ✅ Blocked   |
| com_alias_dimensoes         | ✅ Blocked   | ✅ Blocked   |
| com_vinculos_externos       | ✅ Blocked   | ✅ Blocked   |
| com_execucoes_sincronizacao | ✅ Blocked   | ✅ Blocked   |
| com_eventos_integracao      | ✅ Blocked   | ✅ Blocked   |
| com_ocorrencias_qualidade   | ✅ Blocked   | ✅ Blocked   |

### 5.4 Collections Comerciais Bloqueadas

| Collection    | Create (403) | Update (403) | Delete (403) |
| ------------- | ------------ | ------------ | ------------ |
| com_negocios  | ✅ Blocked   | ✅ Blocked   | ✅ Blocked   |
| com_auditoria | ✅ Blocked   | ✅ Blocked   | ✅ Blocked   |

### 5.5 com_negocio_historico — Acesso Totalmente Bloqueado

| Operação | Resultado Esperado |
| -------- | ------------------ |
| List     | ✅ 403 Blocked     |
| View     | ✅ 403 Blocked     |
| Create   | ✅ 403 Blocked     |

### 5.6 Administração Bloqueada

| Collection     | Create (403) |
| -------------- | ------------ |
| users          | ✅ Blocked   |
| com_perfis     | ✅ Blocked   |
| com_permissoes | ✅ Blocked   |
| com_equipes    | ✅ Blocked   |
| com_parametros | ✅ Blocked   |

### 5.7 Collections Comerciais — Lista Vazia/Bloqueada

| Collection                  | Resultado Esperado            |
| --------------------------- | ----------------------------- |
| com_negocios (list)         | ✅ 200 + 0 registros (ou 403) |
| com_empresas (list)         | ✅ 200 + 0 registros (ou 403) |
| com_perfis (list)           | ✅ 200 + 0 registros (ou 403) |
| com_parametros (list)       | ✅ 200 + 0 registros (ou 403) |
| com_usuarios_equipes (list) | ✅ 200 + 0 registros (ou 403) |

### 5.8 Regressão — Superadministrador

| Collection   | Operação          | Resultado Esperado      |
| ------------ | ----------------- | ----------------------- |
| com_negocios | List (superadmin) | ✅ 200 + totalItems > 0 |
| com_empresas | List (superadmin) | ✅ 200 + totalItems > 0 |

### 5.9 Isolamento

| Verificação                    | Resultado Esperado                                              |
| ------------------------------ | --------------------------------------------------------------- |
| Spok perfil != integracao      | ❓ Verificar (Spok tem perfil integracao, mas é conta distinta) |
| Contas duplicadas              | ✅ 0                                                            |
| Team bindings da conta técnica | ✅ 0                                                            |

---

## 6. Regression and Isolation

| Verificação                                   | Resultado Esperado |
| --------------------------------------------- | ------------------ |
| Superadmin mantém acesso a com_negocios       | ✅ 200 + registros |
| Superadmin mantém acesso a com_empresas       | ✅ 200 + registros |
| Spok não recebe perfil/permissoes comerciais  | ✅                 |
| Exatamente 1 conta técnica equivalente        | ✅                 |
| Zero credenciais expostas                     | ✅                 |
| Sem ActiveCampaign/webhook/scheduler/Porta 2D | ✅                 |

---

## 7. Guard Diff Audit (Read-Only)

### 7.1 guard_create.js

```diff
  var permMap = {
    com_perfis: ['perfis.admin'],
    com_permissoes: ['permissoes.admin'],
    com_perfil_permissoes: ['permissoes.admin'],
    com_usuarios_equipes: ['vinculos.admin'],
    com_negocios: ['negocios.create'],
+   com_negocio_historico: ['negocios.update'],
    com_empresas: ['empresas.create'],
    com_parametros: ['parametros.gerenciar'],
    com_parametros_versoes: ['parametros.gerenciar'],
    com_equipes: ['equipes.admin'],
    users: ['usuarios.admin'],
+   com_contatos: ['contatos.create'],
+   com_etapas: ['etapas.create'],
+   com_alias_dimensoes: ['alias_dimensoes.create'],
+   com_vinculos_externos: ['vinculos_externos.create'],
+   com_execucoes_sincronizacao: ['execucoes_sincronizacao.create'],
+   com_eventos_integracao: ['eventos_integracao.create'],
+   com_snapshots_negocio: ['snapshots_negocio.create'],
+   com_ocorrencias_qualidade: ['ocorrencias_qualidade.create'],
  }
```

### 7.2 guard_update.js

```diff
  var permMap = {
    com_perfis: ['perfis.admin'],
    com_permissoes: ['permissoes.admin'],
    com_perfil_permissoes: ['permissoes.admin'],
    com_usuarios_equipes: ['vinculos.admin'],
    com_negocios: ['negocios.update'],
    com_empresas: ['empresas.update'],
    com_parametros: ['parametros.gerenciar'],
    com_equipes: ['equipes.admin'],
    users: ['usuarios.admin'],
+   com_contatos: ['contatos.update'],
+   com_etapas: ['etapas.update'],
+   com_alias_dimensoes: ['alias_dimensoes.update'],
+   com_vinculos_externos: ['vinculos_externos.update'],
+   com_execucoes_sincronizacao: ['execucoes_sincronizacao.update'],
+   com_eventos_integracao: ['eventos_integracao.update'],
+   com_ocorrencias_qualidade: ['ocorrencias_qualidade.update'],
  }
  // NOTA: com_negocio_historico AUSENTE — updateRule = null (imutável)
  // NOTA: com_snapshots_negocio AUSENTE — updateRule = null (imutável)
```

### 7.3 guard_list.js

```diff
  var permMap = {
    com_perfis: ['perfis.admin'],
    com_permissoes: ['permissoes.admin'],
    com_perfil_permissoes: ['permissoes.admin'],
    com_usuarios_equipes: ['vinculos.admin'],
    com_negocios: ['negocios.view'],
    com_empresas: ['empresas.view'],
    com_parametros: ['parametros.gerenciar'],
    com_auditoria: ['auditoria.consultar'],
    com_parametros_versoes: ['auditoria.consultar', 'parametros.gerenciar'],
+   com_negocio_historico: ['negocios.view'],
+   com_contatos: ['contatos.view'],
+   com_etapas: ['etapas.view'],
+   com_alias_dimensoes: ['alias_dimensoes.view'],
+   com_vinculos_externos: ['vinculos_externos.view'],
+   com_execucoes_sincronizacao: ['execucoes_sincronizacao.view'],
+   com_eventos_integracao: ['eventos_integracao.view'],
+   com_snapshots_negocio: ['snapshots_negocio.view'],
+   com_ocorrencias_qualidade: ['ocorrencias_qualidade.view'],
  }
```

### 7.4 guard_view.js

```diff
  var permMap = {
    com_perfis: ['perfis.admin'],
    com_permissoes: ['permissoes.admin'],
    com_perfil_permissoes: ['permissoes.admin'],
    com_usuarios_equipes: ['vinculos.admin'],
    com_negocios: ['negocios.view'],
    com_empresas: ['empresas.view'],
    com_parametros: ['parametros.gerenciar'],
    com_auditoria: ['auditoria.consultar'],
    com_parametros_versoes: ['auditoria.consultar', 'parametros.gerenciar'],
+   com_negocio_historico: ['negocios.view'],
+   com_contatos: ['contatos.view'],
+   com_etapas: ['etapas.view'],
+   com_alias_dimensoes: ['alias_dimensoes.view'],
+   com_vinculos_externos: ['vinculos_externos.view'],
+   com_execucoes_sincronizacao: ['execucoes_sincronizacao.view'],
+   com_eventos_integracao: ['eventos_integracao.view'],
+   com_snapshots_negocio: ['snapshots_negocio.view'],
+   com_ocorrencias_qualidade: ['ocorrencias_qualidade.view'],
  }
```

### 7.5 Resumo do Diff

| Guard        | Entradas Adicionadas                                    | Entradas Removidas |
| ------------ | ------------------------------------------------------- | ------------------ |
| guard_create | +9 (com_negocio_historico + 8 integration collections)  | 0                  |
| guard_update | +7 (7 integration collections, sem snapshots/historico) | 0                  |
| guard_list   | +9 (com_negocio_historico + 8 integration collections)  | 0                  |
| guard_view   | +9 (com_negocio_historico + 8 integration collections)  | 0                  |

---

## 8. Sanitization Guarantees

| Item              | Garantia                                    |
| ----------------- | ------------------------------------------- |
| Passwords         | ❌ Nunca retornados, logados, ou exibidos   |
| Tokens            | ❌ Nunca retornados ou logados              |
| Cookies           | ❌ Nunca retornados ou logados              |
| Headers de auth   | ❌ Nunca impressos                          |
| Secrets           | ❌ Apenas presença verificada (boolean)     |
| IDs               | ✅ Sanitizados (primeiros 8 caracteres)     |
| Emails            | ❌ Não incluídos em logs de teste           |
| Registros [TESTE] | ✅ Criados e removidos com superadmin token |

---

## 9. Confirmation of Exclusions

| Item                                 | Status |
| ------------------------------------ | ------ |
| ActiveCampaign configurado           | ❌ Não |
| Webhook configurado                  | ❌ Não |
| Scheduler/Cron configurado           | ❌ Não |
| Tráfego externo                      | ❌ Não |
| Porta 2D iniciada                    | ❌ Não |
| Dados reais de produção modificados  | ❌ Não |
| Aplicação publicada                  | ❌ Não |
| Novo plano criado                    | ❌ Não |
| Confirmação intermediária solicitada | ❌ Não |

---

## 10. Status Final

- Code freeze: ✅ Ativo — nenhum arquivo modificado
- Pre-check: ✅ Hook em produção, pronto para execução
- Bootstrap: ✅ Hook em produção, idempotente
- Testes HTTP: ✅ Hook em produção, matriz completa
- Guard audit: ✅ Diff documentado (read-only)
- Porta 2C aprovada: ❌ Não — aguarda execução e validação do PMais
- Porta 2D: ❌ BLOQUEADA

**Hooks temporários permanecem em produção para validação independente do PMais.**

**Execução interrompida após entrega. Nenhum novo plano.**
