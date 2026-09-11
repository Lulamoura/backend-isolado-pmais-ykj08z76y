const fs = require('node:fs')
const assert = require('node:assert/strict')

const componentPath = 'src/components/NexoBusinessActions.tsx'
const servicePath = 'src/services/nexo.ts'

assert.ok(fs.existsSync(componentPath), 'componente NexoBusinessActions deve existir')
assert.ok(fs.existsSync(servicePath), 'serviço de contexto do Nexo deve existir')

const component = fs.readFileSync(componentPath, 'utf8')
const service = fs.readFileSync(servicePath, 'utf8')

assert.match(
  service,
  /\/backend\/v1\/nexo\/negocios\/\$\{externalId\}\/contexto/,
  'serviço deve chamar endpoint de contexto por externalId',
)
assert.match(component, /Ajuda do Nexo/, 'componente deve renderizar botão Ajuda do Nexo')
assert.match(
  component,
  /Detalhamento da Proposta/,
  'componente deve renderizar botão Detalhamento da Proposta',
)
assert.match(component, /allowNexoHelp/, 'componente deve aceitar controle de exibição da ajuda')
assert.match(
  component,
  /obterContextoNexoNegocio/,
  'componente deve carregar o contexto consolidado do backend',
)
assert.match(
  component,
  /Sem envio automático/,
  'modal deve deixar claro que não há envio automático',
)

const requiredPages = [
  [
    'src/pages/Qualificacoes.tsx',
    /<NexoBusinessActions[\s\S]*allowNexoHelp=\{true\}/,
    'Qualificação pendente deve exibir Ajuda do Nexo',
  ],
  [
    'src/pages/Propostas.tsx',
    /<NexoBusinessActions[\s\S]*allowNexoHelp=\{true\}/,
    'Propostas abertas devem exibir Ajuda do Nexo',
  ],
  [
    'src/pages/Fechamentos.tsx',
    /<NexoBusinessActions[\s\S]*allowNexoHelp=\{!terminal\}/,
    'Fechamentos deve ocultar ajuda em negócios decididos',
  ],
  [
    'src/pages/OrdensExecucao.tsx',
    /<NexoBusinessActions[\s\S]*allowNexoHelp=\{false\}/,
    'Ordens de Execução são decididas e devem ocultar ajuda',
  ],
]

for (const [path, pattern, message] of requiredPages) {
  const content = fs.readFileSync(path, 'utf8')
  assert.match(content, /NexoBusinessActions/, `${path} deve usar NexoBusinessActions`)
  assert.match(content, pattern, message)
}

console.log('nexo-card-buttons contract: PASS')
