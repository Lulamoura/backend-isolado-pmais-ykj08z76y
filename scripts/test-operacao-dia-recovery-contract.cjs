const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const atividades = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_atividades_operacao.js'),
  'utf8',
)
const fechamentos = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_fechamentos_operacao.js'),
  'utf8',
)

const checks = [
  [
    'Ações do Dia aceita somente o escopo temporal fechado',
    atividades.includes("['todas', 'dia'].indexOf(escopoTemporal)"),
  ],
  [
    'Ações futuras ficam fora do escopo do dia',
    atividades.includes("estadoFila === 'programada' && dataProxima !== hoje"),
  ],
  [
    'fila prioriza sem data, vencidas e programadas',
    atividades.includes('{ sem_proxima_acao: 0, vencida: 1, programada: 2 }'),
  ],
  [
    'vencidas são ordenadas da data mais antiga',
    atividades.includes('if (dataA !== dataB) return dataA < dataB ? -1 : 1'),
  ],
  [
    'recuperação acionável exige negócio perdido e agenda ativa existente',
    fechamentos.includes("resultado = 'perdido'") &&
      fechamentos.includes("n.getString('resultado') !== 'perdido' || !agenda"),
  ],
  [
    'recuperação acionável não fica limitada aos cem negócios recentes',
    fechamentos.includes("recuperacao === 'acionavel' ? 5000 : 100"),
  ],
  [
    'recuperação sem data ou futura é excluída',
    fechamentos.includes('!dataRecuperacao || dataRecuperacao > hoje'),
  ],
  [
    'recuperações acionáveis são ordenadas da data mais antiga',
    fechamentos.includes('if (dataA !== dataB) return dataA < dataB ? -1 : 1'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
