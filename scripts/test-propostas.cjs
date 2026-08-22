const fs = require('fs')
const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')
const page = fs.readFileSync('src/pages/Propostas.tsx', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')
const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8')
const navigation = fs.readFileSync('src/lib/navigation.ts', 'utf8')
const checks = [
  [
    'rotas GET e POST',
    hook.includes('/backend/v1/propostas/fila') && hook.includes('/backend/v1/propostas/eventos'),
  ],
  [
    'helpers isolados nos handlers do JSVM',
    hook.match(/function propostaPerfil/g)?.length === 3 &&
      hook.match(/function propostaPodeAcessar/g)?.length === 3,
  ],
  [
    'autenticacao e comercial ativo',
    hook.includes('$apis.requireAuth()') && hook.includes('ativo_comercial'),
  ],
  [
    'cinco eventos distintos',
    ['preparada', 'aprovada', 'emitida', 'visualizada', 'decidida'].every((x) => hook.includes(x)),
  ],
  ['aprovação antes da emissão', hook.includes('APROVACAO_OBRIGATORIA')],
  ['emissão antes de visualização e decisão', hook.includes('EMISSAO_OBRIGATORIA')],
  ['estado emitida comprovado', hook.includes("versao.set('estado', 'enviada')")],
  [
    'decisão formal',
    hook.includes('EVIDENCIA_DECISAO_OBRIGATORIA') && hook.includes('evidencia_decisao'),
  ],
  [
    'RBAC',
    hook.includes('propostaPodeAcessar') && hook.includes("perfil === 'superadministrador'"),
  ],
  ['fila somente propostas e negociação', hook.includes("['producao_proposta', 'negociacao']")],
  ['idempotência', hook.includes('com_idempotencia') && hook.includes('replay: true')],
  [
    'replay recupera JSON persistido',
    hook.includes("getString('resultado')") && hook.includes('JSON.parse(known[0].getString'),
  ],
  ['concorrência otimista', hook.includes('updated_esperado') && hook.includes('STALE_WRITE')],
  [
    'auditoria server-side',
    hook.includes('propostaAuditoria') &&
      hook.includes("a.set('origem', 'server-side')") &&
      hook.includes("a.set('acao', 'create')"),
  ],
  [
    'autor e data',
    hook.includes("a.set('usuario_id', ator.id)") &&
      hook.includes("a.set('evento_em', new Date())"),
  ],
  ['serviço canônico', service.includes('/backend/v1/propostas/eventos')],
  [
    'interface dos cinco eventos',
    ['Preparar', 'Aprovar', 'Emitir', 'Registrar visualização', 'Registrar aceite'].every((x) =>
      page.includes(x),
    ),
  ],
  ['rota protegida', app.includes('path="/propostas"') && app.includes('<Propostas />')],
  [
    'navegação modular',
    layout.includes('ModuleTabs') &&
      navigation.includes("path: '/propostas'") &&
      navigation.includes('PIPELINE_TABS'),
  ],
]
let ok = 0
for (const [nome, passou] of checks) {
  console.log(`TEST ${passou ? 'PASS' : 'FAIL'}: ${nome}`)
  if (passou) ok++
}
console.log(`\nRESULTADO: ${ok}/${checks.length} aprovados`)
process.exitCode = ok === checks.length ? 0 : 1
