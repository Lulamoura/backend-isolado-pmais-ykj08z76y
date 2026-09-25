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

    function pickMediaInfo(message) {
      var content = message.content && typeof message.content === 'object' ? message.content : {}
      return {
        mediaType: cleanId(message.mediaType || message.type || '', 80),
        mimetype: cleanId(content.mimetype || '', 160),
        fileName: cleanId(content.fileName || content.filename || '', 240),
        urlHash: content.URL ? sha256Safe(asString(content.URL)) : '',
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
      record.set('received_at', data.receivedAt)
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
            messageAt: dateFromMillisOrSeconds(message.messageTimestamp),
            receivedAt: receivedAt,
          })
          if (messageRecord) result.message_record_id = messageRecord.id
          var mediaRecord = upsertMedia(tx, {
            instanceName: instanceName,
            owner: owner,
            messageId: messageId,
            mediaType: mediaType,
            mimetype: mediaInfo.mimetype,
            fileName: mediaInfo.fileName,
            urlHash: mediaInfo.urlHash,
            isGroup: isGroup,
            receivedAt: receivedAt,
          })
          if (mediaRecord) result.media_record_id = mediaRecord.id
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
  var actor = e.auth
  if (!actor || !actor.getBool('ativo_comercial')) return e.unauthorizedError('Autenticacao')
  var slug = ''
  try {
    slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
  } catch (_) {}
  if (slug !== 'superadministrador' && slug !== 'gestor-comercial' && slug !== 'integracao')
    return e.forbiddenError('Perfil comercial necessario')

  var secretConfigured = !!asString($secrets.get('UAZAPI_WEBHOOK_SECRET') || '')
  var counts = { eventos_24h: 0, midias_pendentes: 0 }
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
    counts.midias_pendentes = $app.findRecordsByFilter(
      'com_whatsapp_midias',
      "download_status='pendente'",
      '-created',
      500,
      0,
    ).length
  } catch (_) {}
  return e.json(200, {
    ok: true,
    provider: 'uazapi',
    endpoint: '/backend/v1/integracao/whatsapp/uazapi/[SEGREDO]/webhook',
    secret_configured: secretConfigured,
    modo: 'captura_passiva',
    automatic_send_allowed: false,
    counts: counts,
  })
})
