const fs = require('fs')

const files = [
  'pocketbase/hooks/com_propostas_operacao.js',
  'pocketbase/hooks/com_negocios_opcoes_cobertura.js',
  'pocketbase/hooks/com_atividades_operacao.js',
  'pocketbase/hooks/com_slas.js',
  'pocketbase/hooks/com_dashboard_resumo.js',
  'pocketbase/hooks/com_proposta_envios.js',
  'pocketbase/hooks/com_fechamentos_operacao.js',
]

let passed = 0
function check(name, condition) {
  if (!condition) throw new Error(`TEST FAIL: ${name}`)
  passed += 1
  console.log(`TEST PASS: ${name}`)
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const touchesSubstituicoes = src.includes('com_substituicoes')
  check(`${file} toca com_substituicoes`, touchesSubstituicoes)
  const usaJanelaCivil = /00:00:00\.000Z/.test(src) && /23:59:59\.999Z/.test(src)
  const usaDataCivilJs =
    src.includes('substituicaoVigente') || src.includes('propostaSubstituicaoVigente')
  check(
    `${file} não compara substituição vigente por data crua`,
    (usaJanelaCivil || usaDataCivilJs) &&
      !/data_fim >= '\" \+\s*\n\s*hoje\s*\+/m.test(src) &&
      !/data_inicio <= '\" \+\s*\n\s*hoje\s*\+/m.test(src),
  )
}

const opcoes = fs.readFileSync('pocketbase/hooks/com_negocios_opcoes_cobertura.js', 'utf8')
check(
  'opções de cobertura busca negócio coberto por substituição vigente',
  opcoes.includes('idsNegociosSubstituidos') && opcoes.includes('filtroSubs'),
)

const propostas = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
check(
  'fila de propostas preserva negócio coberto por substituição vigente',
  propostas.includes('propostaIdsNegociosSubstituidos') &&
    propostas.includes('propostaFiltroIdsNegocios(substituidos)'),
)

console.log(`\nRESULTADO: ${passed}/${files.length * 2 + 2} aprovados`)
