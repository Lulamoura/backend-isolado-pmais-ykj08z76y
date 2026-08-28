const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const webhook = fs.readFileSync(path.join(__dirname, '../pocketbase/hooks/ac_webhook.js'), 'utf8')
const reconciler = fs.readFileSync(
  path.join(__dirname, '../pocketbase/hooks/com_ac_reconciliacao.js'),
  'utf8',
)
const relay = fs.readFileSync(
  path.join(__dirname, '../pocketbase/hooks/ac_native_relay.js'),
  'utf8',
)

// 1. Simulação unitária do extrator de data e meta ID 42 (lógica de ac_native_relay e com_ac_reconciliacao)
function extractRecoveryAt(customMetaRows, customDataRows, dealId) {
  const labels = {}
  for (let i = 0; i < customMetaRows.length; i++) {
    labels[String(customMetaRows[i].id)] = String(customMetaRows[i].fieldLabel || '').trim()
  }
  const customMap = {}
  for (let i = 0; i < customDataRows.length; i++) {
    if (String(customDataRows[i].dealId || '') !== String(dealId)) continue
    const fieldId = String(customDataRows[i].customFieldId || '')
    const fieldVal = String(customDataRows[i].fieldValue || '').trim()
    if (fieldId) customMap['meta:' + fieldId] = fieldVal
    const label = labels[fieldId] || ''
    if (label) customMap[label] = fieldVal
  }
  return customMap['meta:42'] || customMap['Data de Recuperação Comercial'] || ''
}

// 2. Simulação unitária da criação / atualização de agenda (lógica de ac_webhook e com_ac_reconciliacao)
function processDealRecoveryAgenda({
  dealStatus,
  stage,
  recoveryAt,
  responsibleId,
  dealId,
  existingAgenda = null,
}) {
  function actionDateKey(value) {
    const text = String(value || '').trim()
    const civilDate = text.match(/^(\d{4}-\d{2}-\d{2})/)
    if (civilDate) return civilDate[1]
    const timestamp = Date.parse(text)
    return isNaN(timestamp) ? text : new Date(timestamp).toISOString().slice(0, 10)
  }

  const isProspect = String(stage || '') === 'prospects'
  const resultado = dealStatus === '1' ? 'ganho' : isProspect ? 'desqualificado' : 'perdido'

  if (resultado !== 'perdido' || !actionDateKey(recoveryAt) || !responsibleId) {
    return { agendaCreated: false, agendaUpdated: false, agenda: null }
  }

  const recoveryDate = actionDateKey(recoveryAt)
  const recoveryKey = 'activecampaign:recovery:' + dealId
  const recoveryContext = JSON.stringify({
    origem: 'activecampaign',
    campo: 'Data de Recuperação Comercial',
    external_deal_id: String(dealId),
  })

  if (existingAgenda) {
    // Replay / Update
    const updated = {
      ...existingAgenda,
      data_alvo: recoveryDate,
      antecedencia_dias: 60,
      responsavel_id: responsibleId,
      autor_id: responsibleId,
      estado: 'ativa',
      contexto: recoveryContext,
    }
    return { agendaCreated: false, agendaUpdated: true, agenda: updated, replay: true }
  }

  const newAgenda = {
    negocio_perdido_id: 'negocio_' + dealId,
    data_alvo: recoveryDate,
    antecedencia_dias: 60,
    responsavel_id: responsibleId,
    autor_id: responsibleId,
    estado: 'ativa',
    contexto: recoveryContext,
    creation_idempotency_key: recoveryKey,
  }
  return { agendaCreated: true, agendaUpdated: false, agenda: newAgenda, replay: false }
}

// ================= TEST SUITE =================

console.log('Iniciando testes de recuperação comercial e agenda ActiveCampaign...')

// TEST 1: meta ID 42 funciona canonicamente mesmo se o rótulo variar
{
  const customMetaWithAlternativeLabel = [{ id: 42, fieldLabel: 'Data Recuperacao (Outro Rotulo)' }]
  const customData = [{ dealId: '4392', customFieldId: 42, fieldValue: '2026-08-28' }]

  const extracted = extractRecoveryAt(customMetaWithAlternativeLabel, customData, '4392')
  assert.equal(extracted, '2026-08-28', 'Meta ID 42 deve prevalecer sobre o rótulo')
  console.log('✓ PASS: Meta ID 42 funciona mesmo com rótulo alternativo')
}

// TEST 2: Fallback por rótulo 'Data de Recuperação Comercial' caso meta ID não seja 42
{
  const customMetaLegacy = [{ id: 99, fieldLabel: 'Data de Recuperação Comercial' }]
  const customData = [{ dealId: '4392', customFieldId: 99, fieldValue: '2026-08-28' }]

  const extracted = extractRecoveryAt(customMetaLegacy, customData, '4392')
  assert.equal(extracted, '2026-08-28', 'Fallback por rótulo deve funcionar')
  console.log('✓ PASS: Fallback por rótulo funciona quando ID difere')
}

// TEST 3: Perdido + data válida cria agenda com antecedência 60
{
  const result = processDealRecoveryAgenda({
    dealStatus: '2',
    stage: 'negociacao',
    recoveryAt: '2026-08-28',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
  })

  assert.equal(result.agendaCreated, true)
  assert.notEqual(result.agenda, null)
  assert.equal(result.agenda.data_alvo, '2026-08-28')
  assert.equal(result.agenda.antecedencia_dias, 60, 'Antecedência deve ser 60')
  assert.equal(result.agenda.responsavel_id, 'user_vendedor_1')
  assert.equal(result.agenda.estado, 'ativa')
  assert.equal(result.agenda.creation_idempotency_key, 'activecampaign:recovery:4392')
  console.log('✓ PASS: Perdido + data cria agenda com antecedência 60')
}

// TEST 4: Replay não duplica agenda (atualiza a existente com idempotência e antecedência 60)
{
  const initial = processDealRecoveryAgenda({
    dealStatus: '2',
    stage: 'negociacao',
    recoveryAt: '2026-08-28',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
  })

  const replay = processDealRecoveryAgenda({
    dealStatus: '2',
    stage: 'negociacao',
    recoveryAt: '2026-08-28',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
    existingAgenda: initial.agenda,
  })

  assert.equal(replay.agendaCreated, false)
  assert.equal(replay.agendaUpdated, true)
  assert.equal(replay.replay, true)
  assert.equal(replay.agenda.antecedencia_dias, 60)
  assert.equal(replay.agenda.creation_idempotency_key, 'activecampaign:recovery:4392')
  console.log('✓ PASS: Replay é idempotente e preserva antecedência 60 sem duplicar')
}

// TEST 5: Data vazia não cria agenda
{
  const emptyDateResult = processDealRecoveryAgenda({
    dealStatus: '2',
    stage: 'negociacao',
    recoveryAt: '',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
  })

  assert.equal(emptyDateResult.agendaCreated, false)
  assert.equal(emptyDateResult.agenda, null)
  console.log('✓ PASS: Data vazia não cria agenda')
}

// TEST 6: Negócio não perdido (ex: aberto ou ganho ou desqualificado) não cria agenda
{
  // Aberto
  const openResult = processDealRecoveryAgenda({
    dealStatus: '0',
    stage: 'negociacao',
    recoveryAt: '2026-08-28',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
  })
  assert.equal(openResult.agendaCreated, false)
  assert.equal(openResult.agenda, null)

  // Ganho
  const wonResult = processDealRecoveryAgenda({
    dealStatus: '1',
    stage: 'negociacao',
    recoveryAt: '2026-08-28',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
  })
  assert.equal(wonResult.agendaCreated, false)
  assert.equal(wonResult.agenda, null)

  // Desqualificado (status 2 em prospects)
  const disqualifiedResult = processDealRecoveryAgenda({
    dealStatus: '2',
    stage: 'prospects',
    recoveryAt: '2026-08-28',
    responsibleId: 'user_vendedor_1',
    dealId: '4392',
  })
  assert.equal(disqualifiedResult.agendaCreated, false)
  assert.equal(disqualifiedResult.agenda, null)

  console.log('✓ PASS: Negócio não perdido (aberto/ganho/desqualificado) não cria agenda')
}

// TEST 7: Validação estática nos hooks
{
  // webhook.js
  assert.ok(
    webhook.includes("existingAgenda.set('antecedencia_dias', 60)") &&
      webhook.includes("newAgenda.set('antecedencia_dias', 60)"),
    'ac_webhook.js deve usar antecedencia_dias = 60',
  )
  assert.ok(
    !webhook.includes("existingAgenda.set('antecedencia_dias', 0)") &&
      !webhook.includes("newAgenda.set('antecedencia_dias', 0)"),
    'ac_webhook.js não deve ter antecedencia_dias = 0',
  )

  // com_ac_reconciliacao.js
  assert.ok(
    reconciler.includes("existingAgenda.set('antecedencia_dias', 60)") &&
      reconciler.includes("newAgenda.set('antecedencia_dias', 60)"),
    'com_ac_reconciliacao.js deve usar antecedencia_dias = 60',
  )
  assert.ok(
    !reconciler.includes("existingAgenda.set('antecedencia_dias', 0)") &&
      !reconciler.includes("newAgenda.set('antecedencia_dias', 0)"),
    'com_ac_reconciliacao.js não deve ter antecedencia_dias = 0',
  )
  assert.ok(
    reconciler.includes("customFields['meta:42'] || customFields['Data de Recuperação Comercial']"),
    'com_ac_reconciliacao.js deve ler canonicamente meta:42 com fallback para rótulo',
  )

  // ac_native_relay.js
  assert.ok(
    relay.includes("customByLabel['meta:42'] || customByLabel['Data de Recuperação Comercial']"),
    'ac_native_relay.js deve ler canonicamente meta:42 com fallback para rótulo',
  )
  console.log('✓ PASS: Asserções estáticas de código nos 3 hooks')
}

console.log('\nTodos os 7 testes de recuperação comercial passaram com sucesso!')
