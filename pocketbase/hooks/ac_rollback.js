routerAdd(
  'POST',
  '/backend/v1/integracao/ac/rollback',
  (e) => {
    // ═══ ACTIVATION FLAG ═══
    var ROLLBACK_ENABLED = false
    try {
      var _flagParam = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
      if (_flagParam && _flagParam.getString('valor') === 'true' && _flagParam.getBool('ativo'))
        ROLLBACK_ENABLED = true
    } catch (_) {}
    if (!ROLLBACK_ENABLED) {
      return e.json(503, {
        error: 'Rollback desabilitado',
        stage: 'porta-2d-etapa-2a',
        enabled: false,
      })
    }

    // ═══ AUTH: superadministrator required ═══
    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')

    var isSuperAdmin = false
    try {
      var authPerfilId = e.auth.getString('perfil_id')
      if (authPerfilId) {
        var perfilRec = $app.findRecordById('com_perfis', authPerfilId)
        if (perfilRec.getString('slug') === 'superadministrador') isSuperAdmin = true
      }
    } catch (_) {}
    if (!isSuperAdmin) {
      try {
        var saPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        if (saPerfil) {
          var saBindings = $app.findRecordsByFilter(
            'com_usuarios_equipes',
            "usuario_id = '" + authId + "' && perfil_id = '" + saPerfil.id + "' && ativo = true",
            '',
            1,
            0,
          )
          if (saBindings && saBindings.length > 0) isSuperAdmin = true
        }
      } catch (_) {}
    }
    if (!isSuperAdmin) return e.forbiddenError('Apenas superadministrador pode executar rollback')

    // ═══ BODY SIZE: early rejection via Content-Length ═══
    var contentLength = parseInt(e.request.header.get('Content-Length') || '0', 10)
    if (contentLength > 262144) {
      return e.badRequestError('Corpo da requisicao excede o limite de 256KB')
    }

    // ═══ RAW BODY ═══
    var rawBody = toString(e.request.body)
    if (!rawBody) {
      return e.badRequestError('Corpo da requisicao vazio')
    }

    // ═══ SIGNATURE: identical contract to approved ac_webhook.js ═══
    var signature = e.request.header.get('X-AC-Signature') || ''
    if (!signature) {
      return e.json(401, { error: 'missing_signature', message: 'Assinatura ausente' })
    }

    var hexPattern = /^[0-9a-fA-F]{64}$/
    if (!hexPattern.test(signature)) {
      return e.json(401, {
        error: 'invalid_signature_format',
        message: 'Assinatura deve ser uma string hexadecimal de 64 caracteres',
      })
    }

    signature = signature.toLowerCase()

    var webhookSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    if (!webhookSecret) {
      $app.logger().error('AC_WEBHOOK_SECRET not configured')
      return e.internalServerError('Configuracao do servidor ausente')
    }

    var expectedSig = $security.hs256(rawBody, webhookSecret)

    if (expectedSig.length !== signature.length) {
      return e.json(401, { error: 'invalid_signature', message: 'Assinatura invalida' })
    }
    var sigDiff = 0
    for (var si = 0; si < expectedSig.length; si++) {
      sigDiff |= expectedSig.charCodeAt(si) ^ signature.charCodeAt(si)
    }
    if (sigDiff !== 0) {
      return e.json(401, { error: 'invalid_signature', message: 'Assinatura invalida' })
    }

    // ═══ PARSE BODY ═══
    var body
    try {
      body = JSON.parse(rawBody)
    } catch (parseErr) {
      return e.badRequestError('Corpo da requisicao nao e JSON valido')
    }

    // ═══ TIMESTAMP: validate before any persistence ═══
    var eventTimestamp = body.timestamp || body.ts || ''
    if (!eventTimestamp) {
      return e.badRequestError('Timestamp obrigatorio ausente')
    }
    var eventTime = new Date(eventTimestamp).getTime()
    if (isNaN(eventTime)) {
      return e.badRequestError('Timestamp invalido')
    }
    if (Math.abs(Date.now() - eventTime) > 300000) {
      return e.badRequestError('Evento fora da janela de tempo permitida (5 minutos)')
    }

    // ═══ ENTITY TYPE GATE: only "business" accepted ═══
    var entityType = body.entity_type || ''
    if (entityType !== 'business') {
      return e.json(400, {
        error: 'invalid_entity_type',
        message: 'Apenas entity_type = "business" e aceito para rollback',
      })
    }

    var externalId = body.external_id || ''
    if (!externalId) {
      return e.badRequestError('external_id e obrigatorio')
    }

    var sistemaOrigem = 'activecampaign'

    // ═══ BINDING CONTRACT: exactly one, no loop ═══
    var bindingFilter =
      "sistema_origem = '" +
      sistemaOrigem +
      "'" +
      " && external_type = 'business'" +
      " && external_id = '" +
      externalId +
      "'" +
      " && collection_name = 'com_negocios'"

    var bindings = []
    try {
      bindings = $app.findRecordsByFilter('com_vinculos_externos', bindingFilter, '-created', 2, 0)
    } catch (_) {}

    if (bindings.length === 0) {
      return e.json(404, {
        error: 'Nenhum vinculo compativel encontrado',
        message:
          'Zero bindings para sistema_origem=activecampaign, external_type=business, external_id=' +
          externalId +
          ', collection_name=com_negocios',
      })
    }
    if (bindings.length > 1) {
      return e.json(409, {
        error: 'Multiplos vinculos compativeis encontrados',
        message: 'Esperado exatamente 1 binding, encontrado ' + bindings.length,
      })
    }

    var bindingRecordId = bindings[0].getString('record_id')

    // ═══ SINGLE ATOMIC TRANSACTION ═══
    var idempotentRepeat = false
    var txError = null

    try {
      $app.runInTransaction(function (txApp) {
        // Re-read binding inside transaction
        var txBindings = txApp.findRecordsByFilter(
          'com_vinculos_externos',
          bindingFilter,
          '-created',
          2,
          0,
        )

        if (txBindings.length === 0) {
          throw new Error('BINDING_NOT_FOUND')
        }
        if (txBindings.length > 1) {
          throw new Error('BINDING_MULTIPLE')
        }

        var txRecordId = txBindings[0].getString('record_id')

        // Read business record inside transaction
        var negocio = null
        try {
          negocio = txApp.findRecordById('com_negocios', txRecordId)
        } catch (_) {}

        if (!negocio) {
          throw new Error('BUSINESS_NOT_FOUND')
        }

        // Read most recent snapshot inside transaction
        var snapshots = []
        try {
          snapshots = txApp.findRecordsByFilter(
            'com_snapshots_negocio',
            "negocio_id = '" + txRecordId + "'",
            '-created',
            1,
            0,
          )
        } catch (_) {}

        if (snapshots.length === 0) {
          throw new Error('SNAPSHOT_NOT_FOUND')
        }

        var snapshotId = snapshots[0].id
        var snapData = JSON.parse(snapshots[0].getString('snapshot') || '{}')

        // Deterministic idempotency key (no Date.now())
        var idempotencyKey = $security.sha256(
          sistemaOrigem +
            '|rollback|' +
            entityType +
            '|' +
            externalId +
            '|' +
            txRecordId +
            '|' +
            snapshotId,
        )

        // Check existing compensation event inside transaction
        var existingCompEvent = null
        try {
          existingCompEvent = txApp.findFirstRecordByData(
            'com_eventos_integracao',
            'idempotency_key',
            idempotencyKey,
          )
        } catch (_) {}

        if (existingCompEvent) {
          idempotentRepeat = true
          return
        }

        // Restore business from snapshot — preserve zero/empty by property presence
        if (Object.prototype.hasOwnProperty.call(snapData, 'titulo')) {
          negocio.set('titulo', snapData.titulo)
        }
        if (Object.prototype.hasOwnProperty.call(snapData, 'valor')) {
          negocio.set('valor', snapData.valor)
        }
        if (Object.prototype.hasOwnProperty.call(snapData, 'etapa')) {
          negocio.set('etapa', snapData.etapa)
        }
        if (Object.prototype.hasOwnProperty.call(snapData, 'resultado')) {
          negocio.set('resultado', snapData.resultado)
        }
        txApp.save(negocio)

        // Create exactly one compensation event
        var evCol = txApp.findCollectionByNameOrId('com_eventos_integracao')
        var compEv = new Record(evCol)
        compEv.set('sistema_origem', sistemaOrigem)
        compEv.set('evento_tipo', 'rollback')
        compEv.set('external_id', externalId)
        compEv.set('idempotency_key', idempotencyKey)
        compEv.set(
          'payload',
          JSON.stringify({
            operation: 'rollback',
            entity_type: entityType,
            external_id: externalId,
            record_id: txRecordId,
            snapshot_id: snapshotId,
          }),
        )
        compEv.set('status', 'rollback_executed')
        txApp.save(compEv)
      })
    } catch (err) {
      txError = String(err).substring(0, 500)
    }

    // ═══ HANDLE TRANSACTION ERRORS ═══
    if (txError) {
      if (txError.indexOf('BINDING_NOT_FOUND') !== -1) {
        return e.json(404, { error: 'Vinculo nao encontrado dentro da transacao' })
      }
      if (txError.indexOf('BINDING_MULTIPLE') !== -1) {
        return e.json(409, { error: 'Multiplos vinculos encontrados dentro da transacao' })
      }
      if (txError.indexOf('BUSINESS_NOT_FOUND') !== -1) {
        return e.json(404, { error: 'Negocio vinculado nao encontrado' })
      }
      if (txError.indexOf('SNAPSHOT_NOT_FOUND') !== -1) {
        return e.json(404, { error: 'Nenhum snapshot disponivel para restauracao' })
      }
      return e.json(500, { error: 'Falha na restauracao atomica', detail: txError })
    }

    // ═══ IDEMPOTENT REPEAT: nothing saved, deterministic success ═══
    if (idempotentRepeat) {
      return e.json(200, { success: true, rolled_back: [], idempotent: true })
    }

    // ═══ FIRST EXECUTION: atomic restore + compensation event committed ═══
    return e.json(200, {
      success: true,
      rolled_back: [
        {
          collection: 'com_negocios',
          record_id: bindingRecordId,
          action: 'restored_from_snapshot',
        },
      ],
      idempotent: false,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(262144),
)
