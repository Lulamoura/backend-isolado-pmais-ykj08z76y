const fs = require('node:fs')
const path = require('node:path')

const hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_ipcp_diario.js')
const servicePath = path.join(__dirname, '..', 'src', 'services', 'ipcp.ts')
const pagePath = path.join(__dirname, '..', 'src', 'pages', 'IpcpSimulacaoGerencial.tsx')
const hookSource = fs.readFileSync(hookPath, 'utf8')
const serviceSource = fs.readFileSync(servicePath, 'utf8')
const pageSource = fs.readFileSync(pagePath, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

assert(
  !/cronAdd\(/.test(hookSource),
  'app não deve registrar cron interno enquanto Produção estiver bloqueada',
)
assert(
  serviceSource.includes("horario_recife: '19:00'"),
  'status da rotina deve mostrar horário Recife',
)
assert(
  serviceSource.includes('agendamento_automatico_ativo: true'),
  'status deve indicar automação de homologação ativa',
)
assert(serviceSource.includes('producao_publicada: false'), 'status deve manter Produção bloqueada')
assert(serviceSource.includes('sem_crm_write: true'), 'status deve manter CRM sem alteração')
assert(
  !pageSource.includes('Rotina diária em produção assistida'),
  'tela gerencial não deve exibir card de rotina diária',
)
assert(
  !pageSource.includes('Ativa em produção assistida'),
  'tela gerencial não deve exibir status operacional da rotina diária',
)
assert(
  !pageSource.includes('CRM: sem alteração'),
  'tela gerencial não deve exibir detalhes operacionais do card removido',
)
assert(pageSource.includes('Análise gerencial do IPCP'), 'tela deve usar título gerencial aprovado')

console.log('OK: contrato IPCP job diario homologacao protegido')
