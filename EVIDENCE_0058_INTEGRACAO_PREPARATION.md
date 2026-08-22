# Migration 0058 — Integração Profile & Bootstrap Preparation

## Secret Name

**`COMERCIAL_INTEGRACAO_PASSWORD`**

This is the exact secret name that PMais must register in the Skip Cloud vault before the bootstrap mechanism can execute. No other credential source is accepted.

## Migration 0058: `0058_integracao_profile_permissions.js`

### Purpose

Align the `integracao` profile in `com_perfis` with a least-privilege permission matrix. Idempotent — safe to re-run.

### Profile

- Slug: `integracao`
- Nome: `Integração`
- Ativo: `true`
- No user account created. No password set.

### Expected Permission Matrix (15 slugs)

| Collection                  | list/view | create | update | delete |
| --------------------------- | --------- | ------ | ------ | ------ |
| com_contatos                | ✅        | ✅     | ❌     | ❌     |
| com_etapas                  | ✅        | ✅     | ❌     | ❌     |
| com_alias_dimensoes         | ✅        | ✅     | ❌     | ❌     |
| com_vinculos_externos       | ✅        | ✅     | ❌     | ❌     |
| com_execucoes_sincronizacao | ✅        | ✅     | ❌     | ❌     |
| com_eventos_integracao      | ✅        | ✅     | ❌     | ❌     |
| com_snapshots_negocio       | ✅        | ❌     | ❌     | ❌     |
| com_ocorrencias_qualidade   | ✅        | ✅     | ❌     | ❌     |

### Permissions Removed from `integracao` (exceeding scope)

- `snapshots_negocio.create` (was added by migration 0048)
- `empresas.view` (was added by migration 0026)
- `negocios.view` (was added by migration 0026)
- Any `.update` permissions if present

### Blocked Operations (enforced by collection rules + guard hooks)

- All update/delete on integration collections
- Create/update/delete on `com_snapshots_negocio`
- Any create/update/delete on `com_negocios`
- Any create/update/delete on `com_auditoria`
- Any access to `com_negocio_historico`
- Administration of users, profiles, permissions, teams, parameters, credentials

## Server-Side Hooks (temporary — remove after validation)

### 1. Pre-check: `GET /backend/v1/integracao/precheck`

- **Access:** Superadmin only
- **Returns:** Current permission matrix, exceeding permissions removed, missing permissions, prior account existence check, Spok user info, secret registration status
- **Action:** Actively removes exceeding permissions and reports before/after

### 2. Bootstrap: `POST /backend/v1/integracao/bootstrap`

- **Access:** Superadmin only (rejects regular users, Spok, and the technical account itself)
- **Secret:** Reads `COMERCIAL_INTEGRACAO_PASSWORD`
- **If secret absent:** Returns `BLOCKED: SECRET AUSENTE` — no account created or altered
- **If secret present:** Creates or aligns the account `Integração Comercial PMais`
  - Sets `perfil_id` to `integracao` profile
  - Clears `com_usuarios_equipes` links (no equipe, no additional profile)
  - Sets `ativo_comercial = true`
  - Sets password from secret
  - Idempotent — locates by email `integracao.comercial@pmaisservicos.com.br`
- **No password, token, or secret is returned in the response**

### 3. Post-secret tests: `POST /backend/v1/integracao/tests`

- **Access:** Superadmin only
- **Prerequisite:** Secret registered + bootstrap executed
- **Tests:** Real HTTP authentication + one test per permitted and blocked operation
- **Cleanup:** Created [TESTE] records are deleted using superadmin token
- **Spok check:** Confirms Spok user remains distinct with its current profile

## Credential Safety Guarantees

- No password generated, created, registered, returned, printed, encoded, hashed, or logged in migrations, hooks, logs, or evidence
- The only credential source is `COMERCIAL_INTEGRACAO_PASSWORD`
- Bootstrap aborts if secret is absent or empty
- No password, token, cookie, header, or secret appears in any output
- The credential value will be generated and saved by PMais in the vault "Spok dados de registro"

## Stopping Point

This stage delivers:

1. ✅ Migration 0058 (profile + permission matrix)
2. ✅ Bootstrap mechanism (hook route, not yet executed)
3. ✅ Pre-check route
4. ✅ Test route (to run after bootstrap)
5. ✅ Exact secret name: `COMERCIAL_INTEGRACAO_PASSWORD`

**STOP: Awaiting PMais confirmation that the secret has been registered.**

After confirmation:

1. Run `GET /backend/v1/integracao/precheck` to verify matrix
2. Run `POST /backend/v1/integracao/bootstrap` to create/align account
3. Run `POST /backend/v1/integracao/tests` to validate
4. Remove all three hook files after validation

## Out of Scope

- No ActiveDirectory configuration
- No webhook, event endpoint, scheduler, synchronization, or external traffic
- No real data loading
- Porta 2D remains blocked
