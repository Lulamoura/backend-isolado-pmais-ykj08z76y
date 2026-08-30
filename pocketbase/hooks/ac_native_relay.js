// T6.AC.9 — adaptador do webhook nativo do ActiveCampaign para o envelope V1.
// O endpoint e inerte enquanto ac_webhook_enabled=false e nunca escreve no AC.

routerAdd(
  'POST',
  '/backend/v1/integracao/ac/relay-v1',
  function (e) {
    function paramTrue(key) {
      try {
        var record = $app.findFirstRecordByData('com_parametros', 'chave', key)
        return record.getBool('ativo') && record.getString('valor') === 'true'
      } catch (_) {
        return false
      }
    }
    function equalSignature(left, right) {
      if (left.length !== right.length) return false
      var diff = 0
      for (var i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
      return diff === 0
    }
    function decode(value) {
      try {
        return decodeURIComponent(String(value || '').replace(/\+/g, ' '))
      } catch (_) {
        throw new Error('FORM_URLENCODED_INVALIDO')
      }
    }
    function parseForm(raw) {
      var result = {},
        parts = String(raw || '').split('&')
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue
        var separator = parts[i].indexOf('=')
        var key = decode(separator === -1 ? parts[i] : parts[i].slice(0, separator))
        var value = decode(separator === -1 ? '' : parts[i].slice(separator + 1))
        if (!key || result[key] !== undefined) throw new Error('FORM_CAMPO_DUPLICADO')
        result[key] = value
      }
      return result
    }
    function apiCall(apiUrl, apiKey, path) {
      var response = $http.send({
        url: apiUrl + path,
        method: 'GET',
        headers: { 'Api-Token': apiKey, Accept: 'application/json' },
        timeout: 20,
      })
      if (response.statusCode !== 200) throw new Error('AC_HTTP_' + response.statusCode)
      return response.json || {}
    }
    function list(apiUrl, apiKey, path, key, suffix) {
      var rows = [],
        limit = 100
      for (var page = 0; page < 100; page++) {
        var separator = path.indexOf('?') === -1 ? '?' : '&'
        var response = apiCall(
          apiUrl,
          apiKey,
          path + separator + 'limit=' + limit + '&offset=' + page * limit + (suffix || ''),
        )
        var batch = response[key] || []
        for (var i = 0; i < batch.length; i++) rows.push(batch[i])
        if (batch.length < limit) return rows
      }
      throw new Error('AC_PAGINACAO_EXCEDE_LIMITE')
    }
    function clean(value, max) {
      var text = String(value || '').trim()
      return text.length <= max ? text : ''
    }
    function formatBrazilianMoney(valueCents) {
      var cents = Math.round(Number(valueCents || 0))
      if (!isFinite(cents) || cents < 0) throw new Error('VALOR_SERVICO_INVALIDO')
      var absolute = Math.abs(cents)
      var integer = String(Math.floor(absolute / 100))
      var decimal = String(absolute % 100)
      if (decimal.length < 2) decimal = '0' + decimal
      var groups = []
      while (integer.length > 3) {
        groups.unshift(integer.slice(-3))
        integer = integer.slice(0, -3)
      }
      groups.unshift(integer || '0')
      return (cents < 0 ? '-' : '') + groups.join('.') + ',' + decimal
    }
    function proveloDispatch(deal, pipeline, stageName, contact, customByLabel) {
      var config = null
      try {
        config = $app.findFirstRecordByData('com_integracao_provelo', 'provedor', 'make-provelo')
      } catch (_) {}
      if (!config || !config.getBool('habilitada'))
        return { attempted: false, reason: 'GATE_DESLIGADO' }
      var pipelineTitle = clean(pipeline && pipeline.title, 160)
      var modality = clean(customByLabel['Modalidade'], 120)
      var proveloId = clean(customByLabel['ProveloID'], 160)
      var ownerCode = clean(customByLabel['Responsável'], 120)
      var contactEmail = clean(contact && contact.email, 240)
      if (pipelineTitle.toLowerCase().indexOf('proposta qualificada') === -1)
        return { attempted: false, reason: 'PIPELINE_FORA_DO_ESCOPO' }
      if (String(stageName || '').toLowerCase() !== 'negociação')
        return { attempted: false, reason: 'ETAPA_FORA_DO_ESCOPO' }
      if (proveloId) return { attempted: false, reason: 'PROVELO_ID_EXISTENTE' }
      if (!modality) return { attempted: false, reason: 'MODALIDADE_AUSENTE' }
      if (!contactEmail || !ownerCode)
        return { attempted: false, reason: 'DADOS_OBRIGATORIOS_AUSENTES' }

      var idempotencyKey = $security.sha256('provelo-draft|' + String(deal.id))
      var prior = null
      try {
        prior = $app.findFirstRecordByData(
          'com_eventos_integracao',
          'idempotency_key',
          idempotencyKey,
        )
      } catch (_) {}
      if (prior)
        return {
          attempted: false,
          reason: 'DISPATCH_JA_REGISTRADO',
          status: prior.getString('status'),
        }

      var webhookUrl = clean(config.getString('endpoint'), 1000)
      if (!/^https:\/\/hook\.us1\.make\.com\/[A-Za-z0-9_-]+$/.test(webhookUrl))
        throw new Error('PROVELO_WEBHOOK_AUSENTE_OU_INVALIDO')

      var dispatch = new Record($app.findCollectionByNameOrId('com_eventos_integracao'))
      dispatch.set('sistema_origem', 'provelo')
      dispatch.set('evento_tipo', 'draft_requested')
      dispatch.set('external_id', 'business:' + String(deal.id))
      dispatch.set('idempotency_key', idempotencyKey)
      dispatch.set(
        'payload',
        JSON.stringify({
          deal_id: String(deal.id),
          pipeline: pipelineTitle,
          stage: clean(stageName, 120),
          modality: modality,
        }),
      )
      dispatch.set('status', 'pending')
      $app.save(dispatch)

      var body = JSON.stringify({
        DealId: String(deal.id),
        Modalidade: modality,
        Email: contactEmail,
        Vendedor: ownerCode,
        ValorServico: formatBrazilianMoney(deal.value),
      })
      var response
      try {
        response = $http.send({
          url: webhookUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: body,
          timeout: 20,
        })
      } catch (_) {
        config.set('ultimo_incerto_em', new Date().toISOString())
        $app.save(config)
        return { attempted: true, accepted: false, uncertain: true }
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        config.set('ultima_falha_em', new Date().toISOString())
        $app.save(config)
        dispatch.set('status', 'failed')
        dispatch.set(
          'payload',
          JSON.stringify({ deal_id: String(deal.id), http_status: response.statusCode }),
        )
        $app.save(dispatch)
        return { attempted: true, accepted: false, uncertain: false }
      }
      config.set('ultimo_sucesso_em', new Date().toISOString())
      $app.save(config)
      dispatch.set('status', 'processed')
      dispatch.set(
        'payload',
        JSON.stringify({ deal_id: String(deal.id), http_status: response.statusCode }),
      )
      $app.save(dispatch)
      return { attempted: true, accepted: true, uncertain: false }
    }
    function envelope(type, id, modified, data, links, correlation) {
      var sourceVersion = clean(modified, 80) || new Date(0).toISOString()
      return {
        schema_version: '1',
        context_revision: type === 'business' ? '7' : '1',
        event_id:
          'ac:' + type + ':' + id + ':' + sourceVersion + (type === 'business' ? ':ctx7' : ''),
        source: 'activecampaign',
        entity_type: type,
        entity_id: String(id),
        action: 'upsert',
        occurred_at: new Date().toISOString(),
        source_version: sourceVersion,
        correlation_id: correlation,
        data: data,
        links: links || {},
      }
    }
    function forward(pbUrl, secret, event) {
      var body = JSON.stringify(event)
      var response = $http.send({
        url: pbUrl + '/backend/v1/integracao/ac/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AC-Signature': $security.hs256(body, secret),
          'X-Correlation-Id': event.correlation_id,
        },
        body: body,
        timeout: 20,
      })
      if (response.statusCode !== 200)
        throw new Error('PROCESSAMENTO_V1_HTTP_' + response.statusCode)
      return response.json || {}
    }

    if (!paramTrue('ac_webhook_enabled'))
      return e.json(503, { error: 'WEBHOOK_DESABILITADO', enabled: false, relay: 'v1' })
    var contentType = String(e.request.header.get('Content-Type') || '').toLowerCase()
    if (contentType.indexOf('application/x-www-form-urlencoded') === -1)
      return e.json(400, { error: 'CONTENT_TYPE_INVALIDO' })
    var rawBody = toString(e.request.body)
    if (!rawBody || rawBody.length > 131072) return e.json(400, { error: 'CORPO_INVALIDO' })
    var signature = String(e.request.header.get('X-AC-Signature') || '').toLowerCase()
    var secret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    if (!/^[0-9a-f]{64}$/.test(signature) || !secret)
      return e.json(401, { error: 'ASSINATURA_INVALIDA' })
    if (!equalSignature($security.hs256(rawBody, secret), signature))
      return e.json(401, { error: 'ASSINATURA_INVALIDA' })

    var form = {}
    try {
      form = parseForm(rawBody)
    } catch (parseError) {
      return e.json(400, { error: String(parseError).replace('Error: ', '') })
    }
    var eventType = clean(form.type, 40)
    if (eventType !== 'deal_add' && eventType !== 'deal_update' && eventType !== 'deal_note_add')
      return e.json(202, { received: true, ignored: true, reason: 'EVENTO_FORA_DO_ESCOPO' })
    var dealId = clean(form['deal[id]'] || form.dealid || form.id, 40)
    if (!/^[0-9]+$/.test(dealId)) return e.json(400, { error: 'DEAL_ID_INVALIDO' })

    var apiUrl = String($secrets.get('AC_API_URL') || '').replace(/\/$/, '')
    var apiKey = $secrets.get('AC_API_KEY') || ''
    var pbUrl = String($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    if (!apiUrl || !apiKey || !pbUrl) return e.json(503, { error: 'CONFIGURACAO_SERVIDOR_AUSENTE' })

    if (eventType === 'deal_note_add') {
      var noteId = clean(form['note[id]'], 80)
      if (!/^[0-9]+$/.test(noteId)) return e.json(400, { error: 'NOTE_ID_INVALIDO' })
      var note
      try {
        note = apiCall(apiUrl, apiKey, '/api/3/notes/' + encodeURIComponent(noteId)).note || null
      } catch (noteFetchError) {
        return e.json(502, { error: 'CONSULTA_NOTA_AC_FALHOU' })
      }
      if (
        !note ||
        String(note.reltype || '').toLowerCase() !== 'deal' ||
        String(note.relid) !== dealId
      )
        return e.json(422, { error: 'NOTA_FORA_DO_NEGOCIO' })
      var businessLink
      try {
        businessLink = $app.findFirstRecordByFilter(
          'com_vinculos_externos',
          "sistema_origem='activecampaign' && external_type='business' && external_id='" +
            dealId +
            "'",
        )
      } catch (_) {
        return e.json(200, {
          received: true,
          ignored: true,
          reason: 'NEGOCIO_NAO_ESPELHADO',
          deal_id: dealId,
        })
      }
      var existingNote = null
      try {
        existingNote = $app.findFirstRecordByData('com_notas_negocio', 'external_id', noteId)
      } catch (_) {}
      if (existingNote)
        return e.json(200, {
          received: true,
          ignored: false,
          replay: true,
          note_id: noteId,
          deal_id: dealId,
        })
      var notesCollection = $app.findCollectionByNameOrId('com_notas_negocio')
      var noteRecord = new Record(notesCollection)
      noteRecord.set('negocio_id', businessLink.getString('record_id'))
      noteRecord.set('external_id', noteId)
      noteRecord.set('texto', String(note.note || ''))
      noteRecord.set('autor_external_id', String(note.userid || ''))
      noteRecord.set('criada_em', note.cdate)
      noteRecord.set('alterada_em', note.mdate || null)
      noteRecord.set('origem', 'activecampaign')
      try {
        $app.save(noteRecord)
      } catch (saveNoteError) {
        try {
          $app.findFirstRecordByData('com_notas_negocio', 'external_id', noteId)
          return e.json(200, {
            received: true,
            ignored: false,
            replay: true,
            note_id: noteId,
            deal_id: dealId,
          })
        } catch (_) {
          return e.json(500, { error: 'PERSISTENCIA_NOTA_FALHOU' })
        }
      }
      return e.json(200, {
        received: true,
        ignored: false,
        replay: false,
        note_id: noteId,
        deal_id: dealId,
      })
    }

    var deal,
      contact,
      account,
      stage,
      customByLabel = {}
    try {
      deal = apiCall(apiUrl, apiKey, '/api/3/deals/' + encodeURIComponent(dealId)).deal || null
      if (!deal) throw new Error('AC_DEAL_AUSENTE')
      var contactId = clean(deal.contact, 40)
      if (!/^[0-9]+$/.test(contactId)) throw new Error('AC_CONTATO_AUSENTE')
      contact =
        apiCall(apiUrl, apiKey, '/api/3/contacts/' + encodeURIComponent(contactId)).contact || null
      if (!contact) throw new Error('AC_CONTATO_AUSENTE')
      var accountId = clean(
        deal.account || deal.organization || contact.account || contact.organization,
        40,
      )
      if (!/^[0-9]+$/.test(accountId)) throw new Error('AC_EMPRESA_AUSENTE')
      account =
        apiCall(apiUrl, apiKey, '/api/3/accounts/' + encodeURIComponent(accountId)).account || null
      if (!account) throw new Error('AC_EMPRESA_AUSENTE')
      stage =
        apiCall(apiUrl, apiKey, '/api/3/dealStages/' + encodeURIComponent(deal.stage)).dealStage ||
        null
      if (!stage) throw new Error('AC_ETAPA_AUSENTE')
      var pipeline =
        apiCall(apiUrl, apiKey, '/api/3/dealGroups/' + encodeURIComponent(deal.group)).dealGroup ||
        null
      if (!pipeline) throw new Error('AC_PIPELINE_AUSENTE')

      var meta = list(apiUrl, apiKey, '/api/3/dealCustomFieldMeta', 'dealCustomFieldMeta', '')
      var labels = {}
      for (var mi = 0; mi < meta.length; mi++)
        labels[String(meta[mi].id)] = clean(meta[mi].fieldLabel, 160)
      var customRows = list(
        apiUrl,
        apiKey,
        '/api/3/dealCustomFieldData',
        'dealCustomFieldData',
        '&filters[dealId]=' + encodeURIComponent(dealId),
      )
      for (var ci = 0; ci < customRows.length; ci++) {
        if (String(customRows[ci].dealId || '') !== dealId) continue
        var fieldId = String(customRows[ci].customFieldId || '')
        var fieldVal = clean(customRows[ci].fieldValue, 500)
        if (fieldId) customByLabel['meta:' + fieldId] = fieldVal
        var label = labels[fieldId] || ''
        if (label) customByLabel[label] = fieldVal
      }
    } catch (fetchError) {
      return e.json(502, { error: 'CONSULTA_AC_FALHOU', detail: String(fetchError).slice(0, 120) })
    }

    var stageTitle = clean(stage.title, 120).toLowerCase()
    var canonicalStage = ''
    if (stageTitle === 'prospects') canonicalStage = 'prospects'
    if (stageTitle === 'produção proposta' || stageTitle === 'produção de proposta')
      canonicalStage = 'producao_proposta'
    if (stageTitle === 'negociação') canonicalStage = 'negociacao'
    if (String(deal.status) === '0' && !canonicalStage)
      return e.json(422, { error: 'ETAPA_NAO_MAPEADA' })
    var prospectCutoff = Date.parse('2026-08-24T03:00:00.000Z')
    if (canonicalStage === 'prospects' && (!deal.cdate || Date.parse(deal.cdate) < prospectCutoff))
      return e.json(200, {
        received: true,
        ignored: true,
        reason: 'PROSPECT_ANTERIOR_AO_CORTE',
        deal_id: dealId,
      })
    var ownerCode = clean(customByLabel['Responsável'], 120)
    if (canonicalStage !== 'prospects' && !ownerCode)
      return e.json(422, { error: 'RESPONSAVEL_COMERCIAL_AUSENTE' })
    var stageEnteredAt = ''
    if (canonicalStage === 'prospects') stageEnteredAt = deal.cdate || ''
    if (canonicalStage === 'producao_proposta' && eventType === 'deal_add')
      stageEnteredAt = deal.cdate || ''
    if (canonicalStage === 'negociacao') stageEnteredAt = customByLabel['Data_Negociacao'] || ''
    var terminalAt =
      String(deal.status) === '1'
        ? customByLabel['Data_Fechamento'] || ''
        : String(deal.status) === '2'
          ? customByLabel['Data_Cancelamento'] || ''
          : ''

    var correlation = 'ac-native-' + dealId + '-' + String(deal.mdate || deal.cdate || Date.now())
    correlation = correlation.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 120)
    var companyEvent = envelope(
      'company',
      account.id,
      account.updatedTimestamp || account.createdTimestamp,
      { name: account.name || '' },
      {},
      correlation,
    )
    var contactEvent = envelope(
      'contact',
      contact.id,
      contact.updated_timestamp || contact.cdate,
      {
        first_name: contact.firstName || '',
        last_name: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
      },
      { company_id: String(account.id) },
      correlation,
    )
    var businessEvent = envelope(
      'business',
      deal.id,
      deal.mdate || deal.cdate,
      {
        title: deal.title || '',
        value_cents: Number(deal.value || 0),
        stage: canonicalStage,
        status: String(deal.status || '0'),
        modality: customByLabel['Modalidade'] || '',
        next_action_at: customByLabel['Data de Ação'] || deal.nextdate || '',
        crm_created_at: deal.cdate || '',
        crm_updated_at: deal.mdate || deal.cdate || '',
        stage_entered_at: stageEnteredAt,
        negotiation_entered_at: customByLabel['Data_Negociacao'] || '',
        won_at: customByLabel['Data_Fechamento'] || '',
        lost_at: customByLabel['Data_Cancelamento'] || '',
        phase: customByLabel['Fase'] || '',
        source: customByLabel['Fonte de Prospecção'] || '',
        loss_reason: customByLabel['Motivo Perda'] || '',
        closed_at: terminalAt,
        recovery_at:
          customByLabel['meta:42'] || customByLabel['Data de Recuperação Comercial'] || '',
        prospect_cutoff_applied: canonicalStage === 'prospects',
      },
      {
        company_id: String(account.id),
        contact_id: String(contact.id),
        owner_code: ownerCode,
      },
      correlation,
    )
    var results = []
    try {
      results.push(forward(pbUrl, secret, companyEvent))
      results.push(forward(pbUrl, secret, contactEvent))
      results.push(forward(pbUrl, secret, businessEvent))
    } catch (forwardError) {
      return e.json(502, {
        error: 'PROCESSAMENTO_V1_FALHOU',
        detail: String(forwardError).slice(0, 120),
      })
    }
    var provelo = null
    try {
      provelo = proveloDispatch(deal, pipeline, stage.title, contact, customByLabel)
    } catch (proveloError) {
      return e.json(502, {
        error: 'PROVELO_DISPATCH_FALHOU',
        detail: String(proveloError).replace('Error: ', '').slice(0, 120),
      })
    }
    if (provelo.attempted && !provelo.accepted)
      return e.json(502, {
        error: provelo.uncertain ? 'PROVELO_RESULTADO_INCERTO' : 'PROVELO_HTTP_FALHOU',
        deal_id: dealId,
      })
    return e.json(200, {
      received: true,
      ignored: false,
      event_type: eventType,
      deal_id: dealId,
      correlation_id: correlation,
      provelo: provelo,
      results: results.map(function (item) {
        return {
          event_id: item.event_id || '',
          record_id: item.record_id || '',
          replay: item.replay === true,
          stale: item.stale === true,
        }
      }),
    })
  },
  $apis.bodyLimit(131072),
)
