const fs = require('fs')
const path = require('path')

const hook = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase', 'hooks', 'ac_runtime_controls.js'),
  'utf8',
)

const required = [
  "'/backend/v1/integracao/ac/configuracao/go-live'",
  "action === 'open'",
  "action === 'close'",
  "'LIBERAR OPERACAO COMERCIAL PMAIS'",
  "'BLOQUEAR OPERACAO COMERCIAL PMAIS'",
  "commandKey.indexOf('commercial-go-live-')",
  "'ac_preoperation_read_only'",
  "readOnly.set('valor', operationEnabled ? 'false' : 'true')",
  "'commercial_go_live_open'",
  "'commercial_go_live_close'",
  "'com_eventos_integracao'",
  "'GATE_SINTETICO_ATIVO'",
  "'GO_LIVE_REVERTIDO'",
]

for (const marker of required) {
  if (!hook.includes(marker)) throw new Error(`go-live contract marker missing: ${marker}`)
}

if (
  /webhook\.set\(|reconciliation\.set\(|cursor\.set\(/.test(
    hook.slice(
      hook.indexOf("'/backend/v1/integracao/ac/configuracao/go-live'"),
      hook.indexOf('// Gate operacional'),
    ),
  )
) {
  throw new Error('go-live route must preserve webhook, reconciliation and cursor controls')
}

console.log('commercial go-live contract: ok')
