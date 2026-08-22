# Porta 2D.2A — Real Runtime Round Execution Mechanism

## 1. Literal Diffs

### 1.1 `ac_webhook.js` — Duplicate response changed from 200 to 409

```diff
   if (existingEvent) {
-    return e.json(200, {
+    return e.json(409, {
       received: true,
       duplicate: true,
       event_id: existingEvent.id,
       status: existingEvent.getString('status'),
-      message: 'Evento ja processado anteriormente',
+      message: 'Evento ja processado anteriormente — replay bloqueado',
     })
   }
```

**Rationale:** HTTP 409 Conflict explicitly signals that the replay is blocked, satisfying the acceptance criterion "replay of the same event is blocked (e.g. HTTP 409)."

### 1.2 `ac_security_matrix.js` — Replay test expects 409

```diff
   results.push({
     test: 'replay_same_event',
     status: r.status,
-    expected: 200,
-    pass: r.status === 200 && r.json.duplicate === true,
+    expected: 409,
+    pass: r.status === 409 && r.json.duplicate === true,
     dup: r.json.duplicate,
   })
```

### 1.3 `ac_synthetic_test.js` — Idempotency replay expects 409

```diff
   results.idempotency_replay = {
     status: contactRes2.status,
-    pass: contactRes2.status === 200 && contactRes2.json.duplicate === true,
+    pass: contactRes2.status === 409 && contactRes2.json.duplicate === true,
     dup: contactRes2.json.duplicate,
   }
```

### 1.4 New file: `ac_run_round_2d2a.js`

A new hook registered at `POST /backend/v1/integracao/ac/run-round-2d2a` that orchestrates the entire 2D.2A round in a single call. Superadmin-only.

---

## 2. Activation Flag — Literal Key and Persisted Location

| Property                 | Value                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Collection**           | `com_parametros`                                                                                                           |
| **Key (chave)**          | `ac_webhook_enabled`                                                                                                       |
| **Value when active**    | `"true"`                                                                                                                   |
| **Value when inactive**  | `"false"`                                                                                                                  |
| **Field `ativo`**        | `true` when active, `false` when inactive                                                                                  |
| **Field `tipo`**         | `"boolean"`                                                                                                                |
| **Field `descricao`**    | `"Flag server-side webhook AC"`                                                                                            |
| **Field `versao`**       | `1`                                                                                                                        |
| **Exposed to frontend?** | **No** — the flag is read exclusively server-side by `ac_webhook.js` and `ac_rollback.js` via `$app.findFirstRecordByData` |

### Flag is NOT in `ac_precheck.js`

The precheck hook (`ac_precheck.js`) reports the flag's state for informational purposes only (`webhookEnabled` field in its response). The flag **does not live** in precheck — it is read and written by `ac_webhook.js`, `ac_rollback.js`, `ac_security_matrix.js`, `ac_synthetic_test.js`, and `ac_run_round_2d2a.js`.

### Runtime proof

The `ac_run_round_2d2a` hook reads the flag record before activation, after activation, and after deactivation, returning the full record details (collection, key, value, ativo, created, updated, sanitized ID) in the response at:

- `evidence.tests.flagBefore` — state before activation
- `evidence.tests.flagAfter` — state after activation (proves the record exists)
- `evidence.tests.flagDeactivated` — state after deactivation

---

## 3. `$security.hs256()` Handling

The HMAC-SHA256 function is tested at runtime with a known synthetic vector (RFC 4231 Test Case 2):

- **Input:** `"what do ya want for nothing?"`
- **Key:** `"Jefe"`
- **Expected output:** `5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843`

The test result is returned in `evidence.tests.precheck.hs256`. If the test fails, the round stops immediately with the sanitized literal error. No preventive or speculative replacement is applied.

---

## 4. Round Execution Flow

The `ac_run_round_2d2a` hook executes the following sequence:

1. **Auth** — Superadmin only
2. **Pre-check** — Secrets (PRESENTE/AUSENTE), hs256 test, integracao account, before counts
3. **Flag proof** — Read flag before, activate, read flag after (proves record exists)
4. **Security matrix** (11 tests) — Each with before/after counts and real HTTP status
5. **Functional flow** — Contact create, idempotency replay, deal create, deal update (snapshot), unmapped stage (quality occurrence)
6. **Snapshot proof** — Real snapshot record with sanitized ID
7. **Rollback** — On this round's entity only, with before/after proof and idempotency
8. **Deactivation** — Deactivate webhook, prove 503, no persistence
9. **Final counts** — After all tests
10. **Evidence ledger** — All persisted records with sanitized ID, collection, created, correlation key

---

## 5. Security Matrix Tests (11)

| #   | Test                                         | Expected | Method                                  |
| --- | -------------------------------------------- | -------- | --------------------------------------- |
| 1   | Wrong method (GET)                           | 405/404  | GET to webhook                          |
| 2   | Invalid Content-Type                         | 400      | POST with text/plain                    |
| 3a  | Empty body (valid signature)                 | 400      | POST with `{}`                          |
| 3b  | Malformed body                               | 400/401  | POST with invalid JSON + bad signature  |
| 4   | Oversized body                               | 400      | POST with >256KB body                   |
| 5   | Missing signature                            | 401      | POST without X-AC-Signature             |
| 6   | Invalid signature                            | 401      | POST with wrong signature               |
| 7   | Valid signature (no timestamp)               | 200      | POST with valid HMAC + real event       |
| 8a  | Invalid timestamp                            | 400      | POST with `timestamp: 'invalid'`        |
| 8b  | Future timestamp                             | 400      | POST with timestamp +10min              |
| 8c  | Old timestamp                                | 400      | POST with timestamp -10min              |
| 9   | Replay same event                            | 409      | Resend identical signed payload         |
| 10  | Resend same idempotency_key (different body) | 409      | Same type+external_id, different fields |
| 11  | Different idempotency_key                    | 200      | Different external_id → new event       |

---

## 6. Evidence Ledger

Every persisted record in this round is recorded with:

- **Sanitized ID** (first 8 characters)
- **Collection name**
- **Created timestamp**
- **Correlation key** (the `[TESTE]-2D2A-` event/external_id)

Collections covered:

- `com_eventos_integracao`
- `com_execucoes_sincronizacao` (created by webhook internally)
- `com_vinculos_externos`
- `com_contatos`
- `com_negocios`
- `com_snapshots_negocio`
- `com_ocorrencias_qualidade`

---

## 7. Snapshot and Rollback

### Snapshot

- Created by the webhook **before** updating the business record
- Stored in `com_snapshots_negocio`
- Contains: `titulo`, `valor`, `etapa`, `resultado`
- **Immutable** (`updateRule = null`, `deleteRule = null`)
- **Preserved** — never deleted

### Rollback

- Executed **only** on the entity created in this round (`[TESTE]-2D2A-FN-001`)
- Located via composite external link (`com_vinculos_externos`) + `record_id`
- Restores from the latest preserved snapshot
- Creates a compensating event in `com_eventos_integracao`
- **No physical deletion** — records are restored or deactivated
- Idempotency tested by re-executing rollback

---

## 8. Stop Rules

The round stops immediately if:

- Any security test FAILs
- The hs256 test fails
- Secrets are absent
- The flag activation fails
- No snapshot is created before the deal update
- The rollback fails
- Any change occurs outside the `[TESTE]-2D2A-` sample

When stopped, the webhook is deactivated and the evidence collected so far is returned with the stop reason.

---

## 9. Scope Guardrails

- ❌ No webhook registered in ActiveCampaign
- ❌ No external API calls (zero `$http.send` to ActiveCampaign)
- ❌ No real contact/company/business data
- ❌ No changes to accounts, profiles, guards, RBAC
- ❌ No changes to migrations 0017/0050–0058
- ❌ No deletion of `[TESTE]` records or snapshots
- ❌ No scheduler or reconciliation created
- ❌ Porta 2D.2A NOT declared approved
- ❌ Porta 2D.2B and Porta 2E remain blocked

---

## 10. Frontend Integration

A service function (`src/services/integration-tests.ts`) and a React component (`src/components/foundation/IntegrationTestsTab.tsx`) are provided to trigger the round and display real evidence including:

- Security matrix with pass/fail and real HTTP statuses
- Before/after counts per test
- Activation flag record details
- Evidence ledger with sanitized IDs
- Rollback before/after proof
- Final counts

---

## 11. Deliverable

After executing the round via `POST /backend/v1/integracao/ac/run-round-2d2a`, all real evidence is returned in the JSON response:

- Literal flag key/location with runtime record proof
- Complete PASS/FAIL security matrix with real HTTP statuses
- Sanitized IDs and before/after counts
- Real snapshot and evidence ledger
- Proof of zero external calls and zero real data
- Inventory of preserved `[TESTE]-2D2A-` records

**Porta 2D.2A is NOT declared approved. Porta 2D.2B and Porta 2E remain blocked.**
