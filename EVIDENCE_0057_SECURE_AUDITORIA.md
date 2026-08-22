# Migration 0057 — Secure Auditoria Server-Side

## Migration: `0057_secure_auditoria_server_side.js`

### Persisted rules read-back (com_auditoria)

After applying migration 0057, the five persisted rules are:

```
listRule:   @request.auth.id != ''
viewRule:   @request.auth.id != ''
createRule: null
updateRule: null
deleteRule: null
```

- `listRule` and `viewRule` preserved exactly as before.
- `createRule`, `updateRule`, `deleteRule` set to `null` (superuser-only).
- No fields, indexes, or data altered.

## Server-side audit hooks

| Hook file             | Collection     | Trigger                                   | Audit action        |
| --------------------- | -------------- | ----------------------------------------- | ------------------- |
| `audit_empresas.js`   | com_empresas   | status → 'inativo'                        | inactivate          |
| `audit_equipes.js`    | com_equipes    | ativo toggled                             | inactivate / update |
| `audit_negocios.js`   | com_negocios   | inativo toggled                           | inactivate / update |
| `audit_parametros.js` | com_parametros | meaningful field changed or ativo toggled | update / inactivate |
| `audit_perfis.js`     | com_perfis     | ativo toggled                             | inactivate / update |

Each hook uses `onRecordUpdateRequest`:

1. Calls `e.next()` to let the main operation proceed (validation + save + after-success hooks).
2. After `e.next()` returns (save succeeded), checks if the audited field changed.
3. Creates exactly one `com_auditoria` record with `usuario_id` from `e.auth.id`.
4. Errors are caught and logged; no false audit record is produced.
5. No hook exists for `com_auditoria` → recursion is impossible.

## Client-side cleanup

- Removed `createAuditRecord` calls from all six frontend files.
- Removed `createAuditRecord` function from `src/services/foundation.ts`.
- Removed unused `createAuditRecord` imports.
- Non-parametros confirmation dialogs changed from `prompt` to `confirm` (justificativa no longer needed client-side; server generates the audit record).
- Parametros screens retain `prompt` for justificativa because it is stored on the record field and read by the server-side hook.

## Test plan

| #   | Test                                                                        | Expected      | Status                     |
| --- | --------------------------------------------------------------------------- | ------------- | -------------------------- |
| 1   | Direct POST to com_auditoria by authenticated common user                   | 403 Forbidden | BLOCKED — run after deploy |
| 2   | Direct POST to com_auditoria by superadmin                                  | 403 Forbidden | BLOCKED — run after deploy |
| 3   | [TESTE] Inactivate an empresa → exactly 1 audit record with acao=inactivate | 1 record      | BLOCKED — run after deploy |
| 4   | [TESTE] Toggle equipe ativo → exactly 1 audit record                        | 1 record      | BLOCKED — run after deploy |
| 5   | [TESTE] Inactivate a negocio → exactly 1 audit record with acao=inactivate  | 1 record      | BLOCKED — run after deploy |
| 6   | [TESTE] Activate a negocio → exactly 1 audit record with acao=update        | 1 record      | BLOCKED — run after deploy |
| 7   | [TESTE] Update a parametro valor → exactly 1 audit record with acao=update  | 1 record      | BLOCKED — run after deploy |
| 8   | [TESTE] Toggle parametro ativo → exactly 1 audit record                     | 1 record      | BLOCKED — run after deploy |
| 9   | [TESTE] Toggle perfil ativo → exactly 1 audit record                        | 1 record      | BLOCKED — run after deploy |
| 10  | Invalid main operation (e.g., missing required field) → no audit record     | 0 records     | BLOCKED — run after deploy |
| 11  | Direct PATCH/DELETE on com_auditoria records                                | 403 Forbidden | BLOCKED — run after deploy |

All tests are marked BLOCKED because no isolated test environment is available. Implementation is complete; tests should be executed after deployment.

## Rollback

### Rollback order (reverse of implementation):

1. **Restore client-side audit calls**: Re-add `createAuditRecord` function to `src/services/foundation.ts` and re-add calls in the six frontend files.
2. **Remove server-side hooks**: Delete `audit_empresas.js`, `audit_equipes.js`, `audit_negocios.js`, `audit_parametros.js`, `audit_perfis.js`.
3. **Revert migration 0057**: Run the `down` function, which restores `createRule = "@request.auth.id != ''"` on `com_auditoria`.

### Migration 0057 `down` restores:

```
createRule: @request.auth.id != ''
updateRule: null
deleteRule: null
```

Rollback test: BLOCKED — no isolated environment available.

## Guarantees

- Recursion prevented: no hook listens to `com_auditoria`.
- Exactly one audit event per completed operation.
- No audit record when the main operation fails (`e.next()` throws → audit code unreachable).
- No changes to snapshots, history, other collections, fields, indexes, accounts, credentials, or external integrations.
- Porta 2B: NOT declared approved.
- Porta 2C: NOT started.
