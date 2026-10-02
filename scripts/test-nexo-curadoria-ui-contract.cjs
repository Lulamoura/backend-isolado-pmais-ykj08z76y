const fs = require('fs')
const assert = require('assert')

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')
const navigation = fs.readFileSync('src/lib/navigation.ts', 'utf8')
const packageJson = fs.readFileSync('package.json', 'utf8')
const page = fs.readFileSync('src/pages/NexoCuradoria.tsx', 'utf8')
const component = fs.readFileSync('src/components/nexo/NexoCuradoriaComercialUnificada.tsx', 'utf8')
const service = fs.readFileSync('src/services/nexo-curadoria.ts', 'utf8')
const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const failClosedMigration = fs.readFileSync(
  'pocketbase/migrations/202610012330_nexo_curadoria_fail_closed.js',
  'utf8',
)

assert.match(navigation, /Curadoria Nexo/, 'menu deve declarar Curadoria Nexo')
assert.match(navigation, /\/nexo\/curadoria/, 'menu deve apontar para a rota da curadoria')
assert.match(layout, /CURADORIA_NEXO_ALLOWLIST/, 'layout deve ter allowlist explícita')
assert.match(
  layout,
  /'superadministrador'[\s\S]{0,120}'gestor-comercial'[\s\S]{0,120}'leitura-executiva'/,
  'curadoria deve ser visível aos três perfis governados',
)
assert.match(app, /NexoCuradoriaRoute/, 'rota deve ter gate específico')

assert.match(page, /NexoCuradoriaComercialUnificada/, 'página deve usar a UI unificada')
assert.match(
  page,
  /somenteLeitura=\{perfilSlug === 'leitura-executiva'\}/,
  'página deve ativar read-only pelo perfil',
)
assert.match(page, /Histórico legado somente leitura/, 'legado deve aparecer apenas como histórico')
assert.doesNotMatch(
  page,
  /salvarEntrevistaCuradoriaNexo|salvarDecisaoSuperiorCuradoriaNexo|atualizarDecisaoSuperiorCuradoriaNexo|sincronizarDecisaoSegundoCerebroCuradoriaNexo|atualizarRevisaoIpcpCuradoriaNexo/,
  'página histórica não pode importar ou disparar mutações legadas',
)
assert.doesNotMatch(
  page,
  /Aprovar e aplicar alteração de fórmula|Retirar do uso operacional|Encaminhar para decisão superior|Começar entrevista/,
  'UI legada não pode renderizar ações mutáveis',
)

assert.match(component, /somenteLeitura\?: boolean/, 'UI unificada deve aceitar modo read-only')
assert.match(
  component,
  /if \(somenteLeitura\) return/,
  'handlers devem falhar fechados em read-only',
)
assert.match(
  component,
  /\{!somenteLeitura && \([\s\S]{0,180}<div className="mt-4 flex flex-wrap gap-2">/,
  'ações da UI unificada não devem ser renderizadas em read-only',
)
assert.match(component, /Modo somente leitura/, 'UI deve explicar o modo read-only')

assert.match(
  failClosedMigration,
  /com_nexo_curadoria_decisoes[\s\S]+createRule\s*=\s*null[\s\S]+updateRule\s*=\s*null[\s\S]+deleteRule\s*=\s*null/,
  'migração deve bloquear CRUD direto da coleção legada',
)
assert.match(
  failClosedMigration,
  /app\.save\(decisoes\)/,
  'migração deve persistir regras fail-closed',
)
assert.doesNotMatch(
  service,
  /collection\(DECISOES_COLLECTION\)\.(create|update)/,
  'serviço cliente não pode fazer mutação direta na coleção legada',
)

const syncRoute = hook.match(
  /\/backend\/v1\/nexo\/curadoria\/decisoes\/\{id\}\/segundo-cerebro[\s\S]*?\$apis\.requireAuth\('users'\)/,
)
assert.ok(syncRoute, 'rota server-side de sync legado deve existir')
assert.match(
  syncRoute[0],
  /perfil !== 'superadministrador'/,
  'sync legado deve aceitar somente SuperAdmin',
)
assert.match(syncRoute[0], /ator\.getBool\('ativo_comercial'\)/, 'sync legado exige usuário ativo')
assert.match(
  syncRoute[0],
  /perfilRec\.getBool\('ativo'\)/,
  'sync legado exige perfil comercial ativo',
)
assert.match(
  syncRoute[0],
  /LEGACY_CURADORIA_DECISION_DISABLED/,
  'sync legado deve responder 410 sem escrever',
)
assert.doesNotMatch(
  syncRoute[0],
  /\$http\.send|curadoria\/decisao/,
  'sync legado não consome mais o Gateway singular',
)
assert.doesNotMatch(
  syncRoute[0],
  /perfil !== 'superadministrador' && perfil !== 'leitura-executiva'/,
  'leitura-executiva não pode sincronizar legado',
)
const ipcpRoute = hook.match(
  /\/backend\/v1\/nexo\/curadoria\/decisoes\/\{id\}\/ipcp-revisao[\s\S]*?var id =/,
)
assert.ok(ipcpRoute, 'rota server-side de revisão IPCP deve existir')
assert.match(
  ipcpRoute[0],
  /perfil !== 'superadministrador'/,
  'revisão IPCP deve aceitar somente SuperAdmin',
)
assert.match(ipcpRoute[0], /ator\.getBool\('ativo_comercial'\)/, 'revisão IPCP exige usuário ativo')
assert.match(
  ipcpRoute[0],
  /perfilRec\.getBool\('ativo'\)/,
  'revisão IPCP exige perfil comercial ativo',
)
assert.doesNotMatch(
  ipcpRoute[0],
  /perfil !== 'superadministrador' && perfil !== 'leitura-executiva'/,
  'leitura-executiva não pode revisar IPCP',
)

assert.match(
  hook,
  /pode_escrever: slug === 'superadministrador' \|\| slug === 'gestor-comercial'/,
  'leitura-executiva deve ser somente leitura na API unificada',
)
assert.match(
  hook,
  /pode_decidir_direcao: slug === 'superadministrador'/,
  'somente SuperAdmin deve decidir casos de direção',
)
assert.match(
  hook,
  /if \(!nexoCuradoriaCasoNoEscopo\(acesso, caso\)\) throw new Error\('ESCOPO_INSUFICIENTE'\)/,
  'gestor comercial deve mutar somente seu escopo/equipe',
)
assert.match(
  packageJson,
  /test-nexo-curadoria-casos-api-runtime\.cjs/,
  'npm test deve executar runtime da API unificada',
)
assert.match(
  packageJson,
  /test-nexo-curadoria-review-hardening-schema-contract\.cjs/,
  'npm test deve executar contrato fail-closed',
)

console.log('nexo-curadoria-ui contract: PASS')
