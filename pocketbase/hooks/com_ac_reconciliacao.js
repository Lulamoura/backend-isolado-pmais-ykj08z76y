// T6.AC — reconciliação administrativa ActiveCampaign -> Aplicativo.
// Inerte por padrão. A ativação exige o parâmetro ac_reconciliation_enabled=true
// em gate posterior. Segredos e chamadas ao AC permanecem exclusivamente no backend.

routerAdd(
  'POST',
  '/backend/v1/integracao/ac/reconciliacao/simular',
  function (e) {
    function canonicalize(value) {
      if (value === null || typeof value !== 'object') return JSON.stringify(value)
      if (Array.isArray(value)) {
        var items = []
        for (var item = 0; item < value.length; item++) items.push(canonicalize(value[item]))
        return '[' + items.join(',') + ']'
      }
      var keys = Object.keys(value).sort()
      var parts = []
      for (var key = 0; key < keys.length; key++)
        parts.push(JSON.stringify(keys[key]) + ':' + canonicalize(value[keys[key]]))
      return '{' + parts.join(',') + '}'
    }

    var actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticacao necessaria')
    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (!actor.getBool('ativo_comercial') || slug !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')

    var enabled = false
    try {
      var flag = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_reconciliation_enabled')
      enabled = flag.getBool('ativo') && flag.getString('valor') === 'true'
    } catch (_) {}
    if (!enabled) return e.json(503, { error: 'RECONCILIACAO_DESABILITADA', enabled: false })

    var requestBody = {}
    try {
      requestBody = e.requestInfo().body || {}
    } catch (_) {}
    var requestedMode = requestBody.mode || 'incremental'
    if (['incremental', 'initial_open_negotiation', 'synthetic'].indexOf(requestedMode) === -1)
      return e.json(400, { error: 'MODO_RECONCILIACAO_INVALIDO' })
    var apiUrl = String($secrets.get('AC_API_URL') || '').replace(/\/$/, '')
    var apiKey = $secrets.get('AC_API_KEY') || ''
    if (requestedMode !== 'synthetic' && (!apiUrl || !apiKey))
      return e.json(500, { error: 'CONFIGURACAO_AC_AUSENTE' })

    var cursor = ''
    try {
      var cursorRec = $app.findFirstRecordByData(
        'com_parametros',
        'chave',
        'ac_reconciliation_cursor',
      )
      if (cursorRec.getBool('ativo')) cursor = cursorRec.getString('valor')
    } catch (_) {}
    if (requestedMode === 'initial_open_negotiation' || requestedMode === 'synthetic') cursor = ''
    if (requestedMode === 'incremental' && cursor === 'UNINITIALIZED')
      return e.json(409, { error: 'PRE_CARGA_INICIAL_PENDENTE' })
    var correlation =
      'ac-rec-' + $security.sha256(requestedMode + '|' + (cursor || 'initial')).substring(0, 20)
    var events = []
    var maxSeen = cursor

    function call(path) {
      var response = $http.send({
        url: apiUrl + path,
        method: 'GET',
        headers: { 'Api-Token': apiKey, Accept: 'application/json' },
        timeout: 20,
      })
      if (response.statusCode !== 200) throw new Error('AC_HTTP_' + response.statusCode)
      return response.json || {}
    }
    function version(value) {
      var result = value || new Date(0).toISOString()
      if (!maxSeen || result > maxSeen) maxSeen = result
      return result
    }
    function add(entityType, entityId, modified, data, links, archived) {
      var sourceVersion = version(modified)
      events.push({
        schema_version: '1',
        event_id: 'ac:' + entityType + ':' + entityId + ':' + sourceVersion,
        source: 'activecampaign',
        entity_type: entityType,
        entity_id: String(entityId),
        action: archived ? 'archive' : 'upsert',
        occurred_at: sourceVersion,
        source_version: sourceVersion,
        correlation_id: correlation,
        data: data,
        links: links || {},
      })
    }

    try {
      function list(path, key, supportsUpdatedFilter, extra) {
        var rows = [],
          limit = 50
        for (var page = 0; page < 100; page++) {
          var suffix = '?limit=' + limit + '&offset=' + page * limit
          if (cursor && supportsUpdatedFilter)
            suffix += '&filters[updated_after]=' + encodeURIComponent(cursor)
          if (extra) suffix += extra
          var response = call(path + suffix)
          var batch = response[key] || []
          for (var row = 0; row < batch.length; row++) rows.push(batch[row])
          if (batch.length < limit) return rows
        }
        throw new Error('AC_PAGINACAO_EXCEDE_LIMITE')
      }
      if (requestedMode === 'synthetic') {
        var syntheticEnabled = false
        try {
          var syntheticFlag = $app.findFirstRecordByData(
            'com_parametros',
            'chave',
            'ac_synthetic_preview_enabled',
          )
          syntheticEnabled =
            syntheticFlag.getBool('ativo') && syntheticFlag.getString('valor') === 'true'
        } catch (_) {}
        if (!syntheticEnabled) throw new Error('CANAL_SINTETICO_DESABILITADO')
        var syntheticEvents = requestBody.synthetic_events || []
        if (
          !Array.isArray(syntheticEvents) ||
          syntheticEvents.length < 1 ||
          syntheticEvents.length > 20
        )
          throw new Error('LOTE_SINTETICO_INVALIDO')
        for (var se = 0; se < syntheticEvents.length; se++) {
          if (
            String(syntheticEvents[se].event_id || '').indexOf('test:') !== 0 ||
            String(syntheticEvents[se].correlation_id || '').indexOf('t6-ac8-') !== 0 ||
            JSON.stringify(syntheticEvents[se]).indexOf('[TESTE]') === -1
          )
            throw new Error('EVENTO_SINTETICO_FORA_DO_ESCOPO')
          events.push(syntheticEvents[se])
          version(syntheticEvents[se].source_version)
        }
      }
      var stageCanonicalById = {}
      var allStages =
        requestedMode === 'synthetic' ? [] : list('/api/3/dealStages', 'dealStages', false, '')
      for (var asm = 0; asm < allStages.length; asm++) {
        var allStageTitle = String(allStages[asm].title || '').toLowerCase()
        if (allStageTitle === 'prospects')
          stageCanonicalById[String(allStages[asm].id)] = 'prospects'
        if (allStageTitle === 'produção proposta' || allStageTitle === 'produção de proposta')
          stageCanonicalById[String(allStages[asm].id)] = 'producao_proposta'
        if (allStageTitle === 'negociação')
          stageCanonicalById[String(allStages[asm].id)] = 'negociacao'
      }
      var accounts =
        requestedMode === 'synthetic' ? [] : list('/api/3/accounts', 'accounts', false, '')
      var contacts =
        requestedMode === 'synthetic'
          ? []
          : list('/api/3/contacts', 'contacts', true, '&orders[id]=ASC')
      var deals = requestedMode === 'synthetic' ? [] : list('/api/3/deals', 'deals', true, '')
      var customByDeal = {}
      if (requestedMode === 'initial_open_negotiation') {
        var groups = list('/api/3/dealGroups', 'dealGroups', false, '')
        var stages = allStages
        var pipelineId = '',
          negotiationStageId = ''
        for (var gi = 0; gi < groups.length; gi++)
          if (groups[gi].title === 'Propostas Qualificadas') pipelineId = String(groups[gi].id)
        for (var si = 0; si < stages.length; si++)
          if (
            String(stages[si].group) === pipelineId &&
            String(stages[si].title).toLowerCase() === 'negociação'
          )
            negotiationStageId = String(stages[si].id)
        for (var smi = 0; smi < stages.length; smi++) {
          var stageTitle = String(stages[smi].title || '').toLowerCase()
          if (stageTitle === 'prospects') stageCanonicalById[String(stages[smi].id)] = 'prospects'
          if (stageTitle === 'produção proposta' || stageTitle === 'produção de proposta')
            stageCanonicalById[String(stages[smi].id)] = 'producao_proposta'
          if (stageTitle === 'negociação') stageCanonicalById[String(stages[smi].id)] = 'negociacao'
        }
        if (!pipelineId || !negotiationStageId) throw new Error('ESCOPO_PRE_CARGA_NAO_MAPEADO')
        var selectedDeals = []
        for (var di = 0; di < deals.length; di++)
          if (
            String(deals[di].group) === pipelineId &&
            String(deals[di].status) === '0' &&
            String(deals[di].stage) === negotiationStageId
          )
            selectedDeals.push(deals[di])
        deals = selectedDeals
        var selectedContacts = {},
          selectedAccounts = {},
          selectedDealIds = {}
        for (var sd = 0; sd < deals.length; sd++) {
          selectedDealIds[String(deals[sd].id)] = true
          selectedContacts[String(deals[sd].contact || '')] = true
          selectedAccounts[String(deals[sd].account || deals[sd].organization || '')] = true
        }
        accounts = accounts.filter(function (row) {
          return selectedAccounts[String(row.id)] === true
        })
        contacts = contacts.filter(function (row) {
          return selectedContacts[String(row.id)] === true
        })
        var customMeta = list('/api/3/dealCustomFieldMeta', 'dealCustomFieldMeta', false, '')
        var fieldLabels = {}
        for (var cm = 0; cm < customMeta.length; cm++)
          fieldLabels[String(customMeta[cm].id)] = customMeta[cm].fieldLabel || ''
        var customRows = list('/api/3/dealCustomFieldData', 'dealCustomFieldData', false, '')
        for (var cr = 0; cr < customRows.length; cr++) {
          var customDealId = String(customRows[cr].dealId || '')
          if (!selectedDealIds[customDealId]) continue
          if (!customByDeal[customDealId]) customByDeal[customDealId] = {}
          customByDeal[customDealId][fieldLabels[String(customRows[cr].customFieldId)]] = String(
            customRows[cr].fieldValue || '',
          ).trim()
        }
      }
      for (var a = 0; a < accounts.length; a++)
        add(
          'company',
          accounts[a].id,
          accounts[a].updatedTimestamp || accounts[a].createdTimestamp,
          { name: accounts[a].name || '' },
          {},
          accounts[a].isDisabled === true,
        )
      for (var c = 0; c < contacts.length; c++)
        add(
          'contact',
          contacts[c].id,
          contacts[c].updated_timestamp || contacts[c].cdate,
          {
            first_name: contacts[c].firstName || '',
            last_name: contacts[c].lastName || '',
            email: contacts[c].email || '',
            phone: contacts[c].phone || '',
          },
          { company_id: String(contacts[c].account || contacts[c].organization || '') },
          contacts[c].isDisabled === true,
        )
      for (var d = 0; d < deals.length; d++) {
        var customFields = customByDeal[String(deals[d].id)] || {}
        add(
          'business',
          deals[d].id,
          deals[d].mdate || deals[d].cdate,
          {
            title: deals[d].title || '',
            value_cents: Number(deals[d].value || 0),
            stage: stageCanonicalById[String(deals[d].stage)] || String(deals[d].stage || ''),
            status: String(deals[d].status || '0'),
            modality: customFields['Modalidade'] || '',
            next_action_at: customFields['Data de Ação'] || deals[d].nextdate || '',
            initial_load_scope:
              requestedMode === 'initial_open_negotiation' ? 'open_negotiation' : '',
          },
          {
            company_id: String(deals[d].account || deals[d].organization || ''),
            contact_id: String(deals[d].contact || ''),
            owner_code: customFields['Responsável'] || String(deals[d].owner || ''),
          },
          deals[d].isDisabled === true,
        )
      }
    } catch (fetchError) {
      return e.json(502, { error: 'CONSULTA_AC_FALHOU', detail: String(fetchError).slice(0, 120) })
    }

    var incomingCompanies = {},
      incomingContacts = {}
    for (var incoming = 0; incoming < events.length; incoming++) {
      if (events[incoming].entity_type === 'company')
        incomingCompanies[events[incoming].entity_id] = true
      if (events[incoming].entity_type === 'contact')
        incomingContacts[events[incoming].entity_id] = true
    }
    var actions = [],
      counts = { create: 0, update: 0, unchanged: 0, stale: 0, conflict: 0, error: 0 }
    for (var i = 0; i < events.length; i++) {
      var ev = events[i]
      var key = $security.sha256('activecampaign|' + ev.event_id)
      var existing = null
      try {
        existing = $app.findFirstRecordByData('com_eventos_integracao', 'idempotency_key', key)
      } catch (_) {}
      var kind = existing ? 'unchanged' : 'create'
      var binding = null
      try {
        binding = $app.findFirstRecordByFilter(
          'com_vinculos_externos',
          "sistema_origem='activecampaign' && external_type='" +
            ev.entity_type +
            "' && external_id='" +
            ev.entity_id +
            "'",
        )
      } catch (_) {}
      if (!existing && binding) kind = 'update'
      if (!existing && binding) {
        try {
          var previousEvents = $app.findRecordsByFilter(
            'com_eventos_integracao',
            "sistema_origem='activecampaign' && external_id='" +
              ev.entity_type +
              ':' +
              ev.entity_id +
              "' && status='processed' && (evento_tipo='" +
              ev.entity_type +
              "_upsert' || evento_tipo='" +
              ev.entity_type +
              "_archive')",
            '-created',
            1,
            0,
          )
          if (previousEvents.length) {
            var previous = JSON.parse(previousEvents[0].getString('payload') || '{}')
            var incomingHash = $security.sha256(JSON.stringify(ev))
            if (String(ev.source_version) < String(previous.source_version || '')) kind = 'stale'
            else if (
              String(ev.source_version) === String(previous.source_version || '') &&
              incomingHash !== previous.event_hash
            )
              kind = 'conflict'
          }
        } catch (_) {
          kind = 'error'
        }
      }
      if (ev.entity_type === 'business') {
        if (!ev.links.company_id || !ev.links.contact_id || !ev.links.owner_code) kind = 'error'
        try {
          if (!incomingCompanies[ev.links.company_id])
            $app.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='company' && external_id='" +
                ev.links.company_id +
                "'",
            )
          if (!incomingContacts[ev.links.contact_id])
            $app.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='contact' && external_id='" +
                ev.links.contact_id +
                "'",
            )
          $app.findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='business_owner' && external_id='" +
              ev.links.owner_code +
              "'",
          )
          $app.findFirstRecordByFilter(
            'com_alias_dimensoes',
            "dimensao='etapa' && valor_original='" + ev.data.stage + "'",
          )
        } catch (_) {
          kind = 'error'
        }
      }
      counts[kind]++
      actions.push({ kind: kind, event: ev, idempotency_key: key })
    }
    var planCore = {
      mode: requestedMode,
      cursor_from: cursor || null,
      cursor_to: maxSeen || cursor || null,
      actions: actions,
    }
    // A revalidação trafega por HTTP, que pode reorganizar as chaves dos objetos.
    // O fingerprint precisa representar o conteúdo, não a ordem incidental do JSON.
    var fingerprint = $security.sha256(canonicalize(planCore))
    var expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    var execCol = $app.findCollectionByNameOrId('com_execucoes_sincronizacao')
    var dry = new Record(execCol)
    dry.set('sistema_origem', 'activecampaign')
    dry.set('status', 'simulated')
    dry.set(
      'payload',
      JSON.stringify({
        actor_id: actor.id,
        fingerprint: fingerprint,
        expires_at: expiresAt,
        counts: counts,
        plan: { cursor_from: planCore.cursor_from, cursor_to: planCore.cursor_to },
        mode: requestedMode,
      }).slice(0, 4000),
    )
    dry.set('inicio', new Date().toISOString())
    dry.set('fim', new Date().toISOString())
    $app.save(dry)
    var planEventCol = $app.findCollectionByNameOrId('com_eventos_integracao')
    for (var p = 0; p < actions.length; p++) {
      var planned = new Record(planEventCol)
      planned.set('sistema_origem', 'activecampaign')
      planned.set('evento_tipo', 'reconciliation_plan_item')
      planned.set('external_id', dry.id)
      planned.set(
        'idempotency_key',
        $security.sha256('dry-run|' + dry.id + '|' + actions[p].event.event_id),
      )
      planned.set('payload', JSON.stringify(actions[p]).slice(0, 4000))
      planned.set('status', 'planned')
      $app.save(planned)
      if (actions[p].kind === 'error' || actions[p].kind === 'conflict') {
        var quality = new Record($app.findCollectionByNameOrId('com_ocorrencias_qualidade'))
        quality.set('execucao_id', dry.id)
        quality.set('tipo', 'reconciliation_' + actions[p].kind)
        quality.set('severidade', actions[p].kind === 'conflict' ? 'critical' : 'error')
        quality.set(
          'descricao',
          'Evento bloqueado na simulacao: ' +
            actions[p].event.entity_type +
            ':' +
            actions[p].event.entity_id,
        )
        quality.set('resolvida', false)
        $app.save(quality)
      }
    }
    var blocked = counts.conflict > 0 || counts.error > 0
    return e.json(200, {
      dry_run_id: dry.id,
      fingerprint: fingerprint,
      cursor_from: planCore.cursor_from,
      cursor_to: planCore.cursor_to,
      expires_at: expiresAt,
      counts: counts,
      mode: requestedMode,
      can_execute: !blocked,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(8192),
)

routerAdd(
  'POST',
  '/backend/v1/integracao/ac/reconciliacao/executar',
  function (e) {
    var actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticacao necessaria')
    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (!actor.getBool('ativo_comercial') || slug !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')
    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}
    if (
      !body.dry_run_id ||
      !body.fingerprint ||
      !body.command_idempotency_key ||
      body.confirmation !== 'RECONCILIAR ACTIVECAMPAIGN'
    )
      return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })

    var repeated = null
    try {
      repeated = $app.findFirstRecordByData(
        'com_eventos_integracao',
        'idempotency_key',
        $security.sha256('reconcile-command|' + body.command_idempotency_key),
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

    var dry = null,
      stored = {}
    try {
      dry = $app.findRecordById('com_execucoes_sincronizacao', body.dry_run_id)
      stored = JSON.parse(dry.getString('payload') || '{}')
    } catch (_) {
      return e.json(409, { error: 'DRY_RUN_INEXISTENTE' })
    }
    if (
      dry.getString('status') !== 'simulated' ||
      stored.actor_id !== actor.id ||
      stored.fingerprint !== body.fingerprint ||
      Date.parse(stored.expires_at || '') < Date.now()
    )
      return e.json(409, { error: 'FINGERPRINT_OBSOLETO' })
    if ((stored.counts.conflict || 0) > 0 || (stored.counts.error || 0) > 0)
      return e.json(409, { error: 'PLANO_BLOQUEADO' })

    // Refaz a leitura imediatamente antes da escrita. O segundo dry-run usa a
    // mesma normalização determinística; qualquer mudança no AC ou no estado
    // local altera o fingerprint e interrompe a execução.
    var pbUrl = String($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var authHeader = e.request.header.get('Authorization') || ''
    if (!pbUrl || !authHeader) return e.json(500, { error: 'REVALIDACAO_INDISPONIVEL' })
    try {
      var recheck = $http.send({
        url: pbUrl + '/backend/v1/integracao/ac/reconciliacao/simular',
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: stored.mode || 'incremental',
          synthetic_events: body.synthetic_events || [],
          revalidation_of: dry.id,
        }),
        timeout: 60,
      })
      if (recheck.statusCode !== 200 || !recheck.json)
        return e.json(409, { error: 'REVALIDACAO_FALHOU' })
      if (recheck.json.fingerprint !== body.fingerprint)
        return e.json(409, { error: 'FINGERPRINT_OBSOLETO' })
    } catch (_) {
      return e.json(409, { error: 'REVALIDACAO_FALHOU' })
    }

    var running = []
    try {
      running = $app.findRecordsByFilter(
        'com_execucoes_sincronizacao',
        "sistema_origem='activecampaign' && status='processing'",
        '-created',
        1,
        0,
      )
    } catch (_) {}
    if (running.length) return e.json(423, { error: 'RECONCILIACAO_EM_ANDAMENTO' })

    var executionId = '',
      txError = ''
    try {
      $app.runInTransaction(function (tx) {
        var txDryGuard = tx.findRecordById('com_execucoes_sincronizacao', dry.id)
        if (txDryGuard.getString('status') !== 'simulated') throw new Error('DRY_RUN_CONSUMIDO')
        var txRunning = tx.findRecordsByFilter(
          'com_execucoes_sincronizacao',
          "sistema_origem='activecampaign' && status='processing'",
          '-created',
          1,
          0,
        )
        if (txRunning.length) throw new Error('RECONCILIACAO_EM_ANDAMENTO')
        var exec = new Record(tx.findCollectionByNameOrId('com_execucoes_sincronizacao'))
        exec.set('sistema_origem', 'activecampaign')
        exec.set('status', 'processing')
        exec.set('inicio', new Date().toISOString())
        exec.set('payload', JSON.stringify({ actor_id: actor.id, dry_run_id: dry.id }))
        tx.save(exec)
        executionId = exec.id
        var plannedRecords = tx.findRecordsByFilter(
          'com_eventos_integracao',
          "evento_tipo='reconciliation_plan_item' && external_id='" +
            dry.id +
            "' && status='planned'",
          'created',
          1000,
          0,
        )
        var actions = []
        for (var pr = 0; pr < plannedRecords.length; pr++) {
          try {
            actions.push(JSON.parse(plannedRecords[pr].getString('payload') || '{}'))
          } catch (_) {
            throw new Error('PLANO_PERSISTIDO_INVALIDO')
          }
        }
        for (var i = 0; i < actions.length; i++) {
          var action = actions[i]
          if (action.kind !== 'create' && action.kind !== 'update') continue
          var ev = action.event
          var binding = null
          try {
            binding = tx.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='" +
                ev.entity_type +
                "' && external_id='" +
                ev.entity_id +
                "'",
            )
          } catch (_) {}
          var collectionName =
            ev.entity_type === 'company'
              ? 'com_empresas'
              : ev.entity_type === 'contact'
                ? 'com_contatos'
                : 'com_negocios'
          var target = null
          if (binding) target = tx.findRecordById(collectionName, binding.getString('record_id'))
          if (!target) target = new Record(tx.findCollectionByNameOrId(collectionName))
          if (ev.entity_type === 'company') {
            target.set('nome', ev.data.name || 'Empresa importada')
            target.set('status', ev.action === 'archive' ? 'inativo' : 'prospecto')
          } else if (ev.entity_type === 'contact') {
            var name = ((ev.data.first_name || '') + ' ' + (ev.data.last_name || '')).trim()
            target.set('nome', name || 'Contato importado')
            target.set('email', ev.data.email || '')
            target.set('telefone', ev.data.phone || '')
            target.set('ativo', ev.action !== 'archive')
            if (ev.links.company_id) {
              var companyLink = tx.findFirstRecordByFilter(
                'com_vinculos_externos',
                "sistema_origem='activecampaign' && external_type='company' && external_id='" +
                  ev.links.company_id +
                  "'",
              )
              target.set('empresa_id', companyLink.getString('record_id'))
            }
          } else {
            var company = tx.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='company' && external_id='" +
                ev.links.company_id +
                "'",
            )
            var contact = tx.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='contact' && external_id='" +
                ev.links.contact_id +
                "'",
            )
            var owner = tx.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='business_owner' && external_id='" +
                ev.links.owner_code +
                "'",
            )
            var dealStatus = String(ev.data.status)
            if (dealStatus !== '0' && dealStatus !== '1' && dealStatus !== '2')
              throw new Error('STATUS_AC_INVALIDO')
            target.set('titulo', ev.data.title || 'Negocio importado')
            target.set('empresa_id', company.getString('record_id'))
            target.set('contato_principal_id', contact.getString('record_id'))
            target.set('responsavel_id', owner.getString('record_id'))
            target.set('valor', Math.round(Number(ev.data.value_cents || 0)))
            if (dealStatus === '0') {
              var alias = tx.findFirstRecordByFilter(
                'com_alias_dimensoes',
                "dimensao='etapa' && valor_original='" + ev.data.stage + "'",
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
            target.set('inativo', ev.action === 'archive')
            if (ev.data.modality) {
              var modality = String(ev.data.modality || '').trim().toLowerCase()
              if (modality === 'serv. recorrente' || modality === 'recorrente')
                target.set('modalidade', 'recorrente')
              else if (
                modality === 'serv. eventual' ||
                modality === 'eventos' ||
                modality === 'pontual'
              )
                target.set('modalidade', 'pontual')
              else throw new Error('MODALIDADE_AC_INVALIDA')
            }
          }
          tx.save(target)
          if (!binding) {
            binding = new Record(tx.findCollectionByNameOrId('com_vinculos_externos'))
            binding.set('sistema_origem', 'activecampaign')
            binding.set('external_type', ev.entity_type)
            binding.set('external_id', ev.entity_id)
            binding.set('collection_name', collectionName)
            binding.set('record_id', target.id)
            tx.save(binding)
          }
          var eventRecord = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
          eventRecord.set('sistema_origem', 'activecampaign')
          eventRecord.set('evento_tipo', ev.entity_type + '_' + ev.action)
          eventRecord.set('external_id', ev.entity_type + ':' + ev.entity_id)
          eventRecord.set('idempotency_key', action.idempotency_key)
          eventRecord.set(
            'payload',
            JSON.stringify({
              event_id: ev.event_id,
              source_version: ev.source_version,
              event_hash: $security.sha256(JSON.stringify(ev)),
            }).slice(0, 4000),
          )
          eventRecord.set('status', 'processed')
          tx.save(eventRecord)
        }
        for (var done = 0; done < plannedRecords.length; done++) {
          plannedRecords[done].set('status', 'consumed')
          tx.save(plannedRecords[done])
        }
        var command = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
        var result = {
          execution_id: exec.id,
          dry_run_id: dry.id,
          fingerprint: stored.fingerprint,
          cursor_from: stored.plan.cursor_from,
          cursor_to: stored.plan.cursor_to,
          expires_at: stored.expires_at,
          counts: stored.counts,
          mode: stored.mode || 'incremental',
          can_execute: true,
          status: 'completed',
          replay: false,
        }
        command.set('sistema_origem', 'activecampaign')
        command.set('evento_tipo', 'reconciliation_command')
        command.set('external_id', dry.id)
        command.set(
          'idempotency_key',
          $security.sha256('reconcile-command|' + body.command_idempotency_key),
        )
        command.set('payload', JSON.stringify(result).slice(0, 4000))
        command.set('status', 'processed')
        tx.save(command)
        exec.set('status', 'completed')
        exec.set('fim', new Date().toISOString())
        exec.set('payload', JSON.stringify(result).slice(0, 4000))
        tx.save(exec)
        var txDry = tx.findRecordById('com_execucoes_sincronizacao', dry.id)
        txDry.set('status', 'consumed')
        tx.save(txDry)
        try {
          var cursorRec = tx.findFirstRecordByData(
            'com_parametros',
            'chave',
            'ac_reconciliation_cursor',
          )
          cursorRec.set('valor', stored.plan.cursor_to || '')
          cursorRec.set('ativo', true)
          tx.save(cursorRec)
        } catch (_) {
          throw new Error('CURSOR_NAO_CONFIGURADO')
        }
      })
    } catch (error) {
      txError = String(error).slice(0, 240)
    }
    if (txError) return e.json(409, { error: 'EXECUCAO_REVERTIDA', detail: txError })
    return e.json(200, {
      execution_id: executionId,
      dry_run_id: dry.id,
      fingerprint: stored.fingerprint,
      cursor_from: stored.plan.cursor_from,
      cursor_to: stored.plan.cursor_to,
      expires_at: stored.expires_at,
      counts: stored.counts,
      mode: stored.mode || 'incremental',
      can_execute: true,
      status: 'completed',
      replay: false,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(8192),
)
