const fs = require('node:fs')
const assert = require('node:assert/strict')

const files = [
  'src/pages/OperacaoDia.tsx',
  'src/pages/IpcpSimulacaoGerencial.tsx',
  'src/pages/NexoAssistente.tsx',
  'src/components/ipcp/IpcpEducativoDiarioCard.tsx',
]

for (const file of files) {
  assert.ok(fs.existsSync(file), `${file} deve existir`)
}

const operacao = fs.readFileSync('src/pages/OperacaoDia.tsx', 'utf8')
assert.match(
  operacao,
  /obterNexoIpcpDiarioEquipe/,
  'Operação do Dia deve chamar a leitura viva de equipe do Nexo/IPCP',
)
assert.doesNotMatch(
  operacao,
  /obterIpcpDiarioReadOnly\(\)/,
  'Operação do Dia não deve usar a rota educativa genérica do IPCP',
)

const service = fs.readFileSync('src/services/ipcp.ts', 'utf8')
assert.match(
  service,
  /NEXO_IPCP_DIARIO_VIVO_PATH/,
  'serviço deve declarar caminho vivo do Nexo/IPCP',
)
assert.match(
  service,
  /nexoIpcpDiarioVivoPath\(escopo(?:,\s*responsavelId)?\)|escopo=\$\{escopo\}/,
  'serviço deve consultar a rota viva com escopo explícito por perfil',
)
assert.match(service, /contrato === 'nexo_ipcp_diario_v1'/, 'serviço deve validar contrato vivo')
const nexo = fs.readFileSync('src/pages/NexoAssistente.tsx', 'utf8')
assert.match(
  nexo,
  />Análise gerencial do IPCP<|Análise gerencial do IPCP<\/Link>/,
  'botão do Nexo deve chamar a tela como Análise gerencial do IPCP',
)
assert.doesNotMatch(
  nexo,
  /Abrir IPCP gerencial assistido/,
  'botão antigo Abrir IPCP gerencial assistido não deve aparecer',
)

const fixtureBanida =
  /RCML|PMAIS EVENTOS|id_negocio:\s*['"]4612['"]|id_negocio:\s*['"]4800['"]|total:\s*55\.3/
assert.doesNotMatch(
  service,
  fixtureBanida,
  'serviço de produção assistida não deve manter clientes, negócios ou nota fixa de referência',
)
const hookIpcp = fs.readFileSync('pocketbase/hooks/com_ipcp_diario.js', 'utf8')
assert.doesNotMatch(
  hookIpcp,
  fixtureBanida,
  'hook IPCP não deve expor clientes, negócios ou nota fixa de referência em rotas de produção assistida',
)

const frasesBanidas = [
  'piloto gerencial',
  'Abrir piloto gerencial do IPCP',
  'Guardrails da simulação',
  'Leitura piloto',
  'Rotina diária em homologação',
  'Execução automática ativa apenas no Preview de homologação',
  'Ativa em homologação',
  'Job: ativo em homologação',
  'Simulação do Índice de Performance Comercial PMais',
  'Atualizar simulação',
  'Gravar snapshot simulado',
  'Processar dia em homologação',
  'Simulação indisponível',
  'Snapshot simulado',
  'Carregando simulação',
]

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const frase of frasesBanidas) {
    assert.doesNotMatch(
      source,
      new RegExp(frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      `${file} não deve expor "${frase}" na interface IPCP`,
    )
  }
}

console.log('ipcp-producao-assistida-ui contract: PASS')
