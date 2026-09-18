const fs = require('node:fs')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_ipcp_diario.js'
assert.ok(fs.existsSync(hookPath), 'hook IPCP diário deve existir')

const hook = fs.readFileSync(hookPath, 'utf8')
const routeStart = hook.indexOf("'/backend/v1/nexo/ipcp/diario'")
assert.notEqual(routeStart, -1, 'deve expor GET /backend/v1/nexo/ipcp/diario para o Nexo')
const routeSource = hook.slice(Math.max(0, routeStart - 500), routeStart + 40000)

assert.match(
  routeSource,
  /routerAdd\(\s*'GET',\s*'\/backend\/v1\/nexo\/ipcp\/diario'/,
  'rota deve ser GET',
)
assert.match(routeSource, /\$apis\.requireAuth\('users'\)/, 'rota deve exigir autenticação users')
assert.match(
  routeSource,
  /contrato:\s*'nexo_ipcp_diario_v1'/,
  'deve declarar contrato estável do Nexo',
)
assert.match(routeSource, /read_only:\s*true/, 'deve declarar read_only=true')
assert.match(routeSource, /sem_mutacao:\s*true/, 'deve declarar sem_mutacao=true')
assert.match(
  routeSource,
  /fonte_dados:\s*'com_ipcp_snapshots'/,
  'deve ler a fonte viva controlada com_ipcp_snapshots',
)
assert.match(
  routeSource,
  /findRecordsByFilter\(\s*'com_ipcp_snapshots'/,
  'deve consultar snapshots IPCP vivos',
)
assert.match(
  routeSource,
  /filtroEquipe/,
  'visão de equipe deve tentar snapshot consolidado quando não houver snapshot amarrado ao responsável',
)
assert.match(
  routeSource,
  /effectiveScope|escopo_efetivo/,
  'deve resolver escopo efetivo por perfil',
)
assert.match(routeSource, /canViewTeam|podeVerEquipe/, 'deve proteger visão de equipe')
assert.match(routeSource, /canViewAll|podeVerTodos/, 'deve proteger visão todos')
assert.match(routeSource, /fallback_openai_bloqueado:\s*true/, 'deve bloquear fallback OpenAI')
assert.match(routeSource, /sem_crm_write:\s*true/, 'deve declarar ausência de escrita no CRM')
assert.match(routeSource, /sem_app_write:\s*true/, 'deve declarar ausência de escrita no app')
assert.match(routeSource, /sem_envio:\s*true/, 'deve declarar ausência de envio externo')
assert.match(
  routeSource,
  /payload|resumo|recomendacoes|evidencias/,
  'deve retornar resumo/evidências para o Nexo sem payload técnico bruto',
)
assert.match(
  routeSource,
  /JSON\.parse\(raw|JSON\.parse\(String\(raw\)/,
  'rota do Nexo deve decodificar payload JSON salvo no PocketBase',
)
assert.match(
  routeSource,
  /calcularPacoteIpcpDiarioVivo/,
  'rota do Nexo deve recalcular a leitura viva por escopo no GET',
)
assert.match(
  routeSource,
  /negocios_atencao:\s*pacoteVivo\.negocios_atencao/,
  'rota do Nexo deve devolver negócios de atenção calculados ao vivo, não itens fixos do snapshot',
)
assert.match(
  routeSource,
  /pacoteVivo\.evolucao|evolucao:\s*pacoteVivo/,
  'rota do Nexo deve devolver evolução calculada ao vivo',
)
assert.match(
  routeSource,
  /pacote_completo/,
  'rota do Nexo deve sinalizar pacote completo quando disponível',
)
assert.doesNotMatch(
  routeSource,
  /\$app\.save|\.save\(|\$app\.delete|\.delete\(|\$http\.send\(/,
  'rota viva do Nexo não pode salvar, apagar ou chamar externo',
)
assert.doesNotMatch(
  routeSource,
  /findRecordsByFilter\([^,]+,[^,]+,[^,]+,\s*(500|1000|5000)/,
  'rota deve ter limite conservador de leitura',
)

console.log('nexo-ipcp-diario-vivo contract: PASS')
