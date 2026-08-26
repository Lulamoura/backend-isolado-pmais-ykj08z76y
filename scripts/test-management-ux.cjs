const fs = require('fs')

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8')
const tabs = fs.readFileSync('src/components/ModuleTabs.tsx', 'utf8')
const substitutions = fs.readFileSync('src/pages/SubstituicoesLista.tsx', 'utf8')
const foundation = fs.readFileSync('src/pages/Foundation.tsx', 'utf8')

const checks = [
  [
    'Sistema só aparece para quem pode administrar',
    layout.includes('showSystem={podeAdministrar}') &&
      tabs.includes("showSystem || item.path !== '/foundation'"),
  ],
  [
    'SLAs e Substituições continuam disponíveis sem expor Sistema',
    tabs.includes("showSubstituicoes || item.path !== '/substituicoes'") &&
      tabs.includes('ADMIN_TABS.filter'),
  ],
  [
    'Substituições explicam o bloqueio da pré-operação',
    substitutions.includes('Consulta disponível; gestão ainda não ativada') &&
      substitutions.includes('gate funcional específico desta rotina'),
  ],
  [
    'atalho de parâmetros abre a aba correta',
    foundation.includes("searchParams.get('tab') || 'equipes'") &&
      foundation.includes('setSearchParams({ tab: value })'),
  ],
]

let approved = 0
for (const [name, condition] of checks) {
  console.log(`TEST ${condition ? 'PASS' : 'FAIL'}: ${name}`)
  if (condition) approved++
}
console.log(`\nRESULTADO: ${approved}/${checks.length} aprovados`)
if (approved !== checks.length) process.exit(1)
