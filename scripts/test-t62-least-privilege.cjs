const fs = require('fs')

const read = (path) => fs.readFileSync(path, 'utf8')
const checks = []
const check = (name, condition) => checks.push([name, Boolean(condition)])

const layout = read('src/components/Layout.tsx')
const app = read('src/App.tsx')
const tabs = read('src/components/ModuleTabs.tsx')
const propostasPage = read('src/pages/Propostas.tsx')
const pipelinePage = read('src/pages/Pipeline.tsx')
const migration = read('pocketbase/archive/legacy-migrations/0078_t62_least_privilege.js')
const guardList = read('pocketbase/hooks/guard_list.js')
const guardView = read('pocketbase/hooks/guard_view.js')
const hooks = [
  'com_entrada_negocio.js',
  'com_qualificacao.js',
  'com_propostas_operacao.js',
  'com_atividades_operacao.js',
  'com_fechamentos_operacao.js',
  'com_ordens_execucao.js',
].map((name) => read(`pocketbase/hooks/${name}`))

check('menu Administração depende de permissões', layout.includes('podeAdministrar'))
check('rota Administração possui barreira', app.includes('AdministrationRoute'))
check('rotas operacionais completas bloqueiam o perfil restrito', app.includes('FullPipelineRoute'))
check(
  'abas do perfil restrito mostram apenas Pipeline e Propostas',
  tabs.includes("perfilSlug === 'negociacao-propria'"),
)
check(
  'propostas do perfil restrito são somente leitura',
  propostasPage.includes('somenteNegociacao'),
)
check(
  'visão geral do Pipeline mostra apenas Propostas ao perfil restrito',
  pipelinePage.includes("stage.path === '/propostas'"),
)
check('listagem de usuários exige usuarios.admin', guardList.includes("users: ['usuarios.admin']"))
check(
  'visualização de usuários exige usuarios.admin',
  guardView.includes("users: ['usuarios.admin']"),
)
check(
  'migração restringe regras de users e auditoria',
  migration.includes('users.listRule') && migration.includes('auditoria.listRule'),
)
check('migração cria perfil restrito', migration.includes("'negociacao-propria'"))
check(
  'migração limita o perfil a três permissões de leitura',
  migration.includes("['empresas.view', 'negocios.view', 'dashboard.view']"),
)
check(
  'migração associa somente a conta nominal de Shirleide',
  migration.includes("'comercial06@pmaisservicos.com.br'"),
)
check(
  'todos os hooks operacionais bloqueiam o perfil restrito',
  hooks.every(
    (source) => source.includes("'negociacao-propria'") && source.includes("'ACAO_NAO_AUTORIZADA'"),
  ),
)

let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failures++
}
console.log(`\nT6.2 menor privilégio: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
