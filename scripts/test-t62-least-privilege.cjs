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
const profileHook = read('src/hooks/use-is-superadmin.tsx')
const permissionsHook = read('pocketbase/hooks/my_permissions.js')
const accessDenied = read('src/pages/AccessDenied.tsx')
const indexHtml = read('index.html')
const robotsTxt = read('public/robots.txt')

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
  atividades.includes("permissao.getString('slug') === 'negocios.view'") &&
    atividades.includes("escopo === 'equipe'") &&
    atividades.includes("if (perfil === 'negociacao-propria') return false") &&
    !atividades.includes("var perfilRestrito = $app.findRecordById('com_perfis'"),
)
check(
  'fechamentos permitem decisão própria e bloqueiam reativação',
  fechamentos.includes("permissao.getString('slug') === 'negocios.view'") &&
    (fechamentos.match(/if \(perfil === 'negociacao-propria'\) return false/g) || []).length >= 1 &&
    (fechamentos.match(/ACAO_NAO_AUTORIZADA/g) || []).length === 1,
)
check(
  'propostas são próprias e permanecem sem mutação',
  propostas.includes("permissao.getString('slug') === 'negocios.view'") &&
    (propostas.match(/if \(perfil === 'negociacao-propria'\) return false/g) || []).length >= 1 &&
    propostas.includes("perfil === 'negociacao-propria' || perfil === 'leitura-executiva'"),
)
check(
  'alertas SLA são limitados aos próprios negócios',
  slas.includes("escopo === 'equipe' && equipe") &&
    slas.includes("responsavel_id='\" + ator.id + \"'"),
)
check(
  'qualificação, OE e entrada permanecem bloqueadas',
  [qualificacao, ordens, entrada].every(
    (source) => source.includes("'negociacao-propria'") && source.includes('ACAO_NAO_AUTORIZADA'),
  ),
)
check(
  'rotas protegidas exibem acesso não autorizado e falham fechadas sem perfil',
  app.includes('<AccessDenied />') && app.includes('<AccessDenied profileUnavailable />'),
)
check(
  'perfil é resolvido pelo contexto autorizado do backend',
  profileHook.includes("pb.send('/backend/v1/my-permissions'") &&
    profileHook.includes('record?.perfil_slug'),
)
check(
  'backend devolve slug ativo e recusa perfil ausente',
  permissionsHook.includes('perfil_slug: profileSlug') &&
    permissionsHook.includes("forbiddenError('Perfil comercial ativo nao encontrado')"),
)
check(
  'tela de bloqueio diferencia acesso negado de perfil não validado',
  accessDenied.includes('Acesso não autorizado') && accessDenied.includes('Perfil não validado'),
)
check(
  'shell global impede indexação por robôs',
  indexHtml.includes('noindex, nofollow, noarchive, nosnippet') &&
    indexHtml.includes('name="googlebot"') &&
    indexHtml.includes('name="bingbot"'),
)
check(
  'robots.txt bloqueia rastreamento integral',
  robotsTxt.includes('User-agent: *') && robotsTxt.includes('Disallow: /'),
)

let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failures++
}
console.log(`\nT6.2 menor privilégio: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
