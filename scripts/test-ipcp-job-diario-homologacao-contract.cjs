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
  source.includes('IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO = true'),
  'job de homologação deve estar ativo no Preview',
)
assert(
  source.includes("IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC = '0 22 * * *'"),
  'cron deve rodar 19:00 Recife / 22:00 UTC',
)
assert(
  source.includes("routerAdd('GET', '/backend/v1/ipcp/job-diario/homologacao/status'"),
  'deve expor status do job',
)
assert(
  source.includes("cronAdd('ipcp_processamento_diario_homologacao'"),
  'deve registrar cron do processamento diário',
)
assert(
  source.includes("contrato: 'ipcp_job_diario_homologacao_v0_1'"),
  'payload do cron deve ter contrato próprio',
)
assert(
  source.includes("record.set('origem', 'ipcp_job_diario_homologacao_automatico')"),
  'origem deve identificar job automático',
)
assert(source.includes('producao_publicada: false'), 'produção deve continuar bloqueada')
assert(source.includes('sem_crm_write: true'), 'job não pode escrever no CRM')
assert(source.includes('sem_envio: true'), 'job não pode fazer envio externo')
assert(source.includes('somente_colecao_snapshot: true'), 'job deve gravar somente snapshot')
assert(
  !/cronAdd\('ipcp_processamento_diario_producao'/.test(source),
  'não deve haver cron de produção',
)

console.log('OK: contrato IPCP job diario homologacao protegido')
