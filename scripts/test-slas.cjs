const fs = require('fs')
const hook = fs.readFileSync('pocketbase/hooks/com_slas.js', 'utf8')
const migration = fs.readFileSync('pocketbase/migrations/0077_create_com_calendario_sla.js', 'utf8')
const page = fs.readFileSync('src/pages/Slas.tsx', 'utf8')
const service = fs.readFileSync('src/services/slas.ts', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')
const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8')
const navigation = fs.readFileSync('src/lib/navigation.ts', 'utf8')
const checks = [
  [
    'rotas GET e POST',
    hook.includes('/backend/v1/slas/fila') && hook.includes('/backend/v1/slas/parametros'),
  ],
  ['autenticacao', hook.includes('$apis.requireAuth()')],
  ['dias uteis', hook.includes('getUTCDay') && hook.includes('fimDiaUtil')],
  ['fins de semana', hook.includes('w !== 0 && w !== 6')],
  [
    'feriados canonicos',
    hook.includes('com_calendario_feriados') && migration.includes('com_calendario_feriados'),
  ],
  [
    'calendario Recife independente da migration',
    hook.includes("'2026-06-24'") && hook.includes("'2026-07-16'"),
  ],
  ['lead 1 dia util', migration.includes("sla.lead_dias_uteis', '1")],
  ['proposta 5 dias uteis', migration.includes("sla.proposta_dias_uteis', '5")],
  ['negociacao 2 dias uteis', /['"]sla\.negociacao_dias_uteis['"],\s*['"]2['"]/.test(migration)],
  ['timezone Recife', hook.includes('America/Recife') && page.includes('America/Recife')],
  ['fila RBAC', hook.includes("perfil !== 'superadministrador'") && hook.includes('equipe_id')],
  ['tres situacoes', ['vencido', 'alerta', 'no_prazo'].every((v) => hook.includes(v))],
  [
    'parametro SuperAdmin',
    hook.includes("perfil !== 'superadministrador'") && hook.includes('SuperAdmin necessario'),
  ],
  [
    'bootstrap transacional de parametro ausente',
    hook.includes("body.updated_esperado !== 'DEFAULT'") &&
      hook.includes("new Record(tx.findCollectionByNameOrId('com_parametros'))"),
  ],
  [
    'concorrencia otimista inclusive contra DEFAULT obsoleto',
    hook.includes("!criado && body.updated_esperado === 'DEFAULT'") && hook.includes('STALE_WRITE'),
  ],
  [
    'versao delegada ao historico canonico',
    !hook.includes("p.set('versao', versao)") && hook.includes("salvo.get('versao')"),
  ],
  [
    'auditoria server side',
    hook.includes('alterar_parametro_sla') && hook.includes("'server-side'"),
  ],
  [
    'parametros protegidos',
    migration.includes('pcol.createRule = null') && migration.includes('pcol.updateRule = null'),
  ],
  ['servico canonico', service.includes('/backend/v1/slas/fila')],
  [
    'interface de alertas',
    page.includes('SLAs, calendário e alertas') && page.includes('Agenda de vencimentos'),
  ],
  ['rota protegida', app.includes('path="/slas"') && app.includes('<Slas />')],
  [
    'navegacao modular',
    layout.includes('ModuleTabs') &&
      navigation.includes("path: '/slas'") &&
      navigation.includes('ADMIN_TABS'),
  ],
]
let ok = 0
for (const [nome, passou] of checks) {
  console.log(`TEST ${passou ? 'PASS' : 'FAIL'}: ${nome}`)
  if (passou) ok++
}
console.log(`\nRESULTADO: ${ok}/${checks.length} aprovados`)
process.exitCode = ok === checks.length ? 0 : 1
