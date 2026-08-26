#!/usr/bin/env node
'use strict'

var fs = require('fs')
var path = require('path')
var source = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_qualificacao.js'),
  'utf8',
)
var migration = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase', 'migrations', '0006_qualificacao_operacional.js'),
  'utf8',
)
var page = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'Qualificacoes.tsx'),
  'utf8',
)
var proposals = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'Propostas.tsx'),
  'utf8',
)
var schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pocketbase', 'schema.json'), 'utf8'),
)
var negociosSchema = schema.collections.find(function (collection) {
  return collection.name === 'com_negocios'
})
var negocioFieldNames = (negociosSchema && negociosSchema.fields || []).map(function (field) {
  return field.name
})
var checks = [
  [
    'rotas completas da qualificação',
    source.includes("'/backend/v1/qualificacoes/pendentes'") &&
      source.includes("'/backend/v1/qualificacoes/assumir'") &&
      source.includes("'/backend/v1/qualificacoes/atribuir'") &&
      source.includes("'/backend/v1/qualificacoes/decidir'") &&
      source.includes("'/backend/v1/qualificacoes/devolver'"),
  ],
  ['autenticação obrigatória', source.includes('$apis.requireAuth()')],
  ['somente usuários comerciais ativos', source.includes("getBool('ativo_comercial')")],
  [
    'idempotência persistida',
    source.includes("'com_idempotencia'") && source.includes("'decidir_qualificacao'"),
  ],
  [
    'replay conhecido é resolvido antes da transação',
    source.indexOf('var replayExistente') <
      source.indexOf('$app.runInTransaction', source.indexOf('var replayExistente')),
  ],
  ['concorrência otimista', source.includes('updated_esperado') && source.includes('STALE_WRITE')],
  ['histórico append-only', source.includes("'com_qualificacao_historico'")],
  [
    'auditoria estruturada',
    source.includes("'com_auditoria'") && source.includes("'evidencia_estruturada'"),
  ],
  ['motivo obrigatório para desqualificar', source.includes('MOTIVO_OBRIGATORIO')],
  [
    'catálogo canônico com 14 motivos',
    (source.match(/^      '[a-z_]+',$/gm) || []).length >= 14 &&
      source.includes("'contato_invalido_dados_insuficientes'") &&
      source.includes("'desistencia_antes_proposta'") &&
      source.includes("'outro'"),
  ],
  [
    'outro exige justificativa',
    source.includes("motivo === 'outro' && !justificativa"),
  ],
  ['qualificação avança etapa', source.includes("negocio.set('etapa', 'producao_proposta')")],
  [
    'desqualificação encerra sem marcador financeiro',
    source.includes("negocio.set('resultado', 'desqualificado')") &&
      !source.includes("set('valor', 1)"),
  ],
  ['decisão não pode ser repetida', source.includes('JA_DECIDIDO')],
  ['autor sempre derivado da autenticação', source.includes("hist.set('autor_id', ator.id)")],
  [
    'marcador de teste só aceita valor booleano verdadeiro',
    source.includes('body.teste_controlado !== undefined && body.teste_controlado !== true'),
  ],
  [
    'marcador de teste integra idempotência e auditoria',
    source.includes('teste_controlado: body.teste_controlado === true') &&
      (source.match(/teste_controlado: body\.teste_controlado === true/g) || []).length >= 2,
  ],
  ['qualificação nativa não é bloqueada pela pré-operação', !source.includes('PREOPERACAO_SOMENTE_LEITURA')],
  [
    'fila própria inclui não atribuídos e os assumidos pelo operador',
    source.includes("qualificacao_responsavel_id = '' || qualificacao_responsavel_id = '") &&
      source.includes("perfil === 'negociacao-propria'"),
  ],
  [
    'assunção atômica impede trabalho duplicado',
    source.includes("throw new Error('JA_ATRIBUIDA')") &&
      source.includes("negocio.set('qualificacao_responsavel_id', ator.id)"),
  ],
  [
    'operador só decide qualificação assumida',
    source.includes("throw new Error('QUALIFICACAO_NAO_ASSUMIDA')"),
  ],
  [
    'Rita pode atribuir e devolver com auditoria',
    source.includes("perfil !== 'gestor-comercial'") &&
      source.includes("aud.set('comando', 'atribuir_qualificacao')") &&
      source.includes("aud.set('comando', 'devolver_qualificacao')"),
  ],
  [
    'migração persiste responsável e tempos',
    migration.includes('qualificacao_responsavel_id') &&
      migration.includes('qualificacao_assumida_em') &&
      migration.includes('qualificacao_decidida_em'),
  ],
  [
    'manifesto materializa responsável e tempos no runtime',
    negocioFieldNames.includes('qualificacao_responsavel_id') &&
      negocioFieldNames.includes('qualificacao_assumida_em') &&
      negocioFieldNames.includes('qualificacao_decidida_em') &&
      negociosSchema.indexes.some(function (index) {
        return index.includes('idx_com_negocios_qualificacao_responsavel')
      }),
  ],
  [
    'erro de carga não é apresentado como fila vazia',
    page.includes("error ? null : itens.length === 0"),
  ],
  [
    'card exibe contato e botão de assunção',
    page.includes('Contato não informado') &&
      page.includes('E-mail não informado') &&
      page.includes('Telefone não informado') &&
      page.includes('Assumir qualificação'),
  ],
  [
    'gestão recebe indicadores e devolução',
    source.includes('taxa_qualificacao') &&
      page.includes('Acompanhamento por responsável') &&
      proposals.includes('Devolver para Qualificação'),
  ],
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
