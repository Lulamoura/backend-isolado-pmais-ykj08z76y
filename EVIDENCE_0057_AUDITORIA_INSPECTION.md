# Relatório de Inspeção — Migration 0057 — Secure `com_auditoria` createRule

**Projeto:** Gestão Comercial PMais — Validação de Viabilidade (Fase 1)
**Data:** 10/08/2026
**Status:** `BLOCKED` — Escritas client-side detectadas. Nenhuma alteração aplicada. Aguardando decisão do PMais.

---

## 1. Inspeção Pré-Alteração — Regras Persistidas de `com_auditoria`

### 1.1 Fonte da Leitura

As regras abaixo foram lidas do `src/lib/pocketbase/schema.json` (estado persistido atual, refletindo o banco live após as migrations 0001–0056).

### 1.2 Regras Persistidas (Valores Literais)

| Regra        | Valor Persistido         |
| ------------ | ------------------------ |
| `listRule`   | `@request.auth.id != ''` |
| `viewRule`   | `@request.auth.id != ''` |
| `createRule` | `@request.auth.id != ''` |
| `updateRule` | `null`                   |
| `deleteRule` | `null`                   |

### 1.3 Origem Histórica do `createRule`

| Migration | Ação sobre `com_auditoria.createRule`             |
| --------- | ------------------------------------------------- |
| 0017      | Criou com `createRule = "@request.auth.id != ''"` |
| 0050      | Alterou para HC (perfis comerciais)               |
| 0051      | Restaurou para `"@request.auth.id != ''"` (G)     |
| 0052      | Manteve G (idempotente)                           |
| 0053      | Manteve G (idempotente)                           |
| 0054      | Manteve G (idempotente)                           |
| 0055      | Não alterou `com_auditoria`                       |
| 0056      | Não alterou `com_auditoria`                       |

**Estado atual confirmado:** `createRule = "@request.auth.id != ''"` (qualquer usuário autenticado pode criar registros de auditoria).

---

## 2. Busca no Codebase — Criação de Registros em `com_auditoria`

### 2.1 Método de Busca

Busca exaustiva por todas as referências a `com_auditoria` no codebase frontend (`src/`) e backend (`pocketbase/`), focando em operações de criação (`.create()`, `new Record`, `$app.save`).

### 2.2 Resultado — Escritas Client-Side (Frontend)

#### 2.2.1 `src/services/foundation.ts`

**Caminho:** `src/services/foundation.ts`
**Tipo:** Client-side (frontend, usa SDK PocketBase)

```typescript
export const createAuditRecord = (data: {
  collection_name: string
  record_id: string
  acao: string
  valor_anterior: string
  valor_novo: string
  justificativa: string
  origem_alteracao: string
}) =>
  pb.collection('com_auditoria').create({
    ...data,
    usuario_id: pb.authStore.record?.id,
  })
```

**Análise:** Esta função usa `pb.collection('com_auditoria').create(...)` diretamente do cliente. O `pb` é o SDK do PocketBase inicializado no frontend (`src/lib/pocketbase/client.ts`). Não há hook server-side intermediando esta escrita — a chamada vai diretamente para a API REST do PocketBase.

#### 2.2.2 Chamadores de `createAuditRecord`

| Arquivo                                       | Contexto da Chamada               |
| --------------------------------------------- | --------------------------------- |
| `src/components/foundation/EmpresasTab.tsx`   | Inativação de empresa             |
| `src/components/foundation/EquipesTab.tsx`    | Toggle ativo/inativo de equipe    |
| `src/components/foundation/NegociosTab.tsx`   | Inativação/ativação de negócio    |
| `src/components/foundation/ParametroForm.tsx` | Atualização de parâmetro          |
| `src/components/foundation/ParametrosTab.tsx` | Toggle ativo/inativo de parâmetro |
| `src/components/foundation/PerfisTab.tsx`     | Toggle ativo/inativo de perfil    |

**Exemplo literal (EmpresasTab.tsx, função `inactivate`):**

```typescript
const inactivate = async (r: RecordModel) => {
  const justificativa = prompt('Justificativa para inativação da empresa:')
  if (!justificativa) return
  await updateEmpresa(r.id, { status: 'inativo' })
  await createAuditRecord({
    collection_name: 'com_empresas',
    record_id: r.id,
    acao: 'inactivate',
    valor_anterior: r.status,
    valor_novo: 'inativo',
    justificativa,
    origem_alteracao: 'manual',
  })
}
```

### 2.3 Resultado — Escritas Server-Side (Hooks)

Busca em todos os hooks deployados (`pocketbase/hooks/*.js`):

| Hook                            | Cria registro em `com_auditoria`?            |
| ------------------------------- | -------------------------------------------- |
| `guard_create.js`               | ❌ Não                                       |
| `guard_list.js`                 | ❌ Não                                       |
| `guard_view.js`                 | ❌ Não                                       |
| `guard_update.js`               | ❌ Não                                       |
| `block_empresa_delete.js`       | ❌ Não                                       |
| `block_negocio_delete.js`       | ❌ Não                                       |
| `change_negocio_responsavel.js` | ❌ Não                                       |
| `parametro_version_history.js`  | ❌ Não (escreve em `com_parametros_versoes`) |
| `auth_with_password.js`         | ❌ Não                                       |
| `run_positive_tests.js`         | ❌ Não                                       |
| Todos os demais hooks           | ❌ Não                                       |

**Nenhum hook cria registros em `com_auditoria`.**

### 2.4 Verificação — `guard_create.js` e `com_auditoria`

O hook `guard_create.js` possui um `permMap` que mapeia collections a permissões exigidas para criação. `com_auditoria` **NÃO está listada** neste mapa:

```javascript
var permMap = {
  com_perfis: ['perfis.admin'],
  com_permissoes: ['permissoes.admin'],
  // ... outras collections ...
  com_ocorrencias_qualidade: ['ocorrencias_qualidade.create'],
  // com_auditoria NÃO está presente
}
```

**Consequência:** Qualquer usuário autenticado pode criar registros em `com_auditoria` sem nenhuma verificação de permissão adicional além do `createRule` nativo (`@request.auth.id != ''`).

### 2.5 Conclusão da Busca

| Tipo de Escrita        | Existe? | Localização                                 |
| ---------------------- | ------- | ------------------------------------------- |
| Server-side (hooks)    | ❌ Não  | —                                           |
| Client-side (frontend) | ✅ Sim  | `src/services/foundation.ts` + 6 chamadores |

**Todas as escritas legítimas em `com_auditoria` são client-side.**

---

## 3. Decisão — `BLOCKED`

### 3.1 Critério Aplicado

> "Only if all legitimate writes are server-side, a new additive migration `0057_secure_auditoria_create_rule.js` must be created defining for `com_auditoria`:
>
> - `createRule`: `null`"

> "If there is any legitimate client-side creation of `com_auditoria` records, the developer must NOT use `@request.auth.id != ''` and must NOT apply any alternative rule; instead, present the specific permission required and stop for a PMais decision."

### 3.2 Resultado

A condição "all legitimate writes are server-side" **NÃO é satisfeita**. Existem 6 componentes frontend que criam registros de auditoria diretamente via SDK client-side.

### 3.3 Status

```
BLOCKED — Escritas client-side detectadas.
Migration 0057 NÃO criada.
Nenhuma alteração aplicada ao banco ou ao codebase.
Aguardando decisão do PMais.
```

---

## 4. Permissão Específica Requerida (para decisão do PMais)

### 4.1 Análise

Para restringir `createRule` de `com_auditoria` sem quebrar as escritas legítimas, seria necessário:

1. **Mover as escritas de auditoria para server-side** (hooks `onRecordAfterUpdateSuccess` / `onRecordAfterDeleteSuccess`), de modo que o `createRule` possa ser `null` (apenas superuser / código server-side).
2. **OU** manter as escritas client-side mas exigir uma permissão específica via `guard_create.js` e um `createRule` baseado em perfil (não genérico).

### 4.2 Permissão Recomendada

A permissão já existente no sistema que mais se alinha com a criação de auditoria é:

| Permissão             | Slug                  | Perfis que a possuem                                       |
| --------------------- | --------------------- | ---------------------------------------------------------- |
| `auditoria.consultar` | `auditoria.consultar` | superadmin, gestor-comercial, aprovador, leitura-executiva |

No entanto, `auditoria.consultar` é uma permissão de **leitura**, não de **escrita**. Os perfis que atualmente criam auditoria via frontend são: superadmin, gestor-comercial, operador-comercial, prospeccao (baseado nos componentes que chamam `createAuditRecord`).

### 4.3 Opções para o PMais

| Opção | Descrição                                                                                                                                                                                        | Prós                                                        | Contras                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------- |
| **A** | Mover todas as escritas de `createAuditRecord` para hooks server-side (`onRecordAfterUpdateSuccess`), então setar `createRule = null`                                                            | Máxima segurança — apenas código server-side cria auditoria | Refatoração significativa; mudança de arquitetura               |
| **B** | Criar nova permissão `auditoria.create`, adicionar `com_auditoria` ao `permMap` do `guard_create.js`, e setar `createRule` para uma regra baseada em perfil que inclua apenas perfis autorizados | Menor mudança de código                                     | `createRule` não pode ser `null`; regra baseada em perfil       |
| **C** | Adicionar `com_auditoria` ao `permMap` do `guard_create.js` exigindo `auditoria.consultar`, manter `createRule = "@request.auth.id != ''"`                                                       | Mínima mudança                                              | `createRule` permanece aberto; segurança depende apenas do hook |

### 4.4 Recomendação

**Opção A** é a recomendada para máxima segurança, mas está fora do escopo desta migration. A Opção B é viável como passo intermediário. A decisão final cabe ao PMais.

---

## 5. Regras Persistidas — Estado Final (Sem Alteração)

| Regra        | Antes (atual)            | Esperado (se server-side) | Aplicado                              | Divergência               |
| ------------ | ------------------------ | ------------------------- | ------------------------------------- | ------------------------- |
| `listRule`   | `@request.auth.id != ''` | `@request.auth.id != ''`  | `@request.auth.id != ''` (inalterado) | ❌ Nenhuma                |
| `viewRule`   | `@request.auth.id != ''` | `@request.auth.id != ''`  | `@request.auth.id != ''` (inalterado) | ❌ Nenhuma                |
| `createRule` | `@request.auth.id != ''` | `null`                    | `@request.auth.id != ''` (inalterado) | ⚠️ Não alterado — BLOCKED |
| `updateRule` | `null`                   | `null`                    | `null` (inalterado)                   | ❌ Nenhuma                |
| `deleteRule` | `null`                   | `null`                    | `null` (inalterado)                   | ❌ Nenhuma                |

---

## 6. Confirmação de Exclusões

| Item                                | Status                     |
| ----------------------------------- | -------------------------- |
| Migration 0057 criada               | ❌ Não — BLOCKED           |
| Migration 0017 editada              | ❌ Não                     |
| Migrations 0050–0056 editadas       | ❌ Não                     |
| `com_auditoria.createRule` alterado | ❌ Não                     |
| Hooks alterados                     | ❌ Não                     |
| Campos alterados                    | ❌ Não                     |
| Índices alterados                   | ❌ Não                     |
| Dados modificados                   | ❌ Não                     |
| Seeds alterados                     | ❌ Não                     |
| Contas criadas                      | ❌ Não                     |
| Credenciais criadas                 | ❌ Não                     |
| Secrets criados                     | ❌ Não                     |
| Outras collections alteradas        | ❌ Não                     |
| Serviços externos alterados         | ❌ Não                     |
| Rollback executado                  | ❌ Não — nada foi aplicado |
| Porta 2B declarada aprovada         | ❌ Não                     |
| Porta 2C iniciada                   | ❌ Não                     |

---

## 7. Testes HTTP

Nenhum teste HTTP foi executado, pois nenhuma alteração foi aplicada. O estado atual permanece inalterado.

---

## 8. Rollback

Não aplicável — nenhuma migration foi criada ou aplicada.

---

## 9. Status Final

- Inspeção pré-alteração executada: ✅ Concluída
- Regras persistidas lidas e apresentadas: ✅ 5 regras literais
- Busca no codebase executada: ✅ Exaustiva
- Escritas server-side encontradas: ❌ Nenhuma
- Escritas client-side encontradas: ✅ `src/services/foundation.ts` + 6 chamadores
- Condição "all writes server-side": ❌ NÃO satisfeita
- Migration 0057 criada: ❌ Não — BLOCKED
- Permissão específica apresentada: ✅ `auditoria.consultar` (leitura) / recomendação de `auditoria.create` (nova)
- Nenhuma alteração aplicada: ✅ Confirmado
- Porta 2B declarada aprovada: ❌ Não
- Porta 2C iniciada: ❌ Não

**Execução interrompida. Aguardando decisão do PMais sobre como proceder com as escritas client-side de auditoria.**
