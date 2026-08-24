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
    function envelope(type, id, modified, data, links, correlation) {
      var sourceVersion = clean(modified, 80) || new Date(0).toISOString()
      return {
        schema_version: '1',
        context_revision: type === 'business' ? '4' : '1',
        event_id:
          'ac:' + type + ':' + id + ':' + sourceVersion + (type === 'business' ? ':ctx4' : ''),
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
    if (eventType !== 'deal_add' && eventType !== 'deal_update')
      return e.json(202, { received: true, ignored: true, reason: 'EVENTO_FORA_DO_ESCOPO' })
    var dealId = clean(form['deal[id]'] || form.dealid || form.id, 40)
    if (!/^[0-9]+$/.test(dealId)) return e.json(400, { error: 'DEAL_ID_INVALIDO' })

    var apiUrl = String($secrets.get('AC_API_URL') || '').replace(/\/$/, '')
    var apiKey = $secrets.get('AC_API_KEY') || ''
    var pbUrl = String($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    if (!apiUrl || !apiKey || !pbUrl) return e.json(503, { error: 'CONFIGURACAO_SERVIDOR_AUSENTE' })

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
        var label = labels[String(customRows[ci].customFieldId)] || ''
        if (label) customByLabel[label] = clean(customRows[ci].fieldValue, 500)
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
        phase: customByLabel['Fase'] || '',
        source: customByLabel['Fonte de Prospecção'] || '',
        loss_reason: customByLabel['Motivo Perda'] || '',
        closed_at: customByLabel['Data_Cancelamento'] || '',
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
    return e.json(200, {
      received: true,
      ignored: false,
      event_type: eventType,
      deal_id: dealId,
      correlation_id: correlation,
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
