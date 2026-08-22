#!/usr/bin/env node
'use strict'

var fs = require('fs')
var path = require('path')
var source = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_qualificacao.js'),
  'utf8',
)
var checks = [
  [
    'rotas GET e POST',
    source.includes("'/backend/v1/qualificacoes/pendentes'") &&
      source.includes("'/backend/v1/qualificacoes/decidir'"),
  ],
  ['autenticação obrigatória', source.includes('$apis.requireAuth()')],
  ['somente usuários comerciais ativos', source.includes("getBool('ativo_comercial')")],
  [
    'idempotência persistida',
    source.includes("'com_idempotencia'") && source.includes("'decidir_qualificacao'"),
  ],
  [
    'replay conhecido é resolvido antes da transação',
    source.indexOf('var replayExistente') < source.indexOf('$app.runInTransaction'),
  ],
  ['concorrência otimista', source.includes('updated_esperado') && source.includes('STALE_WRITE')],
  ['histórico append-only', source.includes("'com_qualificacao_historico'")],
  [
    'auditoria estruturada',
    source.includes("'com_auditoria'") && source.includes("'evidencia_estruturada'"),
  ],
  ['motivo obrigatório para desqualificar', source.includes('MOTIVO_OBRIGATORIO')],
  ['qualificação avança etapa', source.includes("negocio.set('etapa', 'producao_proposta')")],
  [
    'desqualificação encerra sem marcador financeiro',
    source.includes("negocio.set('resultado', 'desqualificado')") &&
      !source.includes("set('valor', 1)"),
  ],
  ['decisão não pode ser repetida', source.includes('JA_DECIDIDO')],
  ['autor sempre derivado da autenticação', source.includes("hist.set('autor_id', ator.id)")],
]
var failed = 0
for (var i = 0; i < checks.length; i++) {
  if (checks[i][1]) console.log('TEST PASS: ' + checks[i][0])
  else {
    failed++
    console.log('TEST FAIL: ' + checks[i][0])
  }
}
console.log('\nRESULTADO: ' + (checks.length - failed) + '/' + checks.length + ' aprovados')
if (failed) process.exit(1)
