const fs = require('node:fs')

const hook = fs.readFileSync('pocketbase/hooks/com_proposta_alertas.js', 'utf8')
const page = fs.readFileSync('src/pages/OperacaoDia.tsx', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')

const route = hook.slice(hook.indexOf("'/backend/v1/propostas/sem-abertura'"))
const checks = [
  ['rota continua autenticada', route.includes("$apis.requireAuth('users')")],
  ['consulta preserva escopo por perfil', route.includes('podeAcessar(user, slug, ctx.negocio)')],
  ['propostas recentes não são excluídas', !route.includes('if (dias < limite) continue')],
  ['tempo em horas é devolvido', route.includes('horas_corridas_sem_abertura: horas')],
  [
    'classificação operacional é devolvida',
    route.includes('classificacao_sem_abertura: classificacao'),
  ],
  [
    'atrasadas são priorizadas',
    route.includes('var prioridade = { atrasada: 0, prazo_atingido: 1, atencao: 2, recente: 3 }'),
  ],
  [
    'serviço tipa tempo e classificação',
    service.includes('horas_corridas_sem_abertura: number') &&
      service.includes("'prazo_atingido' | 'atrasada'"),
  ],
  [
    'tela explica que lista todas as propostas',
    page.includes('Todas as propostas enviadas que ainda não tiveram abertura registrada'),
  ],
  [
    'tela mostra tempo e marcador',
    page.includes('Tempo sem abertura') && page.includes('STATUS_SEM_ABERTURA'),
  ],
  [
    'fila aparece antes dos indicadores',
    page.indexOf('<MailWarning') < page.indexOf('Indicadores primários'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
