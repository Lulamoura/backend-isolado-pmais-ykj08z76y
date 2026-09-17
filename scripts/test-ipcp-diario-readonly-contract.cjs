const fs = require('node:fs')
const path = require('node:path')

const hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_ipcp_diario.js')
const source = fs.readFileSync(hookPath, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

assert(
  source.includes("routerAdd('GET', '/backend/v1/ipcp/diario'"),
  'deve registrar GET /backend/v1/ipcp/diario',
)
assert(
  source.includes("routerAdd('GET', '/backend/v1/ipcp/simulacao'"),
  'deve registrar GET /backend/v1/ipcp/simulacao',
)
assert(source.includes("contrato: 'ipcp_diario_readonly_v0_2'"), 'deve declarar contrato v0.2')
assert(source.includes('read_only: true'), 'deve retornar read_only=true')
assert(source.includes('sem_mutacao: true'), 'deve retornar sem_mutacao=true')
assert(source.includes('fallback_openai_bloqueado: true'), 'deve bloquear fallback OpenAI')
assert(source.includes("provider_oficial_followup: 'nexo_hermes'"), 'deve exigir Nexo/Hermes')
assert(source.includes('sem_snapshot: true'), 'não deve criar snapshot nesta etapa')
assert(source.includes('sem_job_automatico: true'), 'não deve ativar job automático nesta etapa')
assert(!/\$app\.save\s*\(/.test(source), 'endpoint read-only não pode usar $app.save')
assert(!/\.save\s*\(/.test(source), 'endpoint read-only não pode usar save')
assert(!/\$app\.delete\s*\(/.test(source), 'endpoint read-only não pode usar $app.delete')
assert(!/\.delete\s*\(/.test(source), 'endpoint read-only não pode usar delete')
assert(!/send\s*\(/.test(source), 'endpoint read-only não pode acionar envio externo')

console.log('OK: contrato IPCP read-only protegido')
