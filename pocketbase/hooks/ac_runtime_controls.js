// T6.AC.8 — materializacao idempotente dos controles da integracao em
// candidatos existentes. O SKIP sincroniza o codigo, mas nao reaplica
// migrations antigas sobre bancos ja provisionados.
routerAdd(
  'POST',
  '/backend/v1/integracao/ac/configuracao/materializar',
  function (e) {
    var actor = e.auth
    if (!actor || !actor.getBool('ativo_comercial'))
      return e.unauthorizedError('Autenticacao necessaria')
    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (slug !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}
    if (body.confirmation !== 'MATERIALIZAR CONTROLES AC')
      return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })

    var controls = [
      ['ac_webhook_enabled', 'false', 'Webhook ActiveCampaign V1 (desligado por padrao)'],
      ['ac_reconciliation_enabled', 'false', 'Reconciliacao ActiveCampaign (desligada por padrao)'],
      [
        'ac_reconciliation_cursor',
        'UNINITIALIZED',
        'Cursor confirmado da reconciliacao ActiveCampaign',
      ],
      ['ac_synthetic_preview_enabled', 'false', 'Canal sintetico T6.AC.8 (desligado por padrao)'],
      [
        'ac_preoperation_read_only',
        'true',
        'Negocios reais importados ficam somente leitura antes do go-live',
      ],
      ['ac_initial_load_scope', 'open_negotiation', 'Pre-carga restrita a aberto + Negociacao'],
    ]
    var created = [],
      preserved = []
    try {
      $app.runInTransaction(function (tx) {
        var collection = tx.findCollectionByNameOrId('com_parametros')
        for (var i = 0; i < controls.length; i++) {
          var current = null
          try {
            current = tx.findFirstRecordByData('com_parametros', 'chave', controls[i][0])
          } catch (_) {}
          if (current) {
            preserved.push(controls[i][0])
            continue
          }
          var record = new Record(collection)
          record.set('chave', controls[i][0])
          record.set('valor', controls[i][1])
          record.set('descricao', controls[i][2])
          record.set('ativo', true)
          record.set('versao', 1)
          tx.save(record)
          created.push(controls[i][0])
        }
      })
    } catch (error) {
      return e.json(409, { error: 'MATERIALIZACAO_REVERTIDA', detail: String(error).slice(0, 160) })
    }
    return e.json(200, {
      status: 'completed',
      created: created,
      preserved: preserved,
      enabled: false,
    })
  },
  $apis.requireAuth('users'),
  $apis.bodyLimit(1024),
)

// T6.AC.8 — abre e fecha exclusivamente o gate sintetico de homologacao.
// A rota nao habilita carga real: o modo incremental continua bloqueado pelo
// cursor UNINITIALIZED e o fechamento restaura esse sentinela na mesma
// transacao que desliga todos os canais temporarios.
routerAdd(
  'POST',
  '/backend/v1/integracao/ac/configuracao/gate-sintetico',
  function (e) {
    var actor = e.auth
    if (!actor || !actor.getBool('ativo_comercial'))
      return e.unauthorizedError('Autenticacao necessaria')
    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (slug !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}
    var allowed = { action: true, confirmation: true, command_idempotency_key: true }
    var bodyKeys = Object.keys(body)
    for (var bk = 0; bk < bodyKeys.length; bk++) {
      if (!allowed[bodyKeys[bk]]) return e.json(400, { error: 'CAMPO_NAO_PERMITIDO' })
    }
    var action = String(body.action || '')
    var expectedConfirmation =
      action === 'open'
        ? 'ABRIR GATE SINTETICO T6.AC.8'
        : action === 'close'
          ? 'FECHAR GATE SINTETICO T6.AC.8'
          : ''
    var commandKey = String(body.command_idempotency_key || '')
    if (
      !expectedConfirmation ||
      body.confirmation !== expectedConfirmation ||
      commandKey.indexOf('t6-ac8-gate-') !== 0 ||
      commandKey.length > 128
    )
      return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })

    var idempotencyKey = $security.sha256('synthetic-gate|' + commandKey)
    var repeated = null
    try {
      repeated = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        idempotencyKey,
      )
    } catch (_) {}
    if (repeated) {
      var replayPayload = {}
      try {
        replayPayload = JSON.parse(repeated.getString('payload') || '{}')
      } catch (_) {}
      replayPayload.replay = true
      replayPayload.status = 'replayed'
      return e.json(200, replayPayload)
    }

    var result = null,
      txError = ''
    try {
      $app.runInTransaction(function (tx) {
        var webhook = tx.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
        var reconciliation = tx.findFirstRecordByData(
          'com_parametros',
          'chave',
          'ac_reconciliation_enabled',
        )
        var synthetic = tx.findFirstRecordByData(
          'com_parametros',
          'chave',
          'ac_synthetic_preview_enabled',
        )
        var cursor = tx.findFirstRecordByData('com_parametros', 'chave', 'ac_reconciliation_cursor')
        if (action === 'open' && cursor.getString('valor') !== 'UNINITIALIZED')
          throw new Error('CURSOR_FORA_DO_ESTADO_INICIAL')

        var enabled = action === 'open'
        webhook.set('valor', enabled ? 'true' : 'false')
        reconciliation.set('valor', enabled ? 'true' : 'false')
        synthetic.set('valor', enabled ? 'true' : 'false')
        if (!enabled) cursor.set('valor', 'UNINITIALIZED')
        tx.save(webhook)
        tx.save(reconciliation)
        tx.save(synthetic)
        tx.save(cursor)

        result = {
          action: action,
          status: 'completed',
          replay: false,
          synthetic_gate_enabled: enabled,
          webhook_enabled: enabled,
          reconciliation_enabled: enabled,
          cursor: cursor.getString('valor'),
        }
        var audit = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
        audit.set('sistema_origem', 'activecampaign')
        audit.set('evento_tipo', enabled ? 'synthetic_gate_open' : 'synthetic_gate_close')
        audit.set('external_id', 't6-ac8-synthetic-gate')
        audit.set('idempotency_key', idempotencyKey)
        audit.set(
          'payload',
          JSON.stringify({
            action: result.action,
            status: result.status,
            replay: result.replay,
            synthetic_gate_enabled: result.synthetic_gate_enabled,
            webhook_enabled: result.webhook_enabled,
            reconciliation_enabled: result.reconciliation_enabled,
            cursor: result.cursor,
            actor_id: actor.id,
          }).slice(0, 4000),
        )
        audit.set('status', 'processed')
        tx.save(audit)
      })
    } catch (error) {
      txError = String(error).slice(0, 200)
    }
    if (txError) return e.json(409, { error: 'GATE_SINTETICO_REVERTIDO', detail: txError })
    return e.json(200, result)
  },
  $apis.requireAuth('users'),
  $apis.bodyLimit(1024),
)
