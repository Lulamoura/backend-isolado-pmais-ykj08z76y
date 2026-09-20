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
  /cronAdd\(\s*'ipcp_processamento_diario_homologacao_1900_recife'/.test(hookSource),
  'backend deve registrar o job diário do IPCP',
)
assert(
  hookSource.includes("IPCP_JOB_DIARIO_HOMOLOGACAO_HORARIO_RECIFE = '19:00'"),
  'job deve declarar horário de negócio Recife 19:00',
)
assert(
  hookSource.includes("IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC = '0 22 * * *'"),
  'job deve rodar às 22:00 UTC para corresponder a 19:00 Recife',
)
assert(
  /record\.set\('origem', origem\)/.test(hookSource) &&
    hookSource.includes('ipcp_processamento_diario_job_1900_recife'),
  'snapshots do job devem identificar origem automática',
)
assert(
  /agendamento_automatico_ativo:\s*true/.test(hookSource),
  'payload/status do job deve indicar automação ativa',
)
assert(
  hookSource.includes("'todos'") &&
    hookSource.includes("ipcp_processamento_diario_job_1900_recife_todos") &&
    hookSource.includes("'__todos__'") &&
    hookSource.includes("ipcp_processamento_diario_job_1900_recife_responsavel"),
  'job deve gravar no mesmo ciclo: snapshot Todos explícito, consolidado e pacotes por responsável',
)
assert(
  hookSource.includes('listRule: null') &&
    hookSource.includes('viewRule: null') &&
    hookSource.includes('existing.listRule = null') &&
    hookSource.includes('existing.viewRule = null') &&
    hookSource.includes('existing.createRule !== null') &&
    hookSource.includes('existing.updateRule !== null') &&
    hookSource.includes('existing.deleteRule !== null'),
  'coleção de snapshots deve ficar fechada para leitura direta; acesso deve passar pela rota governada',
)
assert(
  serviceSource.includes("horario_recife: '19:00'"),
  'status da rotina deve mostrar horário Recife',
)
assert(serviceSource.includes("cron_utc: '0 22 * * *'"), 'status deve mostrar cron UTC correto')
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
