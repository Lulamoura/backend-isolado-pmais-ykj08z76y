// Controle administrativo estreito dos gates da proposta nativa.
// Somente SuperAdministrador ativo pode alterar um gate por comando,
// com confirmação explícita, concorrência otimista, idempotência e auditoria.
routerAdd(
  'POST',
  '/backend/v1/propostas/configuracao/gate',
  function (e) {
    var actor = e.auth
    if (!actor || !actor.getBool('ativo_comercial'))
      return e.unauthorizedError('Autenticacao necessaria')

    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}
    var allowed = {
      chave: true,
      valor: true,
      justificativa: true,
      updated_esperado: true,
      confirmation: true,
      command_idempotency_key: true,
    }
    var bodyKeys = Object.keys(body)
    for (var i = 0; i < bodyKeys.length; i++)
      if (!allowed[bodyKeys[i]]) return e.json(400, { error: 'CAMPO_NAO_PERMITIDO' })

    var gateKeys = {
      'proposta.pagina_publica_habilitada': true,
      'proposta.email_habilitado': true,
    }
    var chave = String(body.chave || '')
    var valor = body.valor
    var justificativa = String(body.justificativa || '').trim()
    var updatedEsperado = String(body.updated_esperado || '')
    var commandKey = String(body.command_idempotency_key || '')
    var expectedConfirmation = valor === true ? 'ABRIR GATE DE PROPOSTA' : 'FECHAR GATE DE PROPOSTA'
    if (
      !gateKeys[chave] ||
      typeof valor !== 'boolean' ||
      justificativa.length < 12 ||
      !updatedEsperado ||
      body.confirmation !== expectedConfirmation ||
      commandKey.indexOf('proposal-gate-') !== 0 ||
      commandKey.length > 128
    )
      return e.json(400, { error: 'VALIDATION' })

    var idempotencyKey = $security.sha256('proposal-gate|' + commandKey)
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
      transactionError = ''
    try {
      $app.runInTransaction(function (tx) {
        var parametro = tx.findFirstRecordByData('com_parametros', 'chave', chave)
        if (parametro.getString('updated') !== updatedEsperado) throw new Error('STALE_WRITE')

        var anterior = parametro.getString('valor') === 'true'
        parametro.set('valor', valor ? 'true' : 'false')
        parametro.set('ativo', true)
        parametro.set('versao', Math.max(1, parametro.getInt('versao') + 1))
        tx.save(parametro)

        result = {
          chave: chave,
          valor: valor,
          anterior: anterior,
          changed: anterior !== valor,
          status: 'completed',
          replay: false,
        }

        var audit = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        audit.set('collection_name', 'com_parametros')
        audit.set('record_id', parametro.id)
        audit.set('acao', 'update')
        audit.set('usuario_id', actor.id)
        audit.set('comando', 'alterar_gate_proposta')
        audit.set('command_idempotency_key', commandKey)
        audit.set('evento_em', new Date())
        audit.set('justificativa', justificativa)
        audit.set('perfil', perfil)
        audit.set('escopo', 'configuracao')
        audit.set('origem', 'server-side')
        audit.set('evidencia_estruturada', result)
        audit.set('snapshot_hash', $security.sha256(JSON.stringify(result)))
        audit.set('snapshot_hash_versao', '1')
        audit.set('sequencia', parametro.getInt('versao'))
        tx.save(audit)

        var event = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
        event.set('sistema_origem', 'aplicativo_comercial_pmais')
        event.set('evento_tipo', 'proposal_gate_control')
        event.set('external_id', chave)
        event.set('idempotency_key', idempotencyKey)
        event.set('payload', JSON.stringify(result))
        event.set('status', 'processed')
        tx.save(event)
      })
    } catch (error) {
      transactionError = String(error)
    }
    if (transactionError.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (transactionError) return e.json(409, { error: 'GATE_CONTROL_REVERTED' })

    var saved = $app.findFirstRecordByData('com_parametros', 'chave', chave)
    result.updated = saved.getString('updated')
    result.versao = saved.getInt('versao')
    return e.json(200, result)
  },
  $apis.requireAuth('users'),
  $apis.bodyLimit(2048),
)

routerAdd(
  'POST',
  '/backend/v1/propostas/configuracao/identificacao',
  function (e) {
    var actor = e.auth
    if (!actor || !actor.getBool('ativo_comercial'))
      return e.unauthorizedError('Autenticacao necessaria')

    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}
    var allowed = {
      obrigatoria: true,
      justificativa: true,
      updated_esperado: true,
      confirmation: true,
      command_idempotency_key: true,
    }
    var bodyKeys = Object.keys(body)
    for (var i = 0; i < bodyKeys.length; i++)
      if (!allowed[bodyKeys[i]]) return e.json(400, { error: 'CAMPO_NAO_PERMITIDO' })

    var obrigatoria = body.obrigatoria
    var justificativa = String(body.justificativa || '').trim()
    var updatedEsperado = String(body.updated_esperado || '')
    var commandKey = String(body.command_idempotency_key || '')
    if (
      typeof obrigatoria !== 'boolean' ||
      justificativa.length < 12 ||
      !updatedEsperado ||
      body.confirmation !== 'ALTERAR IDENTIFICACAO DE VISITANTE' ||
      commandKey.indexOf('proposal-visitor-config-') !== 0 ||
      commandKey.length > 128
    )
      return e.json(400, { error: 'VALIDATION' })

    var idempotencyKey = $security.sha256('proposal-visitor-config|' + commandKey)
    try {
      var repeated = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        idempotencyKey,
      )
      var replayPayload = JSON.parse(repeated.getString('payload') || '{}')
      replayPayload.replay = true
      replayPayload.status = 'replayed'
      return e.json(200, replayPayload)
    } catch (_) {}

    var result = null,
      transactionError = ''
    try {
      $app.runInTransaction(function (tx) {
        var parametro = tx.findFirstRecordByData(
          'com_parametros',
          'chave',
          'proposta.identificacao_visitante_obrigatoria',
        )
        if (parametro.getString('updated') !== updatedEsperado) throw new Error('STALE_WRITE')

        var anterior = parametro.getString('valor') === 'true'
        parametro.set('valor', obrigatoria ? 'true' : 'false')
        parametro.set('ativo', true)
        parametro.set('versao', Math.max(1, parametro.getInt('versao') + 1))
        parametro.set('justificativa', justificativa)
        tx.save(parametro)

        result = {
          chave: 'proposta.identificacao_visitante_obrigatoria',
          obrigatoria: obrigatoria,
          anterior: anterior,
          changed: anterior !== obrigatoria,
          status: 'completed',
          replay: false,
        }

        var audit = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        audit.set('collection_name', 'com_parametros')
        audit.set('record_id', parametro.id)
        audit.set('acao', 'update')
        audit.set('usuario_id', actor.id)
        audit.set('comando', 'alterar_identificacao_visitante_proposta')
        audit.set('command_idempotency_key', commandKey)
        audit.set('evento_em', new Date())
        audit.set('justificativa', justificativa)
        audit.set('perfil', perfil)
        audit.set('escopo', 'configuracao')
        audit.set('origem', 'server-side')
        audit.set('evidencia_estruturada', result)
        audit.set('snapshot_hash', $security.sha256(JSON.stringify(result)))
        audit.set('snapshot_hash_versao', '1')
        audit.set('sequencia', parametro.getInt('versao'))
        tx.save(audit)

        var event = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
        event.set('sistema_origem', 'aplicativo_comercial_pmais')
        event.set('evento_tipo', 'proposal_visitor_config')
        event.set('external_id', 'proposta.identificacao_visitante_obrigatoria')
        event.set('idempotency_key', idempotencyKey)
        event.set('payload', JSON.stringify(result))
        event.set('status', 'processed')
        tx.save(event)
      })
    } catch (error) {
      transactionError = String(error)
    }
    if (transactionError.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (transactionError) return e.json(409, { error: 'VISITOR_CONFIG_REVERTED' })

    var saved = $app.findFirstRecordByData(
      'com_parametros',
      'chave',
      'proposta.identificacao_visitante_obrigatoria',
    )
    result.updated = saved.getString('updated')
    result.versao = saved.getInt('versao')
    return e.json(200, result)
  },
  $apis.requireAuth('users'),
  $apis.bodyLimit(2048),
)
