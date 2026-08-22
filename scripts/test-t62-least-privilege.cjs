const fs = require('fs')

const read = (path) => fs.readFileSync(path, 'utf8')
const checks = []
const check = (name, condition) => checks.push([name, Boolean(condition)])

const layout = read('src/components/Layout.tsx')
const app = read('src/App.tsx')
const tabs = read('src/components/ModuleTabs.tsx')
const propostasPage = read('src/pages/Propostas.tsx')
const pipelinePage = read('src/pages/Pipeline.tsx')
const operacaoDia = read('src/pages/OperacaoDia.tsx')
const fechamentosPage = read('src/pages/Fechamentos.tsx')
const migration = read('pocketbase/archive/legacy-migrations/0078_t62_least_privilege.js')
const guardList = read('pocketbase/hooks/guard_list.js')
const guardView = read('pocketbase/hooks/guard_view.js')
const entrada = read('pocketbase/hooks/com_entrada_negocio.js')
const qualificacao = read('pocketbase/hooks/com_qualificacao.js')
const propostas = read('pocketbase/hooks/com_propostas_operacao.js')
const atividades = read('pocketbase/hooks/com_atividades_operacao.js')
const fechamentos = read('pocketbase/hooks/com_fechamentos_operacao.js')
const ordens = read('pocketbase/hooks/com_ordens_execucao.js')
const slas = read('pocketbase/hooks/com_slas.js')

check('menu Administração depende de permissões', layout.includes('podeAdministrar'))
check('rota Administração possui barreira', app.includes('AdministrationRoute'))
check(
  'qualificação e OE bloqueiam o perfil restrito, mas fechamentos permanecem acessíveis',
  app.includes('RestrictedProfileRoute') &&
    app.includes('<Fechamentos />') &&
    !app.includes('<RestrictedProfileRoute>\n                      <Fechamentos />'),
)
check(
  'abas do perfil restrito mostram Pipeline, Propostas e Fechamentos',
  tabs.includes("['/pipeline', '/propostas', '/fechamentos']"),
)
check(
  'propostas do perfil restrito são somente leitura',
  propostasPage.includes('somenteNegociacao'),
)
check(
  'visão geral mostra somente Propostas e Fechamentos ao perfil restrito',
  pipelinePage.includes("['/propostas', '/fechamentos']"),
)
check(
  'operação do dia não consulta nem mostra OE ao perfil restrito',
  operacaoDia.includes("perfilSlug === 'negociacao-propria'") &&
    operacaoDia.includes("card.path !== '/ordens-execucao'"),
)
check(
  'reativação não é apresentada ao perfil restrito',
  fechamentosPage.includes("perfilSlug !== 'negociacao-propria'"),
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
  'atividades limitam leitura e escrita aos próprios negócios',
  atividades.includes("perfil !== 'negociacao-propria' && equipe") &&
    atividades.includes("if (perfil === 'negociacao-propria') return false") &&
    !atividades.includes("var perfilRestrito = $app.findRecordById('com_perfis'"),
)
check(
  'fechamentos permitem decisão própria e bloqueiam reativação',
  (fechamentos.match(/if \(perfil === 'negociacao-propria'\) return false/g) || []).length >= 2 &&
    (fechamentos.match(/ACAO_NAO_AUTORIZADA/g) || []).length === 1,
)
check(
  'propostas são próprias e permanecem sem mutação',
  (propostas.match(/if \(perfil === 'negociacao-propria'\) return false/g) || []).length >= 3,
)
check(
  'alertas SLA são limitados aos próprios negócios',
  slas.includes("p !== 'negociacao-propria' && equipe"),
)
check(
  'qualificação, OE e entrada permanecem bloqueadas',
  [qualificacao, ordens, entrada].every(
    (source) => source.includes("'negociacao-propria'") && source.includes('ACAO_NAO_AUTORIZADA'),
  ),
)

let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failures++
}
console.log(`\nT6.2 menor privilégio: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
