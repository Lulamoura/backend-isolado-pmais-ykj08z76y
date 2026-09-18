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
  /nexoIpcpDiarioVivoPath\(|URLSearchParams\(\{ escopo \}\)/,
  'serviço deve consultar a rota viva com escopo explícito por perfil',
)
assert.match(service, /contrato === 'nexo_ipcp_diario_v1'/, 'serviço deve validar contrato vivo')
assert.match(
  service,
  /responsavel_id/,
  'serviço IPCP deve permitir filtro gerencial por responsável sem trocar credenciais',
)

const card = fs.readFileSync('src/components/ipcp/IpcpEducativoDiarioCard.tsx', 'utf8')
assert.match(
  card,
  /nomeNegocioAtencao|isIdTecnico|idTecnico/,
  'card de negócios deve esconder ID técnico e montar título humano',
)
assert.doesNotMatch(
  card,
  /Negócio \{item\.id_negocio\} — \{item\.cliente\}/,
  'card não deve exibir ID técnico antes do nome do negócio',
)

const ipcpGerencial = fs.readFileSync('src/pages/IpcpSimulacaoGerencial.tsx', 'utf8')
assert.match(
  ipcpGerencial,
  /UserSelect|respons[aá]vel|Respons[aá]vel|Todos/,
  'IPCP gerencial assistido deve oferecer filtro por responsável ou visão todos',
)
assert.match(
  ipcpGerencial,
  /obterNexoIpcpDiarioEquipe/,
  'IPCP gerencial assistido deve usar leitura viva Nexo/IPCP em vez de tela vazia/simulação antiga',
)
assert.match(
  ipcpGerencial,
  /executarIpcpProcessamentoDiarioHomologacao|Recalcular IPCP/,
  'IPCP gerencial assistido deve manter botão de recálculo manual controlado',
)
assert.match(
  card,
  /N[ºo]\.? do negócio|numeroNegocioAtencao|id_negocio/,
  'cards de negócios devem exibir número do negócio para localização operacional',
)
const hookIpcp = fs.readFileSync('pocketbase/hooks/com_ipcp_diario.js', 'utf8')
assert.match(
  hookIpcp,
  /responsavelSelecionado|filtroResponsavelSelecionado|responsavelId && scope === 'equipe'/,
  'rota IPCP viva deve recalcular por responsável selecionado em escopo gerencial',
)

const fixtureBanida =
  /RCML|PMAIS EVENTOS|id_negocio:\s*['"]4612['"]|id_negocio:\s*['"]4800['"]|total:\s*55\.3/
assert.doesNotMatch(
  service,
  fixtureBanida,
  'serviço de produção assistida não deve manter clientes, negócios ou nota fixa de referência',
)
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
