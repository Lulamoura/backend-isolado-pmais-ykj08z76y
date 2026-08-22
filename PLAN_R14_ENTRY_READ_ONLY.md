# Plano R14 — Entrada em Modo Somente Leitura

## Correção Documental — Divergência do `original_audit_lock`

### Data da correção

2026-08-12

### Motivo da correção

O plano R14 originalmente referenciava o valor `original_audit_lock: "armed"` (proveniente do JSON de resposta da rota v8 — `ac_diag_compensacao_dependencias`) como se fosse um fato confirmado lido da base de dados. A verificação manual independente demonstrou que esse valor é um fallback hardcoded e não um dado real.

### Análise da origem — `original_audit_lock`

**Classificação: constante/hardcoded (fallback em bloco `catch`).**

No handler `ac_diag_compensacao_dependencias.js`, a variável `origAuditLockState` é obtida pela função `readLockState`:

```javascript
var ORIG_AUDIT_LOCK_KEY = 'ac_diag_compensacao_auditoria_lock'
```

```javascript
function readLockState(key) {
  try {
    var rec = $app.findFirstRecordByData('com_parametros', 'chave', key)
    var val = rec.getString('valor')
    if (val && val !== 'armed') return 'consumed'
    return 'armed'
  } catch (_) {
    return 'armed'
  }
}
```

```javascript
var origAuditLockState = readLockState(ORIG_AUDIT_LOCK_KEY)
```

Quando o registro com `chave = 'ac_diag_compensacao_auditoria_lock'` **não existe** em `com_parametros`, `$app.findFirstRecordByData` lança uma exceção e o bloco `catch` retorna a string literal `'armed'`. O valor exibido no JSON da v8 **não foi lido da base de dados**.

### Evidência manual verificada

- `ac_diag_compensacao_dependencias_lock`: um registro, valor `consumed`;
- `ac_diag_consulta_dependencias_lock`: um registro, valor `consumed`;
- Busca exata por `ac_diag_compensacao_auditoria_lock` em `com_parametros`: **zero registros**;
- Busca ampla por `auditoria` em `com_parametros`: **zero registros**.

### Fatos registrados (correção padronizada)

1. **`ac_diag_compensacao_auditoria_lock`**: não encontrado na verificação manual atual — o registro não existe em `com_parametros`.
2. **O valor `armed` do JSON v8**: divergente/não confirmado — trata-se de um fallback hardcoded no bloco `catch` de `readLockState`, não de um valor lido da base.
3. **Nenhuma alteração de base de dados** pode ser feita para "corrigir" a ausência do lock — o escopo autorizado é estritamente documental.
4. **A compensação v8 permanece validada e não reproduzível**, porque seu próprio lock (`ac_diag_compensacao_dependencias_lock`) está `consumed`.
5. **R14 permanece inconclusivo**, com PARE aplicado (Pausar, Analisar, Refletir, Engajar).
6. **Auditoria de contato e complementar** permanecem não verificadas nesta sequência.
7. **2D.2B e Porta 2E** permanecem bloqueadas.

### Classificação do lock ausente

O lock `ac_diag_compensacao_auditoria_lock` é classificado como **artefato documental não comprovado**. Não há evidência em código ou documentação de que ele tenha sido formalmente criado ou designado como requisito. **Não é uma falha de base de dados** e **não deve ser adicionado como requisito R14**.

### Guardrails do escopo R14

- Somente inspeção estática de código/relatórios (sem execução).
- Nenhuma rota, query ou teste deve ser executado.
- Nenhum registro pode ser criado, alterado ou excluído.
- Nenhum lock pode ser modificado.
- Nenhum hook, frontend, backend, schema, migração ou configuração pode ser alterado.
- Nenhuma chamada para ActiveCampaign ou serviço externo.
- Nenhuma credencial, token, chave, segredo ou senha pode ser revelada.

### Declaração de fechamento

```json
{
  "analysis_only": true,
  "routes_executed": 0,
  "queries_executed": 0,
  "records_created": 0,
  "records_updated": 0,
  "records_deleted": 0,
  "locks_modified": 0,
  "code_files_modified": 0,
  "activecampaign_calls": 0,
  "r14_status": "paused_inconclusive",
  "porta_2d2b_started": false,
  "porta_2e_started": false
}
```

### Status

- R14: pausado, inconclusivo. Aguardando nova autorização explícita.
- O lock `ac_diag_compensacao_auditoria_lock` **não deve ser proposto para criação**.
- As queries **não devem ser retomadas** sem nova autorização.
