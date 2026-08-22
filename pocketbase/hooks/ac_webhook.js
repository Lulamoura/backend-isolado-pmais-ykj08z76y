routerAdd(
  'POST',
  '/backend/v1/integracao/ac/webhook',
  (e) => {
    var WEBHOOK_ENABLED = false
    try {
      var _flagParam = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
      if (_flagParam && _flagParam.getString('valor') === 'true' && _flagParam.getBool('ativo'))
        WEBHOOK_ENABLED = true
    } catch (_) {}
    if (!WEBHOOK_ENABLED) {
      return e.json(503, {
        error: 'Webhook desabilitado',
        stage: 'porta-2d-etapa-2a',
        enabled: false,
      })
    }

    var contentType = e.request.header.get('Content-Type') || ''
    if (contentType.indexOf('application/json') === -1) {
      return e.badRequestError('Content-Type deve ser application/json')
    }

    var contentLength = parseInt(e.request.header.get('Content-Length') || '0', 10)
    if (contentLength > 262144) {
      return e.badRequestError('Corpo da requisicao excede o limite de 256KB')
    }

    var rawBody = toString(e.request.body)

    if (!rawBody) {
      return e.badRequestError('Corpo da requisicao vazio')
    }

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

    var body
    try {
      body = JSON.parse(rawBody)
    } catch (parseErr) {
      return e.badRequestError('Corpo da requisicao nao e JSON valido')
    }

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

    var sistemaOrigem = 'activecampaign'
    var eventoTipo = body.type || body.event || body.action || ''
    var externalId = '',
      entityType = ''
    if (body.contact && body.contact.id) {
      externalId = String(body.contact.id)
      entityType = 'contact'
    } else if (body.organization && body.organization.id) {
      externalId = String(body.organization.id)
      entityType = 'company'
    } else if (body.deal && body.deal.id) {
      externalId = String(body.deal.id)
      entityType = 'business'
    }
    if (!eventoTipo || !externalId)
      return e.badRequestError('Evento sem tipo ou id externo identificavel')

    var idempotencyKey = $security.sha256(sistemaOrigem + '|' + eventoTipo + '|' + externalId)
    var existingEvent = null
    try {
      existingEvent = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        idempotencyKey,
      )
    } catch (_) {}
    if (existingEvent) {
      return e.json(409, {
        received: true,
        duplicate: true,
        event_id: existingEvent.id,
        status: existingEvent.getString('status'),
        message: 'Evento ja processado anteriormente — replay bloqueado',
      })
    }

    var bodyStr = JSON.stringify(body)
    var execCol = $app.findCollectionByNameOrId('com_execucoes_sincronizacao')
    var execRec = new Record(execCol)
    execRec.set('sistema_origem', sistemaOrigem)
    execRec.set('status', 'processing')
    execRec.set('payload', bodyStr.substring(0, 4000))
    execRec.set('inicio', new Date().toISOString())
    $app.save(execRec)

    var eventoCol = $app.findCollectionByNameOrId('com_eventos_integracao')
    var eventoRec = new Record(eventoCol)
    eventoRec.set('sistema_origem', sistemaOrigem)
    eventoRec.set('evento_tipo', eventoTipo)
    eventoRec.set('external_id', externalId)
    eventoRec.set('idempotency_key', idempotencyKey)
    eventoRec.set('payload', bodyStr.substring(0, 4000))
    eventoRec.set('status', 'received')
    $app.save(eventoRec)

    try {
      var existingVinculo = null
      try {
        existingVinculo = $app.findFirstRecordByFilter(
          'com_vinculos_externos',
          "sistema_origem = '" +
            sistemaOrigem +
            "' && external_type = '" +
            entityType +
            "' && external_id = '" +
            externalId +
            "'",
        )
      } catch (_) {}

      if (entityType === 'contact') {
        var cData = body.contact || {}
        var cCol = $app.findCollectionByNameOrId('com_contatos')
        var cRec = null
        if (existingVinculo) {
          try {
            cRec = $app.findRecordById('com_contatos', existingVinculo.getString('record_id'))
          } catch (_) {}
        }
        if (!cRec) {
          cRec = new Record(cCol)
          cRec.set(
            'nome',
            ((cData.firstName || '') + ' ' + (cData.lastName || '')).trim() || 'Importado',
          )
          cRec.set('email', cData.email || '')
          cRec.set('telefone', cData.phone || '')
          cRec.set('ativo', true)
          $app.save(cRec)
        } else {
          var newName = ((cData.firstName || '') + ' ' + (cData.lastName || '')).trim()
          if (newName) cRec.set('nome', newName)
          if (cData.email) cRec.set('email', cData.email)
          if (cData.phone) cRec.set('telefone', cData.phone)
          $app.save(cRec)
        }
        if (!existingVinculo) {
          var vCol = $app.findCollectionByNameOrId('com_vinculos_externos')
          var vRec = new Record(vCol)
          vRec.set('sistema_origem', sistemaOrigem)
          vRec.set('external_type', 'contact')
          vRec.set('external_id', externalId)
          vRec.set('collection_name', 'com_contatos')
          vRec.set('record_id', cRec.id)
          $app.save(vRec)
        }
      } else if (entityType === 'business') {
        var dData = body.deal || {}
        var nRec = null
        if (existingVinculo) {
          try {
            nRec = $app.findRecordById('com_negocios', existingVinculo.getString('record_id'))
          } catch (_) {}
        }

        var extStage = dData.stage || ''
        var canonicalStage = ''
        if (extStage) {
          try {
            var aliasRec = $app.findFirstRecordByFilter(
              'com_alias_dimensoes',
              "dimensao = 'etapa' && valor_original = '" + extStage + "'",
            )
            if (aliasRec) {
              var cRef = aliasRec.getString('canonico_ref')
              if (cRef) {
                var etapaRec = $app.findRecordById('com_etapas', cRef)
                canonicalStage = etapaRec.getString('codigo')
              }
            }
          } catch (_) {}
          if (!canonicalStage) {
            var qCol = $app.findCollectionByNameOrId('com_ocorrencias_qualidade')
            var qRec = new Record(qCol)
            qRec.set('execucao_id', execRec.id)
            qRec.set('tipo', 'normalization_miss')
            qRec.set('severidade', 'warning')
            qRec.set('descricao', 'Sem mapeamento canonico para etapa: ' + extStage)
            qRec.set('resolvida', false)
            $app.save(qRec)
          }
        }

        if (!nRec) {
          var nCol = $app.findCollectionByNameOrId('com_negocios')
          nRec = new Record(nCol)
          nRec.set('titulo', dData.title || '[TESTE] Negocio importado')
          nRec.set('valor', parseFloat(dData.value) || 0)
          if (canonicalStage) nRec.set('etapa', canonicalStage)
          $app.save(nRec)
          var vCol2 = $app.findCollectionByNameOrId('com_vinculos_externos')
          var vRec2 = new Record(vCol2)
          vRec2.set('sistema_origem', sistemaOrigem)
          vRec2.set('external_type', 'business')
          vRec2.set('external_id', externalId)
          vRec2.set('collection_name', 'com_negocios')
          vRec2.set('record_id', nRec.id)
          $app.save(vRec2)
        } else {
          var sCol = $app.findCollectionByNameOrId('com_snapshots_negocio')
          var sRec = new Record(sCol)
          sRec.set('negocio_id', nRec.id)
          sRec.set(
            'snapshot',
            JSON.stringify({
              titulo: nRec.getString('titulo'),
              valor: nRec.get('valor'),
              etapa: nRec.getString('etapa'),
              resultado: nRec.getString('resultado'),
            }),
          )
          sRec.set('origem', sistemaOrigem)
          $app.save(sRec)
          if (dData.title) nRec.set('titulo', dData.title)
          if (canonicalStage) nRec.set('etapa', canonicalStage)
          $app.save(nRec)
        }
      }

      eventoRec.set('status', 'processed')
      $app.save(eventoRec)
      execRec.set('status', 'completed')
      execRec.set('fim', new Date().toISOString())
      $app.save(execRec)
    } catch (err) {
      eventoRec.set('status', 'error')
      $app.save(eventoRec)
      execRec.set('status', 'error')
      execRec.set('erro', String(err).substring(0, 2000))
      execRec.set('fim', new Date().toISOString())
      $app.save(execRec)
      $app
        .logger()
        .error('AC event processing failed', 'event_id', eventoRec.id, 'error', String(err))
      return e.json(500, { error: 'Erro no processamento do evento' })
    }

    return e.json(200, { received: true, event_id: eventoRec.id, status: 'processed' })
  },
  $apis.bodyLimit(262144),
)
