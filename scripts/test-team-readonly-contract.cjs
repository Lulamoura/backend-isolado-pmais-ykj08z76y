const fs = require('node:fs')
const assert = require('node:assert/strict')

const read = (path) => fs.readFileSync(path, 'utf8')
const team = read('pocketbase/hooks/com_negocio_equipe.js')
const proposals = read('pocketbase/hooks/com_propostas_operacao.js')
const closings = read('pocketbase/hooks/com_fechamentos_operacao.js')
const qualification = read('pocketbase/hooks/com_qualificacao.js')
const orders = read('pocketbase/hooks/com_ordens_execucao.js')
const proposalPage = read('src/pages/Propostas.tsx')
const closingPage = read('src/pages/Fechamentos.tsx')
const qualificationPage = read('src/pages/Qualificacoes.tsx')
const ordersPage = read('src/pages/OrdensExecucao.tsx')

assert.ok(team.includes("onRecordCreate(preencherEquipeNegocio, 'com_negocios')"))
assert.ok(team.includes("onRecordUpdate(preencherEquipeNegocio, 'com_negocios')"))
assert.ok(team.includes("'/backend/v1/admin/negocios/equipe-comercial/backfill'"))
assert.ok(team.includes("equipe_id = ''"))
for (const hook of [proposals, closings, qualification, orders]) {
  assert.ok(hook.includes("perfil === 'leitura-executiva'"))
}
assert.ok(proposals.includes("perfil === 'negociacao-propria' || perfil === 'leitura-executiva'"))
assert.ok(closings.includes("{ error: 'SOMENTE_LEITURA' }"))
assert.ok(qualification.includes("perfilRestrito.getString('slug') === 'leitura-executiva'"))
assert.ok(orders.includes("somente_leitura: perfil === 'leitura-executiva'"))
for (const page of [proposalPage, closingPage, qualificationPage, ordersPage]) {
  assert.ok(page.includes("perfilSlug === 'leitura-executiva'"))
}

console.log('PASS team/read-only contract 14/14')
