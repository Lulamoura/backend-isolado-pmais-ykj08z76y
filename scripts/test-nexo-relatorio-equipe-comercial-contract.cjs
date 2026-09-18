const fs = require('node:fs')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_nexo_relatorio_equipe_comercial.js'
assert.ok(fs.existsSync(hookPath), 'hook do relatório da equipe comercial deve existir')

const hook = fs.readFileSync(hookPath, 'utf8')

assert.match(
  hook,
  /routerAdd\(\s*'GET',\s*'\/backend\/v1\/nexo\/relatorios\/equipe-comercial'/,
  'deve expor GET /backend/v1/nexo/relatorios/equipe-comercial',
)
assert.match(hook, /\$apis\.requireAuth\('users'\)/, 'deve exigir autenticação users')
assert.match(hook, /ativo_comercial/, 'deve exigir usuário comercial ativo')
assert.match(hook, /dashboard\.view/, 'deve exigir permissão gerencial dashboard.view')
assert.match(
  hook,
  /directPerfil\.getString\('slug'\) === 'leitura-executiva'[\s\S]*?scope = 'todos'/,
  'perfil direto Leitura Executiva deve ter visão global do time',
)
assert.match(
  hook,
  /perfil\.getString\('slug'\) === 'leitura-executiva'[\s\S]*?scope = 'todos'/,
  'vínculo de equipe com perfil Leitura Executiva deve ter visão global do time',
)
assert.match(hook, /modo:\s*'somente_leitura'/, 'resposta deve declarar modo somente leitura')
assert.match(
  hook,
  /somente leitura: não cria, altera, envia, publica ou sincroniza dados/i,
  'deve declarar governança sem mutação',
)
assert.doesNotMatch(
  hook,
  /\$app\.save|\.save\(|deleteRecord|delete\(|\$http\.send\(/,
  'endpoint não deve salvar, apagar ou chamar integração externa',
)

for (const modalidade of ['recorrente', 'evento', 'serv_eventual']) {
  assert.match(hook, new RegExp(modalidade), `deve tratar modalidade ${modalidade}`)
}
assert.match(hook, /Recorrente/, 'deve rotular Recorrente')
assert.match(hook, /Evento/, 'deve rotular Evento')
assert.match(hook, /Serv\. Eventual/, 'deve rotular Serv. Eventual')

assert.match(
  hook,
  /ganhos\.quantidade,\s*\n\s*ind\.ganhos\.quantidade \+ ind\.perdidos\.quantidade/,
  'taxa de conversão global deve ser ganhos / (ganhos + perdidos)',
)
assert.match(
  hook,
  /ganhos\.valor_centavos,\s*\n\s*ind\.ganhos\.valor_centavos \+ ind\.perdidos\.valor_centavos/,
  'taxa qualitativa por valor deve ser valor ganho / (valor ganho + valor perdido)',
)
assert.match(hook, /html_executivo/, 'deve retornar HTML executivo opcional')
assert.match(hook, /nexo_relatorio_equipe_comercial_v1/, 'deve declarar contrato versionado')
assert.match(hook, /Valores monetários estão em centavos/, 'deve avisar unidade monetária')
assert.doesNotMatch(
  hook,
  /if \(params\.inicio\) parts\.push\("created >=/,
  'período do relatório não deve filtrar todo o relatório por created',
)
assert.match(
  hook,
  /ganhos: 'resultado ganho com fechamento_data dentro do periodo selecionado'/,
  'ganhos devem ser contabilizados por fechamento_data no período',
)
assert.match(
  hook,
  /perdidos:\s*\n?\s*'resultado perdido\/desqualificado com fechamento_data dentro do periodo selecionado'/,
  'perdidos devem ser contabilizados por fechamento_data no período',
)
assert.match(
  hook,
  /abertos: 'sem resultado, criado ate o fim do periodo e ainda ativo no corte'/,
  'abertos devem representar carteira ativa no corte final',
)
assert.match(
  hook,
  /novos_negocios:\s*\n?\s*'crm_created_at quando existir; fallback para created dentro do periodo selecionado'/,
  'novos negócios devem ser métrica separada baseada em crm_created_at, com fallback para created',
)
assert.match(
  hook,
  /campo:\s*'fechamento_data_para_decisoes__carteira_aberta_no_fim__crm_created_at_para_novos'/,
  'payload deve declarar os campos usados em cada métrica',
)
assert.match(hook, /responsavel_id != ''/, 'deve excluir negócios sem responsável comercial')
assert.match(
  hook,
  /etapa != 'prospects' \|\| qualificacao != 'pendente'/,
  'deve excluir negócios ainda em qualificação de prospect',
)
assert.match(
  hook,
  /Negócios em qualificação ou sem responsável comercial não compõem este relatório gerencial/,
  'deve declarar a exclusão de qualificação/sem responsável',
)

console.log('nexo-relatorio-equipe-comercial contract: PASS')
