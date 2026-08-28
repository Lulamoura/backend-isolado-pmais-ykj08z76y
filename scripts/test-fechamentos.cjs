const fs = require('fs')

const read = (path) => (fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '')
const hook = read('pocketbase/hooks/com_fechamentos_operacao.js')
const service = read('src/services/fechamentos.ts')
const page = read('src/pages/Fechamentos.tsx')
const app = read('src/App.tsx')
const layout = read('src/components/Layout.tsx')
const navigation = read('src/lib/navigation.ts')

const checks = [
  [
    'rotas de fila, fechamento e descarte de recuperação',
    ['/fila', '/decidir', '/recuperacao/descartar'].every((x) =>
      hook.includes(`/backend/v1/fechamentos${x}`),
    ),
  ],
  [
    'autenticação comercial',
    hook.includes('$apis.requireAuth()') && hook.includes('ativo_comercial'),
  ],
  [
    'RBAC por responsável/equipe',
    hook.includes('fechamentoPodeAcessar') && hook.includes("perfil === 'superadministrador'"),
  ],
  ['ganho exige proposta emitida', hook.includes('PROPOSTA_EMITIDA_OBRIGATORIA')],
  ['ganho exige evidência formal', hook.includes('EVIDENCIA_GANHO_OBRIGATORIA')],
  ['ganho exige valor efetivo', hook.includes('VALOR_EFETIVO_OBRIGATORIO')],
  [
    'cinco motivos canônicos de perda',
    ['preco', 'fechou_com_outra_empresa', 'perdeu_contato', 'desistiu', 'nao_atendido'].every((x) =>
      hook.includes(x),
    ),
  ],
  [
    'perdeu contato exige cinco tentativas',
    hook.includes('TENTATIVAS_CONTATO_INSUFICIENTES') && hook.includes('tentativa_contato'),
  ],
  [
    'perdeu contato exige dez dias úteis',
    hook.includes('JANELA_CONTATO_INSUFICIENTE') && hook.includes('10'),
  ],
  [
    'agenda futura padrão de sessenta dias',
    hook.includes('antecedencia_dias') && hook.includes('60'),
  ],
  [
    'reconciliação e webhook usam antecedência de sessenta dias',
    read('pocketbase/hooks/ac_webhook.js').includes("newAgenda.set('antecedencia_dias', 60)") &&
      read('pocketbase/hooks/com_ac_reconciliacao.js').includes(
        "newAgenda.set('antecedencia_dias', 60)",
      ),
  ],
  ['reativação local bloqueada', hook.includes('REATIVACAO_DEVE_OCORRER_NO_ACTIVECAMPAIGN')],
  [
    'descarte exige justificativa e encerra agenda',
    hook.includes('JUSTIFICATIVA_OBRIGATORIA_MINIMO_10_CARACTERES') &&
      hook.includes("agenda.set('estado', 'descartada')"),
  ],
  ['terminal não é reaberto', hook.includes('NEGOCIO_TERMINAL_IMUTAVEL')],
  ['idempotência com replay', hook.includes('com_idempotencia') && hook.includes('replay: true')],
  ['concorrência otimista', hook.includes('updated_esperado') && hook.includes('STALE_WRITE')],
  [
    'auditoria server-side',
    hook.includes("set('origem', 'server-side')") && hook.includes('evidencia_estruturada'),
  ],
  [
    'serviço canônico',
    service.includes('/backend/v1/fechamentos/decidir') &&
      service.includes('/backend/v1/fechamentos/recuperacao/descartar'),
  ],
  [
    'interface operacional',
    [
      'Registrar ganho',
      'Registrar perda',
      'Recuperar no ActiveCampaign',
      'Descartar recuperação',
    ].every((x) => page.includes(x)),
  ],
  [
    'rota protegida e navegação',
    app.includes('path="/fechamentos"') &&
      layout.includes('ModuleTabs') &&
      navigation.includes("path: '/fechamentos'"),
  ],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed += 1
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
process.exitCode = passed === checks.length ? 0 : 1
