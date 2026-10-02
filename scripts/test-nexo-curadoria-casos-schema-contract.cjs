const assert = require('assert')
const fs = require('fs')

const migrationPath = 'pocketbase/migrations/202610012220_nexo_curadoria_comercial_unificada.js'
assert(fs.existsSync(migrationPath), 'migração dos casos unificados deve existir')

const migration = fs.readFileSync(migrationPath, 'utf8')

for (const collection of [
  'com_nexo_curadoria_casos',
  'com_nexo_curadoria_evidencias',
  'com_nexo_curadoria_transicoes',
  'com_nexo_curadoria_outbox',
]) {
  assert(
    migration.includes(`name: '${collection}'`) ||
      migration.includes(`collectionOrNew('${collection}')`),
    `coleção protegida ausente: ${collection}`,
  )
}

for (const field of [
  'fingerprint',
  'revisao',
  'status',
  'fonte_principal',
  'fontes',
  'escopo_tipo',
  'escopo_ref',
  'assunto_chave',
  'recorrencia_chave',
  'titulo',
  'resumo_factual',
  'motivo_curadoria',
  'regra_candidata',
  'evidencia_contagem',
  'casos_independentes',
  'recorrencia_contagem',
  'evidencia_hashes',
  'risco_classe',
  'alcada',
  'sensivel_motivos',
  'confianca',
  'human_review_required',
  'automatic_promotion_allowed',
  'entrevista_respostas',
  'entrevista_etapa',
  'decisao_observacao',
  'validado_por',
  'decisao_em',
  'conhecimento_status',
  'first_seen_at',
  'last_seen_at',
]) {
  assert(
    migration.includes(`name: '${field}'`),
    `campo obrigatório do caso unificado ausente: ${field}`,
  )
}

for (const field of [
  'caso_id',
  'fonte_tipo',
  'fonte_ref',
  'evidencia_hash',
  'resumo_factual',
  'occurred_at',
]) {
  assert(
    migration.includes(`name: '${field}'`),
    `campo obrigatório de evidência/transição ausente: ${field}`,
  )
}

for (const field of [
  'transicao_chave',
  'status_anterior',
  'status_novo',
  'ator_id',
  'motivo',
  'ocorreu_em',
]) {
  assert(
    migration.includes(`name: '${field}'`),
    `campo obrigatório do histórico de transições ausente: ${field}`,
  )
}

for (const field of [
  'acao',
  'idempotency_key',
  'tentativas',
  'payload_hash',
  'payload_json',
  'caso_revisao',
  'requested_at',
  'processed_at',
  'audit_id',
  'target_version',
]) {
  assert(migration.includes(`name: '${field}'`), `campo obrigatório da outbox ausente: ${field}`)
}

assert.match(migration, /CREATE UNIQUE INDEX[^\n]+fingerprint/)
assert.match(migration, /CREATE UNIQUE INDEX[^\n]+caso_id, evidencia_hash/)
assert.match(migration, /CREATE UNIQUE INDEX[^\n]+transicao_chave/)
assert.match(migration, /CREATE UNIQUE INDEX[^\n]+idempotency_key/)

assert.match(
  migration,
  /function collectionOrNew[\s\S]+createRule:\s*null,[\s\S]+updateRule:\s*null,[\s\S]+deleteRule:\s*null,[\s\S]+listRule:\s*null,[\s\S]+viewRule:\s*null/,
)
assert.doesNotMatch(migration, /@request\.auth/)

console.log('nexo-curadoria-casos schema contract: PASS')
