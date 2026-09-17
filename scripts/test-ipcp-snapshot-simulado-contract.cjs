const fs = require('node:fs')
const path = require('node:path')

const hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_ipcp_diario.js')
const source = fs.readFileSync(hookPath, 'utf8')
const postSource = (
  source.split("routerAdd('POST', '/backend/v1/ipcp/snapshots/simulado'")[1] || ''
).split("routerAdd('POST', '/backend/v1/ipcp/processamento-diario/homologacao'")[0]

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

assert(postSource, 'deve expor endpoint POST de snapshot simulado')
assert(
  postSource.includes("confirmacao || '') !== 'CRIAR_SNAPSHOT_SIMULADO_IPCP'"),
  'deve exigir confirmação explícita',
)
assert(
  postSource.includes('function canPersistSnapshot'),
  'deve limitar perfil que persiste snapshot',
)
assert(
  postSource.includes("slug === 'superadministrador' || slug === 'gestor-comercial'"),
  'persistência deve ficar restrita a gestão/superadmin',
)
assert(postSource.includes('new Collection({'), 'deve criar coleção de snapshot quando ausente')
assert(postSource.includes("name: 'com_ipcp_snapshots'"), 'coleção deve ser com_ipcp_snapshots')
assert(
  postSource.includes('CREATE UNIQUE INDEX idx_com_ipcp_snapshots_snapshot_key'),
  'deve ter idempotência por snapshot_key',
)
assert(
  postSource.includes("contrato: 'ipcp_snapshot_simulado_v0_1'"),
  'deve declarar contrato de snapshot simulado',
)
assert(
  postSource.includes("modo: 'snapshot_simulado'"),
  'payload deve declarar modo snapshot simulado',
)
assert(postSource.includes("status: 'homologacao'"), 'snapshot deve ficar em homologação')
assert(postSource.includes('sem_crm_write: true'), 'não pode escrever no CRM')
assert(postSource.includes('sem_job_automatico: true'), 'não pode ativar job automático')
assert(
  postSource.includes('somente_colecao_snapshot: true'),
  'write deve ficar restrito à coleção de snapshot',
)
assert(!/set\(['"]job_automatico_ativo/.test(postSource), 'não deve persistir job automático')
assert(
  !/routerAdd\('POST', '\/backend\/v1\/ipcp\/(?!snapshots\/simulado|processamento-diario\/homologacao)/.test(
    source,
  ),
  'não deve expor outro POST IPCP',
)

console.log('OK: contrato IPCP snapshot simulado protegido')
