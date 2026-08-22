# Migration/Fix 0058 — Audit Hook Fix

## Literal Error Found

**Hook responsible:** `audit_empresas.js`

**Literal reason the hook did not fire/persist an audit record:**

The `audit_empresas` hook used `onRecordUpdateRequest` on collection `com_empresas`. After calling `e.next()`, it checked:

```javascript
var oldStatus = record.original().getString('status')
var newStatus = record.getString('status')

if (oldStatus === newStatus || newStatus !== 'inativo') {
  return
}
```

This early-return condition meant the hook would ONLY create an audit record when the `status` field changed to `'inativo'`. The real test PATCHed company `[TESTE]` (record_id `e4hu66x0xs6vg4i`) keeping the same name — the `status` field did not change to `'inativo'`, so the condition `oldStatus === newStatus || newStatus !== 'inativo'` evaluated to `true`, and the hook returned without ever reaching `$app.save(auditRec)`.

The same restrictive pattern (only auditing specific field changes) existed in all five audit hooks:

- `audit_empresas` — only when `status` → `'inativo'`
- `audit_equipes` — only when `ativo` toggled
- `audit_negocios` — only when `inativo` toggled
- `audit_parametros` — only when `ativo` or meaningful fields changed
- `audit_perfis` — only when `ativo` toggled

**Server-side write was NOT blocked by `createRule = null`:** `$app.save()` from hooks bypasses API rules entirely. API rules only apply to HTTP API requests. The audit record was never created because the hook's early-return condition prevented the code from reaching `$app.save()`.

## Collection and Event Confirmation

- **Audit collection:** `com_auditoria` (confirmed from live schema)
- **PocketBase event used by each hook:** `onRecordUpdateRequest` (request hook, fires on HTTP PATCH/PUT to the collection's API endpoint)
- **Continuation:** Each hook calls `e.next()` as its first statement, ensuring the main update operation (validation + save + after-success hooks) completes before the audit write is attempted. If the main operation fails, `e.next()` throws and the audit code is unreachable — no audit record is produced for failed operations.

## Server-Side Write Mechanism

`$app.save(auditRec)` is a server-side SDK call that bypasses API access rules (`createRule`, `updateRule`, `deleteRule`). These rules only gate HTTP API requests. The closed `createRule = null` on `com_auditoria` blocks direct HTTP POST but does NOT block `$app.save()` from within a hook.

## Recursion Prevention

No audit hook listens to `com_auditoria`. The five hooks are registered on `com_empresas`, `com_equipes`, `com_negocios`, `com_parametros`, and `com_perfis` respectively. When `$app.save(auditRec)` creates a record in `com_auditoria`, it triggers `onRecordCreate` for `com_auditoria`, but no hook is registered for that collection — recursion is impossible.

## Duplicate Prevention

Each hook uses `onRecordUpdateRequest` (request hook), which fires exactly once per HTTP PATCH request. Internal server-side updates (e.g., `parametro_version_history.js` calling `$app.saveNoValidate()`) trigger model hooks (`onRecordUpdate`) but NOT request hooks (`onRecordUpdateRequest`), so no duplicate audit record is produced.

## Literal Diff Summary

### All five hooks — same pattern change:

**BEFORE (example: audit_empresas.js):**

```javascript
onRecordUpdateRequest((e) => {
  e.next()
  var record = e.record
  var oldStatus = record.original().getString('status')
  var newStatus = record.getString('status')
  if (oldStatus === newStatus || newStatus !== 'inativo') {
    return // ← EARLY RETURN: no audit record for non-inativacao updates
  }
  // ... create audit record
}, 'com_empresas')
```

**AFTER:**

```javascript
onRecordUpdateRequest((e) => {
  e.next()
  const record = e.record
  const oldStatus = record.original().getString('status')
  const newStatus = record.getString('status')
  const oldName = record.original().getString('nome')
  const newName = record.getString('nome')

  let acao = 'update'
  let valorAnterior = oldName
  let valorNovo = newName

  if (oldStatus !== newStatus && newStatus === 'inativo') {
    acao = 'inactivate'
    valorAnterior = oldStatus
    valorNovo = newStatus
  }
  // ... ALWAYS create audit record (no early return)
  $app.save(auditRec)
}, 'com_empresas')
```

**Key changes in all five hooks:**

1. Removed the early-return condition that restricted audit records to specific field changes only.
2. Every successful update now produces exactly one audit record with `acao = 'update'` (or `acao = 'inactivate'` when deactivating).
3. `valor_anterior` and `valor_novo` now always carry a meaningful summary (record name/title/value, or old/new status for deactivations).
4. Error logging now includes `collection` and `record_id` fields for traceability (sanitized — no request bodies, no user data beyond IDs).

## Error Logging

All failures are logged via:

```javascript
$app
  .logger()
  .error(
    'audit_<collection> failed',
    'collection',
    '<name>',
    'record_id',
    record.id,
    'error',
    String(err),
  )
```

No sensitive content (passwords, tokens, request bodies) is logged. Exceptions are not silenced.

## Scope Guard

The following were NOT modified:

- Migration 0057
- Access rules (`createRule`, `updateRule`, `deleteRule`, `listRule`, `viewRule`) on any collection
- Frontend code
- Database schema
- Indexes
- Data
- Accounts / credentials
- Any other collection
- Any other hook (including `parametro_version_history.js`)

## Real HTTP Test Results

**BLOCKED — tests must be executed after deployment by PMais.**

| #   | Test                                                                        | Expected      | Status                     |
| --- | --------------------------------------------------------------------------- | ------------- | -------------------------- |
| 1   | Direct POST to com_auditoria by superadmin                                  | 403 Forbidden | BLOCKED — run after deploy |
| 2   | Direct POST to com_auditoria by common user                                 | 403 Forbidden | BLOCKED — run after deploy |
| 3   | PATCH on `[TESTE]` empresa (same name) → HTTP 200 + 1 audit record          | 1 record      | BLOCKED — run after deploy |
| 4   | PATCH on empresa changing status → 'inativo' → 1 audit with acao=inactivate | 1 record      | BLOCKED — run after deploy |
| 5   | PATCH on equipe → 1 audit record                                            | 1 record      | BLOCKED — run after deploy |
| 6   | PATCH on negocio → 1 audit record                                           | 1 record      | BLOCKED — run after deploy |
| 7   | PATCH on parametro → 1 audit record                                         | 1 record      | BLOCKED — run after deploy |
| 8   | PATCH on perfil → 1 audit record                                            | 1 record      | BLOCKED — run after deploy |
| 9   | Invalid PATCH (missing required field) → no audit record                    | 0 records     | BLOCKED — run after deploy |
| 10  | Audit record has correct collection_name, record_id, acao, usuario_id       | Correct       | BLOCKED — run after deploy |

All tests are marked BLOCKED because no isolated test environment is available. Implementation is complete; tests should be executed after deployment.

## Status

- Porta 2B: NOT declared approved.
- Porta 2C: NOT started.
- Stopping after delivery. Awaiting PMais validation.
