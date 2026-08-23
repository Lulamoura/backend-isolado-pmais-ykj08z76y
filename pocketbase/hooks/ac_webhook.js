// T6.AC.8-R — endpoint único do envelope ActiveCampaign V1.
// Inerte por padrão. Cada evento válido é processado em uma única transação.

routerAdd(
  'POST',
  '/backend/v1/integracao/ac/webhook',
  function (e) {
    function paramTrue(key) {
      try {
        var record = $app.findFirstRecordByData('com_parametros', 'chave', key)
        return record.getBool('ativo') && record.getString('valor') === 'true'
      } catch (_) {
        return false
      }
    }
    function canonical(value) {
      if (value === null || value === undefined) return 'null'
      if (typeof value !== 'object') return JSON.stringify(value)
      if (Array.isArray(value)) {
        var arrayParts = []
        for (var ai = 0; ai < value.length; ai++) arrayParts.push(canonical(value[ai]))
        return '[' + arrayParts.join(',') + ']'
      }
      var keys = Object.keys(value).sort(),
        parts = []
      for (var ki = 0; ki < keys.length; ki++)
        parts.push(JSON.stringify(keys[ki]) + ':' + canonical(value[keys[ki]]))
      return '{' + parts.join(',') + '}'
    }
    function equalSignature(left, right) {
      if (left.length !== right.length) return false
      var diff = 0
      for (var i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
      return diff === 0
    }
    function clean(value, max) {
      var text = String(value || '').trim()
      return text.length <= max ? text : ''
    }
    function validate(event) {
      var required = [
        'schema_version',
        'event_id',
        'source',
        'entity_type',
        'entity_id',
        'action',
        'occurred_at',
        'source_version',
        'correlation_id',
        'data',
      ]
      for (var i = 0; i < required.length; i++)
        if (event[required[i]] === undefined || event[required[i]] === '') return required[i]
      if (event.schema_version !== '1' || event.source !== 'activecampaign') return 'contract'
      if (['company', 'contact', 'business'].indexOf(event.entity_type) === -1) return 'entity_type'
      if (['upsert', 'archive'].indexOf(event.action) === -1) return 'action'
      if (isNaN(Date.parse(event.occurred_at))) return 'occurred_at'
      if (Math.abs(Date.now() - Date.parse(event.occurred_at)) > 300000) return 'occurred_at_window'
      return ''
    }

    if (!paramTrue('ac_webhook_enabled'))
      return e.json(503, { error: 'WEBHOOK_DESABILITADO', enabled: false, contract: 'v1' })
    var contentType = e.request.header.get('Content-Type') || ''
    if (contentType.indexOf('application/json') === -1)
      return e.json(400, { error: 'CONTENT_TYPE_INVALIDO' })
    var rawBody = toString(e.request.body)
    if (!rawBody) return e.json(400, { error: 'CORPO_VAZIO' })
    var signature = String(e.request.header.get('X-AC-Signature') || '').toLowerCase()
    var secret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    if (!/^[0-9a-f]{64}$/.test(signature) || !secret)
      return e.json(401, { error: 'ASSINATURA_INVALIDA' })
    if (!equalSignature($security.hs256(rawBody, secret), signature))
      return e.json(401, { error: 'ASSINATURA_INVALIDA' })
    var event
    try {
      event = JSON.parse(rawBody)
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var invalid = validate(event)
    if (invalid) return e.json(400, { error: 'ENVELOPE_INVALIDO', field: invalid })
    if ((e.request.header.get('X-Correlation-Id') || '') !== event.correlation_id)
      return e.json(400, { error: 'CORRELACAO_DIVERGENTE' })

    var eventHash = $security.sha256(canonical(event))
    var idempotencyKey = $security.sha256('activecampaign|' + event.event_id)
    var replay = null
    try {
      replay = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        idempotencyKey,
      )
    } catch (_) {}
    if (replay) {
      var replayData = {}
      try {
        replayData = JSON.parse(replay.getString('payload') || '{}')
      } catch (_) {}
      return e.json(200, {
        received: true,
        replay: true,
        stale: false,
        event_id: event.event_id,
        record_id: replayData.record_id || '',
      })
    }

    var previous = null,
      previousPayload = {}
    try {
      var prior = $app.findRecordsByFilter(
        'com_eventos_integracao',
        "sistema_origem='activecampaign' && external_id='" +
          event.entity_type +
          ':' +
          event.entity_id +
          "' && status='processed'",
        '-created',
        1,
        0,
      )
      if (prior.length) {
        previous = prior[0]
        previousPayload = JSON.parse(previous.getString('payload') || '{}')
      }
    } catch (_) {}
    if (previous) {
      if (String(event.source_version) < String(previousPayload.source_version || ''))
        return e.json(200, { received: true, replay: false, stale: true, event_id: event.event_id })
      if (
        String(event.source_version) === String(previousPayload.source_version || '') &&
        previousPayload.event_hash !== eventHash
      )
        return e.json(409, { error: 'VERSAO_CONFLITANTE', event_id: event.event_id })
    }

    var result = null,
      transactionError = ''
    try {
      $app.runInTransaction(function (tx) {
        var collectionName =
          event.entity_type === 'company'
            ? 'com_empresas'
            : event.entity_type === 'contact'
              ? 'com_contatos'
              : 'com_negocios'
        var binding = null
        try {
          binding = tx.findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='" +
              event.entity_type +
              "' && external_id='" +
              event.entity_id +
              "'",
          )
        } catch (_) {}
        var target = binding
          ? tx.findRecordById(collectionName, binding.getString('record_id'))
          : new Record(tx.findCollectionByNameOrId(collectionName))
        if (event.entity_type === 'company') {
          target.set('nome', clean(event.data.name, 200) || 'Empresa importada')
          target.set('status', event.action === 'archive' ? 'inativo' : 'prospecto')
        } else if (event.entity_type === 'contact') {
          var fullName = clean(
            (event.data.first_name || '') + ' ' + (event.data.last_name || ''),
            200,
          )
          target.set('nome', fullName || 'Contato importado')
          target.set('email', clean(event.data.email, 240))
          target.set('telefone', clean(event.data.phone, 40))
          target.set('ativo', event.action !== 'archive')
          if (event.links && event.links.company_id) {
            var companyBinding = tx.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='company' && external_id='" +
                event.links.company_id +
                "'",
            )
            target.set('empresa_id', companyBinding.getString('record_id'))
          }
        } else {
          var links = event.links || {}
          if (!links.company_id || !links.contact_id || !links.owner_code)
            throw new Error('VINCULOS_OBRIGATORIOS_AUSENTES')
          var company = tx.findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='company' && external_id='" +
              links.company_id +
              "'",
          )
          var contact = tx.findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='contact' && external_id='" +
              links.contact_id +
              "'",
          )
          var owner = tx.findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='business_owner' && external_id='" +
              links.owner_code +
              "'",
          )
          var dealStatus = String(event.data.status)
          if (dealStatus !== '0' && dealStatus !== '1' && dealStatus !== '2')
            throw new Error('STATUS_AC_INVALIDO')
          if (binding) {
            var snapshot = new Record(tx.findCollectionByNameOrId('com_snapshots_negocio'))
            snapshot.set('negocio_id', target.id)
            snapshot.set(
              'snapshot',
              JSON.stringify({
                titulo: target.getString('titulo'),
                valor: target.get('valor'),
                etapa: target.getString('etapa'),
                status: target.getString('status'),
              }),
            )
            snapshot.set('origem', 'activecampaign')
            tx.save(snapshot)
          }
          target.set('titulo', clean(event.data.title, 300) || 'Negocio importado')
          target.set('empresa_id', company.getString('record_id'))
          target.set('contato_principal_id', contact.getString('record_id'))
          target.set('responsavel_id', owner.getString('record_id'))
          target.set('valor', Number(event.data.value_cents || 0) / 100)
          if (dealStatus === '0') {
            var alias = tx.findFirstRecordByFilter(
              'com_alias_dimensoes',
              "dimensao='etapa' && valor_original='" + clean(event.data.stage, 120) + "'",
            )
            var canonicalStage = tx
              .findRecordById('com_etapas', alias.getString('canonico_ref'))
              .getString('codigo')
            target.set('etapa', canonicalStage)
            target.set('resultado', '')
          } else {
            target.set('etapa', '')
            target.set('resultado', dealStatus === '1' ? 'ganho' : 'perdido')
          }
          target.set('origem_canal', 'activecampaign')
          target.set('prospectivo', false)
          target.set('inativo', event.action === 'archive')
          if (event.data.modality) target.set('modalidade', clean(event.data.modality, 120))
        }
        tx.save(target)
        if (!binding) {
          binding = new Record(tx.findCollectionByNameOrId('com_vinculos_externos'))
          binding.set('sistema_origem', 'activecampaign')
          binding.set('external_type', event.entity_type)
          binding.set('external_id', event.entity_id)
          binding.set('collection_name', collectionName)
          binding.set('record_id', target.id)
          tx.save(binding)
        }
        var storedEvent = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
        storedEvent.set('sistema_origem', 'activecampaign')
        storedEvent.set('evento_tipo', event.entity_type + '_' + event.action)
        storedEvent.set('external_id', event.entity_type + ':' + event.entity_id)
        storedEvent.set('idempotency_key', idempotencyKey)
        storedEvent.set(
          'payload',
          JSON.stringify({
            event_id: event.event_id,
            source_version: event.source_version,
            event_hash: eventHash,
            record_id: target.id,
            correlation_id: event.correlation_id,
          }).slice(0, 4000),
        )
        storedEvent.set('status', 'processed')
        tx.save(storedEvent)
        result = { record_id: target.id, event_record_id: storedEvent.id }
      })
    } catch (error) {
      transactionError = String(error).slice(0, 240)
    }
    if (transactionError)
      return e.json(409, { error: 'EVENTO_REVERTIDO', detail: transactionError })
    return e.json(200, {
      received: true,
      replay: false,
      stale: false,
      event_id: event.event_id,
      record_id: result.record_id,
    })
  },
  $apis.bodyLimit(262144),
)
