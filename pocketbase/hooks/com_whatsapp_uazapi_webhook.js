// PMais WhatsApp/Uazapi — captura passiva de mensagens comerciais.
// Endpoint definitivo: /backend/v1/integracao/whatsapp/uazapi/{webhookSecret}/webhook
// Primeira fase: ingestão, sanitização, deduplicação e fila lógica de mídia.

routerAdd(
  'POST',
  '/backend/v1/integracao/whatsapp/uazapi/{webhookSecret}/webhook',
  function (e) {
    function asString(value) {
      if (value === null || value === undefined) return ''
      return String(value)
    }

    function truncate(value, max) {
      var text = asString(value)
      return text.length > max ? text.substring(0, max) : text
    }

    function cleanId(value, max) {
      return truncate(asString(value).trim(), max)
    }

    function isSensitiveKey(key) {
      var lk = asString(key).toLowerCase()
      var parts = [
        'token',
        'admintoken',
        'authorization',
        'cookie',
        'secret',
        'password',
        'senha',
        'apikey',
        'api_key',
        'access_token',
        'refresh_token',
        'mediakey',
        'qrcode',
        'base64',
        'url',
      ]
      for (var i = 0; i < parts.length; i++) if (lk.indexOf(parts[i]) !== -1) return true
      return false
    }

    function sha256Safe(value) {
      var text = asString(value)
      var hash = asString($security.sha256(text) || '')
      if (hash) return hash
      return 'hash_unavailable_' + text.length
    }

    function redact(value) {
      var text = asString(value)
      return { redacted: true, sha256: sha256Safe(text), length: text.length }
    }

    function sanitize(value, key) {
      if (isSensitiveKey(key || '')) return redact(value)
      if (value === null || value === undefined) return value
      if (Array.isArray(value)) {
        var arr = []
        for (var ai = 0; ai < value.length; ai++) arr.push(sanitize(value[ai], key))
        return arr
      }
      if (typeof value === 'object') {
        var out = {}
        var keys = Object.keys(value)
        for (var ki = 0; ki < keys.length; ki++) out[keys[ki]] = sanitize(value[keys[ki]], keys[ki])
        return out
      }
      if (typeof value === 'string' && value.length > 5000) return redact(value)
      return value
    }

    function canonical(value) {
      if (value === null || value === undefined) return 'null'
      if (typeof value !== 'object') return JSON.stringify(value)
      if (Array.isArray(value)) {
        var arrayParts = []
        for (var ai = 0; ai < value.length; ai++) arrayParts.push(canonical(value[ai]))
        return '[' + arrayParts.join(',') + ']'
      }
      var keys = Object.keys(value).sort()
      var parts = []
      for (var ki = 0; ki < keys.length; ki++)
        parts.push(JSON.stringify(keys[ki]) + ':' + canonical(value[keys[ki]]))
      return '{' + parts.join(',') + '}'
    }

    function nestedText(value) {
      if (typeof value === 'string') return value
      if (value && typeof value === 'object' && typeof value.text === 'string') return value.text
      return ''
    }

    function firstArrayValue(value) {
      if (Array.isArray(value) && value.length) return asString(value[0])
      return ''
    }

    function boolFrom(value) {
      if (value === true) return true
      if (value === false) return false
      if (asString(value).toLowerCase() === 'true') return true
      if (asString(value).toLowerCase() === 'false') return false
      return false
    }

    function dateFromMillisOrSeconds(value) {
      var n = Number(value || 0)
      if (!n) return null
      if (n < 100000000000) n = n * 1000
      try {
        return new Date(n)
      } catch (_) {
        return null
      }
    }

    function findExisting(app, collectionName, field, value) {
      if (!value) return null
      try {
        return app.findFirstRecordByData(collectionName, field, value)
      } catch (_) {
        return null
      }
    }

    function pickMessageId(message, event) {
      return (
        cleanId(message.messageid, 220) ||
        cleanId(message.id, 220) ||
        cleanId(firstArrayValue(event.MessageIDs), 220)
      )
    }

    function inferMediaType(message, content) {
      var explicit = cleanId(message.mediaType || message.type || '', 80)
      if (explicit) return explicit
      var messageType = cleanId(message.messageType || '', 80)
      var lowerMessageType = messageType.toLowerCase()
      var mimetype = cleanId(content.mimetype || content.mimeType || '', 160)
      var lowerMime = mimetype.toLowerCase()
      if (lowerMessageType.indexOf('audio') !== -1 || lowerMime.indexOf('audio/') === 0)
        return 'audio'
      if (lowerMessageType.indexOf('image') !== -1 || lowerMime.indexOf('image/') === 0)
        return 'image'
      if (lowerMessageType.indexOf('document') !== -1 || lowerMime.indexOf('application/') === 0)
        return 'document'
      if (lowerMessageType.indexOf('video') !== -1 || lowerMime.indexOf('video/') === 0)
        return 'video'
      return ''
    }

    function pickMediaInfo(message) {
      var content = message.content && typeof message.content === 'object' ? message.content : {}
      return {
        mediaType: inferMediaType(message, content),
        mimetype: cleanId(content.mimetype || content.mimeType || '', 160),
        fileName: cleanId(content.fileName || content.filename || '', 240),
        urlHash: content.URL ? sha256Safe(asString(content.URL)) : '',
      }
    }

    function normalizePhone(value) {
      var digits = asString(value).replace(/\D/g, '')
      if (digits.length > 13 && digits.indexOf('55') === 0) digits = digits.substring(0, 13)
      return digits
    }

    function telefoneFromChat(chatId, senderId) {
      var source = cleanId(chatId || senderId || '', 160)
      var beforeAt = source.split('@')[0]
      return truncate(normalizePhone(beforeAt), 40)
    }

    function pbFilterEscape(value) {
      return asString(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    }

    function samePhone(a, b) {
      var pa = normalizePhone(a)
      var pb = normalizePhone(b)
      if (!pa || !pb) return false
      if (pa === pb) return true
      if (pa.length >= 8 && pb.length >= 8) return pa.endsWith(pb) || pb.endsWith(pa)
      return false
    }

    function buscarContatosPorTelefone(tx, telefone) {
      var matches = []
      if (!telefone) return matches
      var contatos = []
      try {
        contatos = tx.findRecordsByFilter('com_contatos', "id != ''", '-updated', 500, 0)
      } catch (_) {
        return matches
      }
      for (var i = 0; i < contatos.length; i++) {
        var record = contatos[i]
        if (samePhone(record.getString('telefone'), telefone)) matches.push(record)
      }
      return matches
    }

    function negocioAberto(record) {
      try {
        if (record.getBool('inativo')) return false
      } catch (_) {}
      return !record.getString('resultado')
    }

    function addUniqueRecord(records, record) {
      if (!record) return
      for (var i = 0; i < records.length; i++) if (records[i].id === record.id) return
      records.push(record)
    }

    function buscarNegociosAbertosParaVinculo(tx, contato, empresaId) {
      var negocios = []
      var contatoId = contato ? contato.id : ''
      var filters = []
      if (contatoId)
        filters.push("contato_principal_id='" + pbFilterEscape(contatoId) + "' && resultado=''")
      if (empresaId) filters.push("empresa_id='" + pbFilterEscape(empresaId) + "' && resultado=''")
      for (var i = 0; i < filters.length; i++) {
        try {
          var found = tx.findRecordsByFilter('com_negocios', filters[i], '-updated', 50, 0)
          for (var fi = 0; fi < found.length; fi++)
            if (negocioAberto(found[fi])) addUniqueRecord(negocios, found[fi])
        } catch (_) {}
      }
      return negocios
    }

    function safeRecordString(tx, collectionName, recordId, field) {
      if (!recordId) return ''
      try {
        return tx.findRecordById(collectionName, recordId).getString(field)
      } catch (_) {
        return ''
      }
    }

    function buscarVinculoPorChat(tx, data) {
      try {
        var filter =
          "provider='uazapi' && instance_name='" +
          pbFilterEscape(data.instanceName) +
          "' && owner='" +
          pbFilterEscape(data.owner) +
          "' && chat_id='" +
          pbFilterEscape(data.chatId) +
          "'"
        var records = tx.findRecordsByFilter('com_whatsapp_vinculos', filter, '-updated', 1, 0)
        return records && records.length ? records[0] : null
      } catch (_) {
        return null
      }
    }

    function resolverVinculoComercial(tx, data) {
      if (data.isGroup || !data.chatId) return null
      var telefone = telefoneFromChat(data.chatId, data.senderId)
      var contatos = buscarContatosPorTelefone(tx, telefone)
      var contato = contatos.length === 1 ? contatos[0] : null
      var empresaId = contato ? contato.getString('empresa_id') : ''
      var negocios = contato ? buscarNegociosAbertosParaVinculo(tx, contato, empresaId) : []
      var negocio = negocios.length === 1 ? negocios[0] : null
      var status = 'sem_correspondencia'
      var origemDecisao = 'sistema_sem_match'
      if (contatos.length > 1 || negocios.length > 1) {
        status = 'ambiguidade'
        origemDecisao = 'sistema_ambiguidade'
      } else if (contato && negocio) {
        status = 'vinculado_automatico'
        origemDecisao = 'sistema_telefone_negocio_unico'
      } else if (contato) {
        status = 'pendente_confirmacao'
        origemDecisao = 'sistema_contato_sem_negocio_unico'
      }

      var vinculo = buscarVinculoPorChat(tx, data)
      if (!vinculo) vinculo = new Record(tx.findCollectionByNameOrId('com_whatsapp_vinculos'))
      vinculo.set('provider', 'uazapi')
      vinculo.set('instance_name', data.instanceName)
      vinculo.set('owner', data.owner)
      vinculo.set('chat_id', data.chatId)
      vinculo.set('telefone', telefone)
      vinculo.set('contato_id', contato ? contato.id : '')
      vinculo.set('empresa_id', empresaId)
      vinculo.set('negocio_id', negocio ? negocio.id : '')
      vinculo.set('status', status)
      vinculo.set('origem_decisao', origemDecisao)
      vinculo.set(
        'observacao',
        'Vínculo sugerido pelo telefone do chat; confirmar quando houver ambiguidade.',
      )
      if (status === 'vinculado_automatico')
        vinculo.set('vinculado_em', data.messageAt || data.receivedAt)
      vinculo.set('last_message_at', data.messageAt || data.receivedAt)
      tx.save(vinculo)

      return {
        recordId: vinculo.id,
        telefone: telefone,
        status: status,
        contatoId: contato ? contato.id : '',
        contatoNome: contato ? contato.getString('nome') : '',
        empresaId: empresaId,
        empresaNome: safeRecordString(tx, 'com_empresas', empresaId, 'nome'),
        negocioId: negocio ? negocio.id : '',
        negocioTitulo: negocio ? negocio.getString('titulo') : '',
      }
    }

    function saveEvent(tx, data) {
      var existing = findExisting(
        tx,
        'com_whatsapp_eventos',
        'idempotency_key',
        data.idempotencyKey,
      )
      if (existing) return { record: existing, replay: true }
      var record = new Record(tx.findCollectionByNameOrId('com_whatsapp_eventos'))
      record.set('provider', 'uazapi')
      record.set('instance_name', data.instanceName)
      record.set('owner', data.owner)
      record.set('event_type', data.eventType)
      record.set('message_id', data.messageId)
      record.set('idempotency_key', data.idempotencyKey)
      record.set('payload_hash', data.payloadHash)
      record.set('payload_sanitizado', data.payloadSanitized)
      record.set('status', data.status)
      record.set('from_me', data.fromMe)
      record.set('is_group', data.isGroup)
      record.set('media_type', data.mediaType)
      record.set('received_at', data.receivedAt)
      tx.save(record)
      return { record: record, replay: false }
    }

    function upsertMessage(tx, data) {
      if (!data.messageId) return null
      var existing = findExisting(
        tx,
        'com_whatsapp_mensagens',
        'idempotency_key',
        data.messageIdempotencyKey,
      )
      if (existing) return existing
      var record = new Record(tx.findCollectionByNameOrId('com_whatsapp_mensagens'))
      record.set('provider', 'uazapi')
      record.set('instance_name', data.instanceName)
      record.set('owner', data.owner)
      record.set('chat_id', data.chatId)
      record.set('sender_id', data.senderId)
      record.set('sender_name', data.senderName)
      record.set('message_id', data.messageId)
      record.set('idempotency_key', data.messageIdempotencyKey)
      record.set('direcao', data.fromMe ? 'enviada_operadora' : 'recebida')
      record.set('is_group', data.isGroup)
      record.set('message_type', data.messageType)
      record.set('media_type', data.mediaType)
      record.set('texto', data.texto)
      record.set('status', data.isGroup ? 'ignorada_grupo' : 'capturada')
      record.set('evento_id', data.eventRecordId)
      if (data.messageAt) record.set('message_at', data.messageAt)
      record.set('received_at', data.receivedAt)
      tx.save(record)
      return record
    }

    function upsertMedia(tx, data) {
      if (!data.messageId || !data.mediaType) return null
      if (data.mediaType === 'text' || data.mediaType === 'conversation') return null
      var existing = findExisting(tx, 'com_whatsapp_midias', 'message_id', data.messageId)
      if (existing) return existing
      var record = new Record(tx.findCollectionByNameOrId('com_whatsapp_midias'))
      record.set('provider', 'uazapi')
      record.set('instance_name', data.instanceName)
      record.set('owner', data.owner)
      record.set('message_id', data.messageId)
      record.set('media_type', data.mediaType)
      record.set('mimetype', data.mimetype)
      record.set('file_name', data.fileName)
      record.set('source_url_hash', data.urlHash)
      record.set('download_status', data.isGroup ? 'ignorada_grupo' : 'pendente')
      record.set('retencao_politica', data.retencaoPolitica)
      record.set('transcricao_status', data.transcricaoStatus)
      record.set('transcricao_texto', '')
      record.set('transcricao_confianca', '')
      if (data.descarteAudioEm) record.set('descarte_audio_em', data.descarteAudioEm)
      record.set('received_at', data.receivedAt)
      tx.save(record)
      return record
    }

    function destinoLedger(data) {
      if (data.isGroup) return 'descartar'
      if (!data.messageId) return 'historico'
      if (data.mediaType && asString(data.mediaType).toLowerCase().indexOf('audio') !== -1)
        return 'pendencia'
      var textoBaixo = asString(data.texto).toLowerCase()
      var sinaisDirecao = ['contrato', 'desconto', 'reclama', 'lgpd', 'juridico', 'jurídico']
      for (var i = 0; i < sinaisDirecao.length; i++) {
        if (textoBaixo.indexOf(sinaisDirecao[i]) !== -1) return 'escalar_direcao'
      }
      var sinaisPendencia = ['proposta', 'retorno', 'prazo', 'documento', 'reunião', 'reuniao']
      for (var pi = 0; pi < sinaisPendencia.length; pi++) {
        if (textoBaixo.indexOf(sinaisPendencia[pi]) !== -1) return 'pendencia'
      }
      return 'historico'
    }

    function garantirColecaoLedgerComercial(app) {
      try {
        return app.findCollectionByNameOrId('com_ledger_comercial')
      } catch (_) {}
      var collection = new Collection({
        type: 'base',
        name: 'com_ledger_comercial',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva' || @request.auth.perfil_id.slug = 'integracao')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva' || @request.auth.perfil_id.slug = 'integracao')",
      })
      collection.fields.add(new TextField({ name: 'fonte', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'canal', required: true, max: 120 }))
      collection.fields.add(new TextField({ name: 'origem', required: false, max: 160 }))
      collection.fields.add(new TextField({ name: 'contato_nome', required: false, max: 240 }))
      collection.fields.add(new TextField({ name: 'empresa_nome', required: false, max: 240 }))
      collection.fields.add(new TextField({ name: 'negocio_ref', required: false, max: 240 }))
      collection.fields.add(new TextField({ name: 'responsavel', required: false, max: 160 }))
      collection.fields.add(new TextField({ name: 'tipo_evento', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'fato', required: true, max: 2400 }))
      collection.fields.add(new TextField({ name: 'evidencia_ref', required: true, max: 500 }))
      collection.fields.add(new TextField({ name: 'destino_sugerido', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'risco', required: true, max: 40 }))
      collection.fields.add(new TextField({ name: 'retencao', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'status', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'confianca', required: false, max: 40 }))
      collection.fields.add(new TextField({ name: 'promocao_modo', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'revisao_status', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
      collection.fields.add(new TextField({ name: 'observacao', required: false, max: 1200 }))
      collection.fields.add(new DateField({ name: 'occurred_at', required: true }))
      collection.indexes = [
        'CREATE INDEX idx_com_ledger_comercial_occurred ON com_ledger_comercial (occurred_at)',
        'CREATE INDEX idx_com_ledger_comercial_destino ON com_ledger_comercial (destino_sugerido, status)',
        'CREATE INDEX idx_com_ledger_comercial_audit ON com_ledger_comercial (audit_id)',
        'CREATE INDEX idx_com_ledger_comercial_fonte ON com_ledger_comercial (fonte, occurred_at)',
      ]
      app.save(collection)
      return collection
    }

    function criarLedgerComercial(tx, data) {
      if (!data.messageId && !data.eventRecordId) return null
      var auditId = sha256Safe(
        [
          'ledger-comercial',
          'uazapi',
          data.instanceName,
          data.owner,
          data.messageId,
          data.eventRecordId,
        ].join('|'),
      )
      garantirColecaoLedgerComercial($app)
      if (findExisting(tx, 'com_ledger_comercial', 'audit_id', auditId)) return null
      var destino = destinoLedger(data)
      var record = new Record(tx.findCollectionByNameOrId('com_ledger_comercial'))
      record.set('fonte', 'whatsapp_uazapi')
      record.set('canal', 'WhatsApp Comercial')
      record.set('origem', data.fromMe ? 'operadora_comercial' : 'cliente_ou_contato')
      record.set(
        'contato_nome',
        data.vinculoComercial && data.vinculoComercial.contatoNome
          ? data.vinculoComercial.contatoNome
          : data.senderName,
      )
      record.set(
        'empresa_nome',
        data.vinculoComercial && data.vinculoComercial.empresaNome
          ? data.vinculoComercial.empresaNome
          : '',
      )
      record.set(
        'negocio_ref',
        data.vinculoComercial && data.vinculoComercial.negocioId
          ? data.vinculoComercial.negocioTitulo + ' (' + data.vinculoComercial.negocioId + ')'
          : '',
      )
      record.set('responsavel', data.owner || data.instanceName)
      record.set('tipo_evento', data.mediaType ? 'mensagem_midia' : 'mensagem')
      record.set(
        'fato',
        truncate(
          data.texto || data.messageType || 'Mensagem WhatsApp registrada para contexto comercial.',
          2400,
        ),
      )
      record.set('evidencia_ref', data.eventRecordId || data.messageId)
      record.set('destino_sugerido', destino)
      record.set('risco', destino === 'escalar_direcao' ? 'alto' : 'baixo')
      record.set('retencao', data.isGroup ? 'curta' : 'operacional')
      record.set('status', destino === 'descartar' ? 'descartado' : 'novo')
      record.set('confianca', 'media')
      record.set('promocao_modo', destino === 'historico' ? 'promover_baixo_risco' : '')
      record.set('revisao_status', destino === 'historico' ? 'ativo_provisorio' : '')
      record.set('audit_id', auditId)
      record.set(
        'observacao',
        'Ledger sem payload bruto; segredos e anexos ficam fora desta camada.',
      )
      record.set('occurred_at', data.messageAt || data.receivedAt)
      tx.save(record)
      return record
    }

    var expectedSecret = asString($secrets.get('UAZAPI_WEBHOOK_SECRET') || '')
    var providedSecret = asString(e.request.pathValue('webhookSecret') || '')
    if (!expectedSecret) return e.json(503, { ok: false, error: 'WEBHOOK_NAO_CONFIGURADO' })
    if (providedSecret.length !== expectedSecret.length || providedSecret !== expectedSecret)
      return e.json(401, { ok: false, error: 'WEBHOOK_NAO_AUTORIZADO' })

    var rawBody = toString(e.request.body)
    if (!rawBody) return e.json(400, { ok: false, error: 'CORPO_VAZIO' })
    var body = {}
    try {
      body = JSON.parse(rawBody)
    } catch (_) {
      return e.json(400, { ok: false, error: 'JSON_INVALIDO' })
    }

    var message = body.message && typeof body.message === 'object' ? body.message : {}
    var updateEvent = body.event && typeof body.event === 'object' ? body.event : {}
    var eventType = cleanId(body.EventType || body.type || 'unknown', 80)
    var instanceName = cleanId(body.instanceName || '', 120)
    var owner = cleanId(body.owner || '', 80)
    var messageId = pickMessageId(message, updateEvent)
    var fromMe =
      message.fromMe !== undefined ? boolFrom(message.fromMe) : boolFrom(updateEvent.IsFromMe)
    var isGroup =
      message.isGroup !== undefined ? boolFrom(message.isGroup) : boolFrom(updateEvent.IsGroup)
    var messageType = cleanId(message.messageType || updateEvent.Type || '', 80)
    var mediaInfo = pickMediaInfo(message)
    var mediaType = cleanId(mediaInfo.mediaType || '', 80)
    var chatId = cleanId(message.chatid || updateEvent.chatid || updateEvent.Chat || '', 160)
    var senderId = cleanId(message.sender || updateEvent.Sender || updateEvent.sender_pn || '', 160)
    var senderName = cleanId(message.senderName || '', 180)
    var texto = truncate(nestedText(message.text || message.content), 8000)
    var receivedAt = new Date()
    var payloadHash = sha256Safe(canonical(body))
    var payloadSanitized = truncate(JSON.stringify(sanitize(body), null, 0), 50000)
    var idempotencyBasis = [
      'uazapi',
      instanceName,
      owner,
      eventType,
      messageId,
      updateEvent.Type || body.state || '',
      chatId,
      updateEvent.Timestamp || message.messageTimestamp || '',
    ].join('|')
    var idempotencyKey = sha256Safe(idempotencyBasis)
    var messageIdempotencyKey = sha256Safe(
      ['uazapi-message', instanceName, owner, messageId].join('|'),
    )
    var result = { replay: false, event_id: '', message_record_id: '', media_record_id: '' }

    try {
      if (eventType === 'messages' && messageId) garantirColecaoLedgerComercial($app)
      $app.runInTransaction(function (tx) {
        var eventResult = saveEvent(tx, {
          instanceName: instanceName,
          owner: owner,
          eventType: eventType,
          messageId: messageId,
          idempotencyKey: idempotencyKey,
          payloadHash: payloadHash,
          payloadSanitized: payloadSanitized,
          status: isGroup ? 'ignorado_grupo' : 'recebido',
          fromMe: fromMe,
          isGroup: isGroup,
          mediaType: mediaType,
          receivedAt: receivedAt,
        })
        result.replay = eventResult.replay
        result.event_id = eventResult.record.id
        if (eventType === 'messages' && messageId) {
          var messageRecord = upsertMessage(tx, {
            instanceName: instanceName,
            owner: owner,
            chatId: chatId,
            senderId: senderId,
            senderName: senderName,
            messageId: messageId,
            messageIdempotencyKey: messageIdempotencyKey,
            fromMe: fromMe,
            isGroup: isGroup,
            messageType: messageType,
            mediaType: mediaType,
            texto: texto,
            eventRecordId: eventResult.record.id,
            messageAt: dateFromMillisOrSeconds(message.messageTimestamp || message.timestamp),
            receivedAt: receivedAt,
          })
          if (messageRecord) result.message_record_id = messageRecord.id
          var audioRetencaoAte = new Date(receivedAt.getTime() + 24 * 60 * 60 * 1000)
          var isAudioMedia =
            asString(mediaType).toLowerCase().indexOf('audio') !== -1 ||
            asString(mediaInfo.mimetype).toLowerCase().indexOf('audio/') === 0
          var mediaRecord = upsertMedia(tx, {
            instanceName: instanceName,
            owner: owner,
            messageId: messageId,
            mediaType: mediaType,
            mimetype: mediaInfo.mimetype,
            fileName: mediaInfo.fileName,
            urlHash: mediaInfo.urlHash,
            isGroup: isGroup,
            retencaoPolitica: isAudioMedia
              ? 'transcricao_apenas_audio_temporario'
              : 'midia_operacional_temporaria',
            transcricaoStatus: isAudioMedia ? 'pendente_transcricao' : 'nao_aplicavel',
            descarteAudioEm: isAudioMedia ? audioRetencaoAte : null,
            receivedAt: receivedAt,
          })
          if (mediaRecord) result.media_record_id = mediaRecord.id
          var messageAt = dateFromMillisOrSeconds(message.messageTimestamp || message.timestamp)
          var vinculoComercial = resolverVinculoComercial(tx, {
            instanceName: instanceName,
            owner: owner,
            chatId: chatId,
            senderId: senderId,
            isGroup: isGroup,
            messageAt: messageAt,
            receivedAt: receivedAt,
          })
          criarLedgerComercial(tx, {
            instanceName: instanceName,
            owner: owner,
            senderName: senderName,
            messageId: messageId,
            eventRecordId: eventResult.record.id,
            fromMe: fromMe,
            isGroup: isGroup,
            messageType: messageType,
            mediaType: mediaType,
            texto: texto,
            vinculoComercial: vinculoComercial,
            messageAt: messageAt,
            receivedAt: receivedAt,
          })
        }
      })
    } catch (err) {
      return e.json(500, {
        ok: false,
        error: 'FALHA_INGESTAO',
        detail: truncate(err && err.message ? err.message : err, 500),
      })
    }

    return e.json(200, {
      ok: true,
      received: true,
      replay: result.replay,
      event_record_id: result.event_id,
      message_record_id: result.message_record_id,
      media_record_id: result.media_record_id,
    })
  },
  $apis.bodyLimit(5 * 1024 * 1024),
)

routerAdd('GET', '/backend/v1/integracao/whatsapp/uazapi/status', function (e) {
  function asString(value) {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  function firstRecord(collectionName, filter, sort) {
    try {
      var records = $app.findRecordsByFilter(collectionName, filter || "id != ''", sort, 1, 0)
      return records && records.length ? records[0] : null
    } catch (_) {
      return null
    }
  }

  function safeDate(record, field) {
    if (!record) return ''
    try {
      return asString(record.getDateTime(field))
    } catch (_) {
      try {
        return asString(record.getString(field))
      } catch (_) {
        return ''
      }
    }
  }

  function recordSummary(record, fields) {
    if (!record) return null
    var out = { id: record.id }
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i]
      try {
        out[field] = record.getString(field)
      } catch (_) {
        out[field] = ''
      }
    }
    out.received_at = safeDate(record, 'received_at')
    out.created = safeDate(record, 'created')
    return out
  }

  var actor = e.auth
  if (!actor || !actor.getBool('ativo_comercial')) return e.unauthorizedError('Autenticacao')
  var slug = ''
  try {
    slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
  } catch (_) {}
  if (slug !== 'superadministrador' && slug !== 'gestor-comercial' && slug !== 'integracao')
    return e.forbiddenError('Perfil comercial necessario')

  var secretConfigured = !!asString($secrets.get('UAZAPI_WEBHOOK_SECRET') || '')
  var counts = {
    eventos_24h: 0,
    mensagens_24h: 0,
    midias_pendentes: 0,
    transcricoes_pendentes: 0,
    vinculos_pendentes: 0,
  }
  try {
    counts.eventos_24h = $app.findRecordsByFilter(
      'com_whatsapp_eventos',
      'created >= @todayStart',
      '-created',
      500,
      0,
    ).length
  } catch (_) {}
  try {
    counts.mensagens_24h = $app.findRecordsByFilter(
      'com_whatsapp_mensagens',
      'created >= @todayStart',
      '-created',
      500,
      0,
    ).length
  } catch (_) {}
  try {
    counts.midias_pendentes = $app.findRecordsByFilter(
      'com_whatsapp_midias',
      "download_status='pendente'",
      '-created',
      500,
      0,
    ).length
  } catch (_) {}
  try {
    counts.transcricoes_pendentes = $app.findRecordsByFilter(
      'com_whatsapp_midias',
      "transcricao_status='pendente_transcricao'",
      '-created',
      500,
      0,
    ).length
  } catch (_) {}
  try {
    counts.vinculos_pendentes = $app.findRecordsByFilter(
      'com_whatsapp_vinculos',
      "status='pendente_confirmacao' || status='ambiguidade'",
      '-created',
      500,
      0,
    ).length
  } catch (_) {}

  var ultimoWebhook = firstRecord('com_whatsapp_eventos', '', '-received_at')
  var ultimaMensagem = firstRecord('com_whatsapp_mensagens', '', '-received_at')
  var ultimaMidia = firstRecord('com_whatsapp_midias', '', '-received_at')

  return e.json(200, {
    ok: true,
    provider: 'uazapi',
    endpoint: '/backend/v1/integracao/whatsapp/uazapi/[SEGREDO]/webhook',
    secret_configured: secretConfigured,
    modo: 'captura_passiva',
    automatic_send_allowed: false,
    politica: {
      sem_automacao_livre: true,
      audio: 'transcricao_apenas',
      midia: 'download_temporario_para_processamento',
      nexo: 'somente_apos_vinculo_comercial_e_curadoria',
    },
    proximas_etapas: [
      'simulacao_controlada',
      'worker_midia_transcricao',
      'painel_monitoramento_minimo',
      'vinculo_negocio_pendente',
    ],
    counts: counts,
    ultimo_webhook: recordSummary(ultimoWebhook, [
      'event_type',
      'instance_name',
      'owner',
      'message_id',
      'status',
      'media_type',
    ]),
    ultima_mensagem: recordSummary(ultimaMensagem, [
      'instance_name',
      'owner',
      'chat_id',
      'direcao',
      'message_type',
      'media_type',
      'status',
    ]),
    ultima_midia: recordSummary(ultimaMidia, [
      'message_id',
      'media_type',
      'download_status',
      'retencao_politica',
      'transcricao_status',
    ]),
  })
})
