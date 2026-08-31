routerAdd(
  'POST',
  '/backend/v1/integracao/provelo/recuperar-negocio',
  function (e) {
    var profile = ''
    try {
      profile = $app.findRecordById('com_perfis', e.auth.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (!e.auth.getBool('ativo_comercial') || profile !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')

    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var dealId = String(body.deal_id || '').trim()
    var operationId = String(body.operation_id || '').trim()
    if (!/^[0-9]+$/.test(dealId)) return e.json(400, { error: 'DEAL_ID_INVALIDO' })
    if (!/^[A-Za-z0-9._:-]{8,80}$/.test(operationId))
      return e.json(400, { error: 'OPERATION_ID_INVALIDO' })
    if (String(body.confirmation || '') !== 'RECUPERAR NEGOCIO PROVELO')
      return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
    if (body.zapier_off !== true || body.app_integration_on !== true)
      return e.json(400, { error: 'EXCLUSIVIDADE_DE_CANAL_NAO_CONFIRMADA' })
    if (body.no_crm_mutation !== true || body.single_dispatch !== true)
      return e.json(400, { error: 'ESCOPO_DA_RECUPERACAO_NAO_CONFIRMADO' })

    var config = null
    try {
      config = $app.findFirstRecordByData('com_integracao_provelo', 'provedor', 'make-provelo')
    } catch (_) {}
    if (!config || !config.getBool('habilitada'))
      return e.json(409, { error: 'INTEGRACAO_PROVELO_DESLIGADA' })

    var dispatchKey = $security.sha256('provelo-draft|' + dealId)
    try {
      var priorDispatch = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        dispatchKey,
      )
      return e.json(409, {
        error: 'DISPATCH_JA_REGISTRADO',
        deal_id: dealId,
        status: priorDispatch.getString('status'),
      })
    } catch (_) {}

    var commandKey = $security.sha256('provelo-recovery-command|' + dealId + '|' + operationId)
    try {
      var priorCommand = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        commandKey,
      )
      return e.json(200, {
        deal_id: dealId,
        operation_id: operationId,
        replay: true,
        status: priorCommand.getString('status'),
      })
    } catch (_) {}

    var command = new Record($app.findCollectionByNameOrId('com_eventos_integracao'))
    command.set('sistema_origem', 'provelo')
    command.set('evento_tipo', 'draft_recovery_command')
    command.set('external_id', 'business:' + dealId)
    command.set('idempotency_key', commandKey)
    command.set(
      'payload',
      JSON.stringify({ deal_id: dealId, operation_id: operationId, result: 'pending' }),
    )
    command.set('status', 'pending')
    $app.save(command)

    var pbUrl = String($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var secret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    if (!pbUrl || !secret) {
      command.set('status', 'failed')
      command.set(
        'payload',
        JSON.stringify({ deal_id: dealId, operation_id: operationId, result: 'config_missing' }),
      )
      $app.save(command)
      return e.json(503, { error: 'CONFIGURACAO_SERVIDOR_AUSENTE' })
    }

    var relayBody = 'type=deal_update&deal%5Bid%5D=' + encodeURIComponent(dealId)
    var response
    try {
      response = $http.send({
        url: pbUrl + '/backend/v1/integracao/ac/relay-v1',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-AC-Signature': $security.hs256(relayBody, secret),
        },
        body: relayBody,
        timeout: 30,
      })
    } catch (_) {
      command.set('status', 'uncertain')
      command.set(
        'payload',
        JSON.stringify({ deal_id: dealId, operation_id: operationId, result: 'timeout' }),
      )
      $app.save(command)
      return e.json(502, { error: 'RESULTADO_INCERTO', deal_id: dealId })
    }

    var finalStatus =
      response.statusCode >= 200 && response.statusCode < 300 ? 'processed' : 'failed'
    command.set('status', finalStatus)
    command.set(
      'payload',
      JSON.stringify({
        deal_id: dealId,
        operation_id: operationId,
        result: finalStatus,
        relay_status: response.statusCode,
      }),
    )
    $app.save(command)
    if (finalStatus !== 'processed')
      return e.json(502, {
        error: 'RELAY_RECUSOU_RECUPERACAO',
        deal_id: dealId,
        relay_status: response.statusCode,
      })
    return e.json(200, {
      deal_id: dealId,
      operation_id: operationId,
      replay: false,
      status: 'processed',
    })
  },
  $apis.requireAuth('users'),
  $apis.bodyLimit(8192),
)
