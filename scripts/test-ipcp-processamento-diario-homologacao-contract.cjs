const fs = require('node:fs')
const path = require('node:path')

const hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_ipcp_diario.js')
const source = fs.readFileSync(hookPath, 'utf8')
const postSource = (source.split("routerAdd('POST', '/backend/v1/ipcp/processamento-diario/homologacao'")[1] || '').split(
  'var IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO',
)[0]

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

assert(postSource, 'deve expor processamento diário controlado de homologação')
assert(
  postSource.includes("EXECUTAR_PROCESSAMENTO_DIARIO_IPCP_HOMOLOGACAO"),
  'deve exigir confirmação explícita do processamento diário',
)
assert(
  postSource.includes("contrato: 'ipcp_processamento_diario_homologacao_v0_1'"),
  'deve declarar contrato específico do processamento diário',
)
assert(postSource.includes("'processamento_diario'].join('|')"), 'snapshot key deve separar processamento diário')
assert(postSource.includes("record.set('modo', 'processamento_diario')"), 'registro deve indicar modo processamento_diario')
assert(
  postSource.includes("record.set('origem', 'ipcp_processamento_diario_homologacao_manual')"),
  'origem deve indicar homologação manual',
)
assert(postSource.includes('agendamento_automatico_ativo: false'), 'agendamento automático deve estar desligado')
assert(postSource.includes('producao_publicada: false'), 'produção deve continuar bloqueada')
assert(postSource.includes('sem_job_automatico: true'), 'não pode ativar job automático')
assert(postSource.includes('sem_crm_write: true'), 'não pode escrever no CRM')
assert(!/scheduler|cronAdd|setInterval|setTimeout/.test(postSource), 'não deve registrar agendamento no hook')

console.log('OK: contrato IPCP processamento diario homologacao protegido')
