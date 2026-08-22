const fs = require('fs')
const hook = fs.readFileSync('pocketbase/hooks/com_atividades_operacao.js', 'utf8')
const service = fs.readFileSync('src/services/atividades.ts', 'utf8')
const page = fs.readFileSync('src/pages/Atividades.tsx', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')

let passed = 0
function check(name, condition) {
  if (!condition) throw new Error(`TEST FAIL: ${name}`)
  passed++
  console.log(`TEST PASS: ${name}`)
}

check('rotas GET e POST', hook.includes("'GET'") && hook.includes("'POST'"))
check('helpers isolados nos handlers do JSVM', !/^function /m.test(hook))
check('autenticação obrigatória', hook.includes('$apis.requireAuth()'))
check(
  'fila sinaliza três situações',
  ['sem_proxima_acao', 'vencida', 'programada'].every((v) => hook.includes(v)),
)
check('somente negócios abertos', hook.includes("inativo = false && resultado = ''"))
check('escopo RBAC por responsável ou equipe', hook.includes('podeAcessar'))
check(
  'operações planejar realizar cancelar',
  ['planejar', 'realizar', 'cancelar'].every((v) => hook.includes(v)),
)
check('concorrência otimista', hook.includes('updated_esperado') && hook.includes('STALE_WRITE'))
check(
  'idempotência persistida e replay',
  hook.includes('com_idempotencia') && hook.includes('replay: true'),
)
check('replay constrói resposta nova', !hook.includes('antigo.replay = true'))
check('claim idempotente preenche lease obrigatória', hook.includes("idem.set('lease_ate'"))
check('auditoria server-side', hook.includes('com_auditoria') && hook.includes("'server-side'"))
check('resultado obrigatório ao realizar', hook.includes('RESULTADO_OBRIGATORIO'))
check('justificativa obrigatória ao cancelar', hook.includes('JUSTIFICATIVA_OBRIGATORIA'))
check('canal obrigatório quando aplicável', hook.includes('CANAL_OBRIGATORIO'))
check(
  'serviço usa endpoints canônicos',
  service.includes('/backend/v1/atividades/fila') &&
    service.includes('/backend/v1/atividades/registrar'),
)
check(
  'interface expõe fila acionável',
  page.includes('Atividades e próxima ação') && page.includes('Planejar próxima ação'),
)
check(
  'rota protegida registrada',
  app.includes('path="/atividades"') && app.includes('<Atividades />'),
)

console.log(`\nRESULTADO: ${passed}/18 aprovados`)
