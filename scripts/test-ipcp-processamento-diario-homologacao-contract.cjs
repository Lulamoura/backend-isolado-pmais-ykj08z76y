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
assert(!postSource.includes('var ipcpTotal = 55.3'), 'processamento diário não pode manter nota fixa de referência')
assert(postSource.includes('calcularPacoteIpcpDiario'), 'processamento diário deve calcular pacote antes de gravar')
assert(postSource.includes('filtroEscopoColecao'), 'processamento diário deve filtrar dados pelo escopo efetivo')
assert(postSource.includes("responsavel_id = '") || postSource.includes('responsavel_id'), 'processamento diário deve considerar responsável no escopo próprio')
assert(!postSource.includes("id_negocio: '4612'"), 'processamento diário não pode manter negócio fixo de referência')
assert(!postSource.includes("id_negocio: '4800'"), 'processamento diário não pode manter negócio fixo de referência')
assert(postSource.includes("ipcp_v0_4_dados_vivos_por_escopo"), 'processamento diário deve usar fórmula viva por escopo')
assert(postSource.includes('sem_job_automatico: true'), 'não pode ativar job automático')
assert(postSource.includes('sem_crm_write: true'), 'não pode escrever no CRM')
assert(postSource.includes('resumo_nexo'), 'processamento diário deve gravar resumo gerencial do Nexo no payload')
assert(postSource.includes('negocios_atencao'), 'processamento diário deve gravar negócios que merecem atenção')
assert(postSource.includes('evolucao'), 'processamento diário deve gravar evolução/comentário do IPCP')
assert(postSource.includes('evidencias'), 'processamento diário deve gravar evidências resumidas')
assert(postSource.includes("status', 'producao_assistida'"), 'snapshot diário deve sair com status de produção assistida')
assert(postSource.includes('pacote_completo: true'), 'resposta deve indicar pacote completo para Operação do Dia')
assert(!/scheduler|cronAdd|setInterval|setTimeout/.test(postSource), 'não deve registrar agendamento no hook')

console.log('OK: contrato IPCP processamento diario homologacao protegido')
