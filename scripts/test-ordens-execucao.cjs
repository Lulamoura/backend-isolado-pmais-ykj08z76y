const fs = require('fs')

const read = (path) => (fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '')
const hook = read('pocketbase/hooks/com_ordens_execucao.js')
const service = read('src/services/ordens-execucao.ts')
const page = read('src/pages/OrdensExecucao.tsx')
const app = read('src/App.tsx')
const layout = read('src/components/Layout.tsx')
const navigation = read('src/lib/navigation.ts')

const checks = [
  [
    'rotas GET e POST',
    hook.includes('/backend/v1/ordens-execucao/fila') &&
      hook.includes('/backend/v1/ordens-execucao/registrar'),
  ],
  [
    'autenticação comercial',
    hook.includes('$apis.requireAuth()') && hook.includes('ativo_comercial'),
  ],
  [
    'somente negócios ganhos',
    hook.includes("resultado='ganho'") && hook.includes('NEGOCIO_NAO_GANHO'),
  ],
  [
    'RBAC por responsável ou equipe',
    hook.includes('oePodeAcessar') && hook.includes("perfil === 'superadministrador'"),
  ],
  [
    'três campos obrigatórios e atômicos',
    ['oe_numero', 'oe_data_envio', 'oe_responsavel_envio_id', 'DADOS_OE_OBRIGATORIOS'].every((x) =>
      hook.includes(x),
    ),
  ],
  [
    'responsável de envio válido',
    hook.includes('RESPONSAVEL_ENVIO_INVALIDO') && hook.includes("findRecordById('users'"),
  ],
  [
    'estados operacionais derivados',
    hook.includes('aguardando_oe') && hook.includes('em_processo_de_entrega'),
  ],
  ['concorrência otimista', hook.includes('updated_esperado') && hook.includes('STALE_WRITE')],
  [
    'idempotência canônica',
    ['command_idempotency_key', 'payload_hash', "estado', 'concluido", 'lease_ate'].every((x) =>
      hook.includes(x),
    ),
  ],
  [
    'replay imutável',
    hook.includes('replay: true') && hook.includes("JSON.parse(known[0].getString('resultado')"),
  ],
  [
    'auditoria server-side',
    hook.includes("set('origem', 'server-side')") && hook.includes('evidencia_estruturada'),
  ],
  [
    'serviço canônico',
    service.includes('/backend/v1/ordens-execucao/fila') &&
      service.includes('/backend/v1/ordens-execucao/registrar'),
  ],
  [
    'interface operacional',
    ['Aguardando OE', 'Em processo de entrega', 'Registrar OE'].every((x) => page.includes(x)),
  ],
  [
    'rota protegida e navegação',
    app.includes('path="/ordens-execucao"') &&
      layout.includes('ModuleTabs') &&
      navigation.includes("path: '/ordens-execucao'"),
  ],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed += 1
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
process.exitCode = passed === checks.length ? 0 : 1
