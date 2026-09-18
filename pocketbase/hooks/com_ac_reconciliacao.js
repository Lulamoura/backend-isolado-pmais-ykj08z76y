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
    function actionDateKey(value) {
      var text = String(value || '').trim()
      var civilDate = text.match(/^(\d{4}-\d{2}-\d{2})/)
      if (civilDate) return civilDate[1]
      var timestamp = Date.parse(text)
      return isNaN(timestamp) ? text : new Date(timestamp).toISOString().slice(0, 10)
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
        context_revision: entityType === 'business' ? '7' : '1',
        event_id:
          'ac:' +
          entityType +
          ':' +
          entityId +
          ':' +
          sourceVersion +
          (entityType === 'business' ? ':ctx7' : ''),
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
      var accounts = [],
        contacts = [],
        deals = []
      var customByDeal = {},
        initialCompanyByContact = {}
      if (requestedMode !== 'synthetic') {
        var groups = list('/api/3/dealGroups', 'dealGroups', false, '')
        var pipelineId = '',
          negotiationStageId = ''
        for (var gi = 0; gi < groups.length; gi++)
          if (groups[gi].title === 'Propostas Qualificadas') pipelineId = String(groups[gi].id)
        for (var smi = 0; smi < allStages.length; smi++) {
          if (String(allStages[smi].group) !== pipelineId) continue
          var stageTitle = String(allStages[smi].title || '').toLowerCase()
          if (stageTitle === 'prospects')
            stageCanonicalById[String(allStages[smi].id)] = 'prospects'
          if (stageTitle === 'produção proposta' || stageTitle === 'produção de proposta')
            stageCanonicalById[String(allStages[smi].id)] = 'producao_proposta'
          if (stageTitle === 'negociação') {
            stageCanonicalById[String(allStages[smi].id)] = 'negociacao'
            negotiationStageId = String(allStages[smi].id)
          }
        }
        if (!pipelineId || !negotiationStageId) throw new Error('ESCOPO_PRE_CARGA_NAO_MAPEADO')
        var candidateDeals =
          requestedMode === 'initial_open_negotiation'
            ? list(
                '/api/3/deals',
                'deals',
                true,
                '&filters[group]=' +
                  encodeURIComponent(pipelineId) +
                  '&filters[stage]=' +
                  encodeURIComponent(negotiationStageId) +
                  '&filters[status]=0' +
                  '&orders[id]=ASC',
              )
            : list('/api/3/deals', 'deals', true, '&orders[id]=ASC')
        var selectedDeals = []
        for (var di = 0; di < candidateDeals.length; di++) {
          var candidate = candidateDeals[di]
          if (requestedMode === 'incremental') version(candidate.mdate || candidate.cdate || '')
          if (String(candidate.group) !== pipelineId) continue
          var candidateStatus = String(candidate.status || '0')
          var candidateStage = stageCanonicalById[String(candidate.stage)] || ''
          var isOpenScope =
            candidateStatus === '0' &&
            (candidateStage === 'producao_proposta' ||
              candidateStage === 'negociacao' ||
              (candidateStage === 'prospects' &&
                candidate.cdate &&
                Date.parse(candidate.cdate) >= Date.parse('2026-08-24T03:00:00.000Z')))
          var isKnownTerminal = false
          if (requestedMode === 'incremental' && candidateStatus !== '0') {
            try {
              $app.findFirstRecordByFilter(
                'com_vinculos_externos',
                "sistema_origem='activecampaign' && external_type='business' && external_id='" +
                  candidate.id +
                  "'",
              )
              isKnownTerminal = true
            } catch (_) {}
          }
          if (
            (requestedMode === 'initial_open_negotiation' &&
              candidateStatus === '0' &&
              String(candidate.stage) === negotiationStageId) ||
            (requestedMode === 'incremental' && (isOpenScope || isKnownTerminal))
          )
            selectedDeals.push(candidate)
        }
        deals = selectedDeals
        var selectedContacts = {},
          selectedAccounts = {},
          selectedDealIds = {}
        for (var sd = 0; sd < deals.length; sd++) {
          var selectedContactId = String(deals[sd].contact || '')
          var selectedAccountId = String(deals[sd].account || deals[sd].organization || '')
          selectedDealIds[String(deals[sd].id)] = true
          selectedContacts[selectedContactId] = true
          selectedAccounts[selectedAccountId] = true
          if (selectedContactId && selectedAccountId)
            initialCompanyByContact[selectedContactId] = selectedAccountId
        }
        var selectedAccountIds = Object.keys(selectedAccounts)
        for (var sai = 0; sai < selectedAccountIds.length; sai++) {
          if (!selectedAccountIds[sai]) continue
          var accountResponse = call(
            '/api/3/accounts/' + encodeURIComponent(selectedAccountIds[sai]),
          )
          if (!accountResponse.account) throw new Error('AC_EMPRESA_AUSENTE')
          accounts.push(accountResponse.account)
        }
        var selectedContactIds = Object.keys(selectedContacts)
        for (var sci = 0; sci < selectedContactIds.length; sci++) {
          if (!selectedContactIds[sci]) continue
          var contactResponse = call(
            '/api/3/contacts/' + encodeURIComponent(selectedContactIds[sci]),
          )
          if (!contactResponse.contact) throw new Error('AC_CONTATO_AUSENTE')
          contacts.push(contactResponse.contact)
        }
        var customMeta = list('/api/3/dealCustomFieldMeta', 'dealCustomFieldMeta', false, '')
        var fieldLabels = {}
        for (var cm = 0; cm < customMeta.length; cm++)
          fieldLabels[String(customMeta[cm].id)] = customMeta[cm].fieldLabel || ''
        var customRows = []
        for (var sdi = 0; sdi < deals.length; sdi++) {
          var selectedCustomRows = []
          try {
            selectedCustomRows = list(
              '/api/3/dealCustomFieldData',
              'dealCustomFieldData',
              false,
              '&filters[dealId]=' + encodeURIComponent(String(deals[sdi].id)),
            )
          } catch (_) {
            var failedDealId = String(deals[sdi].id)
            if (!customByDeal[failedDealId]) customByDeal[failedDealId] = {}
            customByDeal[failedDealId].__custom_fetch_failed = 'CUSTOM_FIELDS_INDISPONIVEIS'
            continue
          }
          for (var scr = 0; scr < selectedCustomRows.length; scr++)
            customRows.push(selectedCustomRows[scr])
        }
        for (var cr = 0; cr < customRows.length; cr++) {
          var customDealId = String(customRows[cr].dealId || '')
          if (!selectedDealIds[customDealId]) continue
          if (!customByDeal[customDealId]) customByDeal[customDealId] = {}
          var fieldId = String(customRows[cr].customFieldId || '')
          var fieldVal = String(customRows[cr].fieldValue || '').trim()
          if (fieldId) customByDeal[customDealId]['meta:' + fieldId] = fieldVal
          var labelKey = fieldLabels[fieldId] || ''
          if (labelKey) customByDeal[customDealId][labelKey] = fieldVal
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
          {
            company_id:
              initialCompanyByContact[String(contacts[c].id)] ||
              String(contacts[c].account || contacts[c].organization || ''),
          },
          contacts[c].isDisabled === true,
        )
      for (var d = 0; d < deals.length; d++) {
        var customFields = customByDeal[String(deals[d].id)] || {}
        var dealStage = stageCanonicalById[String(deals[d].stage)] || String(deals[d].stage || '')
        if (
          dealStage === 'prospects' &&
          (!deals[d].cdate || Date.parse(deals[d].cdate) < Date.parse('2026-08-24T03:00:00.000Z'))
        )
          continue
        var knownBusiness = false
        try {
          $app.findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='business' && external_id='" +
              String(deals[d].id) +
              "'",
          )
          knownBusiness = true
        } catch (_) {}
        var stageEnteredAt = ''
        if (dealStage === 'prospects') stageEnteredAt = deals[d].cdate || ''
        if (
          dealStage === 'producao_proposta' &&
          !knownBusiness &&
          deals[d].cdate &&
          Date.parse(deals[d].cdate) >= Date.parse('2026-08-24T03:00:00.000Z')
        )
          stageEnteredAt = deals[d].cdate
        if (dealStage === 'negociacao') stageEnteredAt = customFields['Data_Negociacao'] || ''
        var terminalAt =
          String(deals[d].status) === '1'
            ? customFields['Data_Fechamento'] || ''
            : String(deals[d].status) === '2'
              ? customFields['Data_Cancelamento'] || ''
              : ''
        add(
          'business',
          deals[d].id,
          deals[d].mdate || deals[d].cdate,
          {
            title: deals[d].title || '',
            value_cents: Number(deals[d].value || 0),
            stage: dealStage,
            status: String(deals[d].status || '0'),
            modality: customFields['Modalidade'] || '',
            next_action_at: customFields['Data de Ação'] || deals[d].nextdate || '',
            crm_created_at: deals[d].cdate || '',
            crm_updated_at: deals[d].mdate || deals[d].cdate || '',
            stage_entered_at: stageEnteredAt,
            negotiation_entered_at: customFields['Data_Negociacao'] || '',
            won_at: customFields['Data_Fechamento'] || '',
            lost_at: customFields['Data_Cancelamento'] || '',
            phase: customFields['Fase'] || '',
            source: customFields['Fonte de Prospecção'] || '',
            loss_reason: customFields['Motivo Perda'] || '',
            custom_fields_status: customFields.__custom_fetch_failed || '',
            closed_at: terminalAt,
            recovery_at:
              customFields['meta:42'] || customFields['Data de Recuperação Comercial'] || '',
            initial_load_scope:
              requestedMode === 'initial_open_negotiation' ? 'open_negotiation' : '',
          },
          {
            company_id: String(deals[d].account || deals[d].organization || ''),
            contact_id: String(deals[d].contact || ''),
            owner_code: customFields['Responsável'] || '',
          },
          deals[d].isDisabled === true,
        )
      }
    } catch (fetchError) {
      return e.json(502, { error: 'CONSULTA_AC_FALHOU', detail: String(fetchError).slice(0, 120) })
    }

    var uniqueEvents = [],
      seenEventIds = {}
    for (var ui = 0; ui < events.length; ui++) {
      var evId = String(events[ui].event_id || '')
      if (evId) {
        if (seenEventIds[evId]) continue
        seenEventIds[evId] = true
      }
      uniqueEvents.push(events[ui])
    }
    events = uniqueEvents

    var incomingCompanies = {},
      incomingContacts = {}
    for (var incoming = 0; incoming < events.length; incoming++) {
      if (events[incoming].entity_type === 'company')
        incomingCompanies[events[incoming].entity_id] = true
      if (events[incoming].entity_type === 'contact')
        incomingContacts[events[incoming].entity_id] = true
    }
    function acExigeResponsavelComercial(stage) {
      return stage === 'producao_proposta' || stage === 'negociacao'
    }
    function motivoPendenciaAc(action) {
      var ev = action.event || {}
      var data = ev.data || {}
      if (action.pending && action.pending.motivo) return action.pending.motivo
      if (action.kind === 'conflict') return 'Conflito de versão: o negócio mudou desde o último processamento.'
      if (data.custom_fields_status) return 'Campos personalizados do ActiveCampaign indisponíveis para este negócio.'
      return 'Cadastro ou mapeamento incompleto para importar este negócio com segurança.'
    }
    function resumoPendenciaAc(action) {
      var ev = action.event || {}
      var data = ev.data || {}
      return {
        id_negocio: String(ev.entity_id || ''),
        titulo: String(data.title || data.name || ev.entity_type || '').slice(0, 160),
        motivo: motivoPendenciaAc(action),
        tipo: action.kind === 'conflict' ? 'conflito' : 'erro',
      }
    }
    var actions = [],
      pendingIssues = [],
      counts = { create: 0, update: 0, unchanged: 0, stale: 0, conflict: 0, error: 0 }
    for (var i = 0; i < events.length; i++) {
      var ev = events[i]
      var pendingIssue = null
      function setPendingIssue(motivo, tipo) {
        if (pendingIssue) return
        pendingIssue = {
          id_negocio: String(ev.entity_id || ''),
          titulo: String((ev.data && (ev.data.title || ev.data.name)) || ev.entity_type || '').slice(0, 160),
          motivo: motivo,
          tipo: tipo || 'erro',
        }
      }
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
              incomingHash !== previous.event_hash &&
              Number(ev.context_revision || 1) <= Number(previous.context_revision || 1)
            ) {
              kind = 'conflict'
              setPendingIssue('Conflito de versão: o negócio mudou desde o último processamento.', 'conflito')
            }
          }
        } catch (_) {
          kind = 'error'
          setPendingIssue('Não foi possível comparar este negócio com o histórico já processado.')
        }
      }
      if (ev.entity_type === 'business') {
        var eventStageForOwner = String(ev.data.stage || '')
        if (ev.data && ev.data.custom_fields_status) {
          kind = 'error'
          setPendingIssue('Campos personalizados do ActiveCampaign indisponíveis para este negócio.')
        }
        if (!ev.links.contact_id) {
          kind = 'error'
          setPendingIssue('Negócio sem contato vinculado no ActiveCampaign.')
        }
        if (acExigeResponsavelComercial(eventStageForOwner) && !ev.links.owner_code) {
          kind = 'error'
          setPendingIssue('Responsável comercial obrigatório a partir da fase Fazer Proposta, mas ausente ou não mapeado no ActiveCampaign.')
        }
        if (ev.links.company_id && !incomingCompanies[ev.links.company_id]) {
          try {
            $app.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='company' && external_id='" +
                ev.links.company_id +
                "'",
            )
          } catch (_) {
            kind = 'error'
            setPendingIssue('Empresa vinculada ao negócio ainda não está mapeada no Aplicativo Comercial.')
          }
        }
        if (ev.links.contact_id && !incomingContacts[ev.links.contact_id]) {
          try {
            $app.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='contact' && external_id='" +
                ev.links.contact_id +
                "'",
            )
          } catch (_) {
            kind = 'error'
            setPendingIssue('Contato principal ainda não está mapeado no Aplicativo Comercial.')
          }
        }
        // Prospects entram na fila compartilhada e só recebem responsável
        // quando uma operadora assume a qualificação. O proprietário técnico
        // do ActiveCampaign não deve bloquear essa entrada.
        if (ev.links.owner_code && acExigeResponsavelComercial(eventStageForOwner)) {
          try {
            $app.findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='business_owner' && external_id='" +
                ev.links.owner_code +
                "'",
            )
          } catch (_) {
            kind = 'error'
            setPendingIssue('Responsável comercial não está mapeado no Aplicativo Comercial.')
          }
        }
        if (String(ev.data.status) === '0') {
          try {
            $app.findFirstRecordByFilter(
              'com_alias_dimensoes',
              "dimensao='etapa' && valor_original='" + ev.data.stage + "'",
            )
          } catch (_) {
            kind = 'error'
            setPendingIssue('Etapa do ActiveCampaign não está mapeada para o funil comercial.')
          }
        }
      }
      counts[kind]++
      var plannedAction = { kind: kind, event: ev, idempotency_key: key }
      if (pendingIssue && (kind === 'error' || kind === 'conflict')) plannedAction.pending = pendingIssue
      actions.push(plannedAction)
      if (pendingIssue && (kind === 'error' || kind === 'conflict') && pendingIssues.length < 20)
        pendingIssues.push(pendingIssue)
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
    var expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    var dryId = ''
    try {
      $app.runInTransaction(function (tx) {
        var execCol = tx.findCollectionByNameOrId('com_execucoes_sincronizacao')
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
        tx.save(dry)
        dryId = dry.id
        var planEventCol = tx.findCollectionByNameOrId('com_eventos_integracao')
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
          tx.save(planned)
          if (actions[p].kind === 'error' || actions[p].kind === 'conflict') {
            var quality = new Record(tx.findCollectionByNameOrId('com_ocorrencias_qualidade'))
            quality.set('execucao_id', dry.id)
            quality.set('tipo', 'reconciliation_' + actions[p].kind)
            quality.set('severidade', actions[p].kind === 'conflict' ? 'critical' : 'error')
            quality.set(
              'descricao',
              'Evento bloqueado na simulacao: ' +
                actions[p].event.entity_type +
                ':' +
                actions[p].event.entity_id +
                ' — ' +
                motivoPendenciaAc(actions[p]),
            )
            quality.set('resolvida', false)
            tx.save(quality)
          }
        }
      })
    } catch (saveError) {
      return e.json(500, {
        error: 'SIMULACAO_FALHOU',
        detail: String(saveError).slice(0, 120),
      })
    }
    var blocked = counts.conflict > 0
    return e.json(200, {
      dry_run_id: dryId,
      fingerprint: fingerprint,
      cursor_from: planCore.cursor_from,
      cursor_to: planCore.cursor_to,
      expires_at: expiresAt,
      counts: counts,
      mode: requestedMode,
      can_execute: !blocked,
      pending_issues: pendingIssues,
    })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(8192),
)

routerAdd(
  'POST',
  '/backend/v1/integracao/ac/reconciliacao/executar',
  function (e) {
    function actionDateKey(value) {
      var text = String(value || '').trim()
      var civilDate = text.match(/^(\d{4}-\d{2}-\d{2})/)
      if (civilDate) return civilDate[1]
      var timestamp = Date.parse(text)
      return isNaN(timestamp) ? text : new Date(timestamp).toISOString().slice(0, 10)
    }
    function canonicalLossReason(value) {
      var normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
      var aliases = {
        preço: 'preco',
        preco: 'preco',
        'fechou com outra empresa': 'fechou_com_outra_empresa',
        'perdeu contato': 'perdeu_contato',
        desistiu: 'desistiu',
        'não atendido': 'nao_atendido',
        'nao atendido': 'nao_atendido',
      }
      return aliases[normalized] || ''
    }
    function devePreservarDesqualificacaoLocal(app, negocio) {
      if (
        negocio.getString('qualificacao') === 'desqualificada' ||
        negocio.getString('resultado') === 'desqualificado'
      )
        return true
      try {
        var historico = app.findRecordsByFilter(
          'com_qualificacao_historico',
          "negocio_id='" + negocio.id + "'",
          '-created',
          1,
          0,
        )
        return historico.length && historico[0].getString('estado_novo') === 'desqualificada'
      } catch (_) {
        return false
      }
    }
    function acExigeResponsavelComercial(stage) {
      return stage === 'producao_proposta' || stage === 'negociacao'
    }
    function telefoneAcSeguro(value) {
      var normalized = String(value || '').trim().replace(/\s+/g, ' ')
      return normalized.slice(0, 30)
    }
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
      return e.json(409, {
        error: 'FINGERPRINT_OBSOLETO',
        detail: 'Plano vencido ou alterado. Rode Verificar atualizações novamente e confirme o novo plano gerado.',
      })
    if ((stored.counts.conflict || 0) > 0)
      return e.json(409, {
        error: 'PLANO_BLOQUEADO',
        detail: 'O plano tem conflito crítico. Corrija a pendência indicada e rode nova verificação.',
      })

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
            target.set('telefone', telefoneAcSeguro(ev.data.phone))
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
            var company = null
            if (ev.links.company_id)
              company = tx.findFirstRecordByFilter(
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
            var owner = null
            var executionStageForOwner = String(ev.data.stage || '')
            if (ev.links.owner_code && acExigeResponsavelComercial(executionStageForOwner))
              owner = tx.findFirstRecordByFilter(
                'com_vinculos_externos',
                "sistema_origem='activecampaign' && external_type='business_owner' && external_id='" +
                  ev.links.owner_code +
                  "'",
              )
            var dealStatus = String(ev.data.status)
            var preserveLocalProspectDisqualification =
              !!binding &&
              dealStatus === '0' &&
              String(ev.data.stage || '') === 'prospects' &&
              devePreservarDesqualificacaoLocal(tx, target)
            var previousStage = target.getString('etapa')
            var previousNextAction = target.getString('proxima_acao_em')
            var nextAction = String(ev.data.next_action_at || '')
              .trim()
              .slice(0, 80)
            if (dealStatus !== '0' && dealStatus !== '1' && dealStatus !== '2')
              throw new Error('STATUS_AC_INVALIDO')
            target.set('titulo', ev.data.title || 'Negocio importado')
            target.set('empresa_id', company ? company.getString('record_id') : '')
            target.set('contato_principal_id', contact.getString('record_id'))
            target.set('responsavel_id', owner ? owner.getString('record_id') : '')
            target.set('valor', Math.round(Number(ev.data.value_cents || 0)))
            target.set('origem_canal', 'activecampaign')
            target.set('crm_created_at', ev.data.crm_created_at || '')
            target.set('crm_updated_at', ev.data.crm_updated_at || '')
            if (
              binding &&
              actionDateKey(previousNextAction) &&
              actionDateKey(nextAction) &&
              actionDateKey(previousNextAction) !== actionDateKey(nextAction)
            ) {
              var actionHistory = new Record(tx.findCollectionByNameOrId('com_negocio_historico'))
              actionHistory.set('negocio_id', target.id)
              actionHistory.set('justificativa', 'Data da Acao reagendada no ActiveCampaign')
              actionHistory.set('origem_alteracao', 'activecampaign_data_acao')
              actionHistory.set('data_acao_anterior', previousNextAction)
              actionHistory.set('data_acao_nova', nextAction)
              actionHistory.set(
                'reagendada_em',
                ev.data.crm_updated_at || ev.occurred_at || new Date().toISOString(),
              )
              actionHistory.set('reagendamento_external_id', ev.event_id + ':next_action')
              tx.save(actionHistory)
            }
            target.set('proxima_acao_em', nextAction)
            target.set(
              'fase_crm',
              String(ev.data.phase || '')
                .trim()
                .slice(0, 160),
            )
            target.set(
              'fonte_prospeccao',
              String(ev.data.source || '')
                .trim()
                .slice(0, 200),
            )
            if (dealStatus === '0') {
              if (preserveLocalProspectDisqualification) {
                // Decisão operacional tomada no aplicativo prevalece sobre
                // atualização aberta do ActiveCampaign ainda em prospects.
                // Sem esta guarda, webhook/reconciliação reabria o prospect e
                // ele voltava como vencido sem botões de decisão.
                target.set('etapa', '')
                target.set('resultado', 'desqualificado')
                target.set('qualificacao', 'desqualificada')
                target.set('proxima_acao_em', '')
              } else {
                var alias = tx.findFirstRecordByFilter(
                  'com_alias_dimensoes',
                  "dimensao='etapa' && valor_original='" + ev.data.stage + "'",
                )
                var canonicalStage = tx
                  .findRecordById('com_etapas', alias.getString('canonico_ref'))
                  .getString('codigo')
                if (canonicalStage !== previousStage)
                  target.set(
                    'etapa_entrou_em',
                    ev.data.stage_entered_at ||
                      ev.data.crm_updated_at ||
                      ev.data.crm_created_at ||
                      new Date().toISOString(),
                  )
                else if (!target.getString('etapa_entrou_em') && ev.data.stage_entered_at)
                  target.set('etapa_entrou_em', ev.data.stage_entered_at)
                target.set('etapa', canonicalStage)
                target.set('resultado', '')
                target.set(
                  'qualificacao',
                  canonicalStage === 'prospects' ? 'pendente' : 'qualificada',
                )
                target.set('fechamento_motivo', '')
                target.set('fechamento_data', '')
              }
            } else {
              target.set('etapa', '')
              target.set(
                'resultado',
                dealStatus === '1'
                  ? 'ganho'
                  : String(ev.data.stage || '') === 'prospects'
                    ? 'desqualificado'
                    : 'perdido',
              )
              if (String(ev.data.stage || '') === 'prospects')
                target.set('qualificacao', 'desqualificada')
              if (dealStatus === '1' && ev.data.closed_at)
                target.set('fechamento_data', ev.data.closed_at)
              if (dealStatus === '2' && String(ev.data.stage || '') !== 'prospects') {
                target.set('fechamento_motivo', canonicalLossReason(ev.data.loss_reason))
                if (ev.data.closed_at) target.set('fechamento_data', ev.data.closed_at)
              }
            }
            target.set(
              'inativo',
              preserveLocalProspectDisqualification ? true : ev.action === 'archive',
            )
            if (ev.data.modality) {
              var modality = String(ev.data.modality || '')
                .trim()
                .toLowerCase()
              if (modality === 'serv. recorrente' || modality === 'recorrente')
                target.set('modalidade', 'recorrente')
              else if (modality === 'evento' || modality === 'eventos')
                target.set('modalidade', 'evento')
              else if (modality === 'serv. eventual' || modality === 'serv eventual')
                target.set('modalidade', 'serv_eventual')
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
          if (
            ev.entity_type === 'business' &&
            target.getString('resultado') === 'perdido' &&
            ev.data &&
            actionDateKey(ev.data.recovery_at)
          ) {
            var recoveryDate = actionDateKey(ev.data.recovery_at)
            var recoveryKey = 'activecampaign:recovery:' + ev.entity_id
            var recoveryResponsibleId = target.getString('responsavel_id')
            if (recoveryResponsibleId) {
              var recoveryContext = JSON.stringify({
                origem: 'activecampaign',
                campo: 'Data de Recuperação Comercial',
                external_deal_id: String(ev.entity_id),
              })
              var existingAgenda = null
              try {
                existingAgenda = tx.findFirstRecordByData(
                  'com_recuperacao_agendas',
                  'creation_idempotency_key',
                  recoveryKey,
                )
              } catch (_) {}
              if (!existingAgenda) {
                try {
                  existingAgenda = tx.findFirstRecordByFilter(
                    'com_recuperacao_agendas',
                    "negocio_perdido_id='" + target.id + "' && estado='ativa'",
                  )
                } catch (_) {}
              }
              if (existingAgenda) {
                if (existingAgenda.getString('estado') !== 'descartada') {
                  existingAgenda.set('data_alvo', recoveryDate)
                  existingAgenda.set('antecedencia_dias', 60)
                  existingAgenda.set('responsavel_id', recoveryResponsibleId)
                  existingAgenda.set('autor_id', recoveryResponsibleId)
                  existingAgenda.set('estado', 'ativa')
                  existingAgenda.set('contexto', recoveryContext)
                  tx.save(existingAgenda)
                }
              } else {
                var newAgenda = new Record(tx.findCollectionByNameOrId('com_recuperacao_agendas'))
                newAgenda.set('negocio_perdido_id', target.id)
                newAgenda.set('data_alvo', recoveryDate)
                newAgenda.set('antecedencia_dias', 60)
                newAgenda.set('responsavel_id', recoveryResponsibleId)
                newAgenda.set('autor_id', recoveryResponsibleId)
                newAgenda.set('estado', 'ativa')
                newAgenda.set('contexto', recoveryContext)
                newAgenda.set('creation_idempotency_key', recoveryKey)
                tx.save(newAgenda)
              }
            }
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
              context_revision: ev.context_revision || '1',
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

routerAdd(
  'POST',
  '/backend/v1/admin/ac-local-decisions/reparar-casos',
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
    var confirmation = 'REPARAR DECISOES LOCAIS 4790 4787 4786 4667 4655 4653'
    if (body.confirmation !== confirmation || !body.command_idempotency_key)
      return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })

    var prospects = ['4790', '4787', '4786']
    var recuperacoes = ['4667', '4655', '4653']
    var justificativa =
      'Correção autorizada por Lula: preservar decisão local já tomada no aplicativo após ressincronização do ActiveCampaign.'
    var resposta = { prospects: [], recuperacoes: [] }
    var idemKey = $security.sha256('ac-local-decisions-repair|' + body.command_idempotency_key)
    try {
      var replay = $app.findFirstRecordByData('com_eventos_integracao', 'idempotency_key', idemKey)
      var replayPayload = JSON.parse(replay.getString('payload') || '{}')
      replayPayload.replay = true
      return e.json(200, replayPayload)
    } catch (_) {}

    function negocioPorExternalId(app, externalId) {
      var vinculo = app.findFirstRecordByFilter(
        'com_vinculos_externos',
        "sistema_origem='activecampaign' && external_type='business' && external_id='" +
          externalId +
          "'",
      )
      return app.findRecordById('com_negocios', vinculo.getString('record_id'))
    }

    $app.runInTransaction(function (tx) {
      for (var i = 0; i < prospects.length; i++) {
        var externalProspect = prospects[i]
        var negocio = negocioPorExternalId(tx, externalProspect)
        var historico = tx.findRecordsByFilter(
          'com_qualificacao_historico',
          "negocio_id='" + negocio.id + "' && estado_novo='desqualificada'",
          '-created',
          1,
          0,
        )
        if (!historico.length)
          throw new Error('HISTORICO_DESQUALIFICACAO_AUSENTE_' + externalProspect)
        negocio.set('etapa', '')
        negocio.set('resultado', 'desqualificado')
        negocio.set('qualificacao', 'desqualificada')
        negocio.set('inativo', true)
        negocio.set('proxima_acao_em', '')
        tx.save(negocio)
        resposta.prospects.push({
          external_id: externalProspect,
          negocio_id: negocio.id,
          estado: 'desqualificado',
        })

        var auditoriaProspect = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        auditoriaProspect.set('collection_name', 'com_negocios')
        auditoriaProspect.set('record_id', negocio.id)
        auditoriaProspect.set('acao', 'update')
        auditoriaProspect.set('usuario_id', actor.id)
        auditoriaProspect.set('comando', 'ac_local_decision_repair_desqualificacao')
        auditoriaProspect.set('command_idempotency_key', body.command_idempotency_key)
        auditoriaProspect.set('evento_em', new Date())
        auditoriaProspect.set('justificativa', justificativa)
        auditoriaProspect.set('perfil', slug)
        auditoriaProspect.set('escopo', 'activecampaign_local_decisions')
        auditoriaProspect.set('origem', 'server-side')
        auditoriaProspect.set('evidencia_estruturada', {
          external_id: externalProspect,
          reparo: 'desqualificacao_local',
        })
        auditoriaProspect.set(
          'snapshot_hash',
          $security.sha256(
            JSON.stringify({
              external_id: externalProspect,
              negocio_id: negocio.id,
              estado: 'desqualificado',
            }),
          ),
        )
        auditoriaProspect.set('snapshot_hash_versao', '1')
        tx.save(auditoriaProspect)
      }

      for (var r = 0; r < recuperacoes.length; r++) {
        var externalRecuperacao = recuperacoes[r]
        var negocioPerdido = negocioPorExternalId(tx, externalRecuperacao)
        var agendas = tx.findRecordsByFilter(
          'com_recuperacao_agendas',
          "negocio_perdido_id='" + negocioPerdido.id + "' && estado='ativa'",
          '-updated',
          20,
          0,
        )
        if (!agendas.length) throw new Error('AGENDA_ATIVA_AUSENTE_' + externalRecuperacao)
        for (var a = 0; a < agendas.length; a++) {
          agendas[a].set('estado', 'descartada')
          agendas[a].set('motivo_adiamento_descarte', justificativa)
          tx.save(agendas[a])
          resposta.recuperacoes.push({
            external_id: externalRecuperacao,
            negocio_id: negocioPerdido.id,
            agenda_id: agendas[a].id,
            estado: 'descartada',
          })

          var auditoriaRecuperacao = new Record(tx.findCollectionByNameOrId('com_auditoria'))
          auditoriaRecuperacao.set('collection_name', 'com_recuperacao_agendas')
          auditoriaRecuperacao.set('record_id', agendas[a].id)
          auditoriaRecuperacao.set('acao', 'update')
          auditoriaRecuperacao.set('usuario_id', actor.id)
          auditoriaRecuperacao.set('comando', 'ac_local_decision_repair_recuperacao')
          auditoriaRecuperacao.set('command_idempotency_key', body.command_idempotency_key)
          auditoriaRecuperacao.set('evento_em', new Date())
          auditoriaRecuperacao.set('justificativa', justificativa)
          auditoriaRecuperacao.set('perfil', slug)
          auditoriaRecuperacao.set('escopo', 'activecampaign_local_decisions')
          auditoriaRecuperacao.set('origem', 'server-side')
          auditoriaRecuperacao.set('evidencia_estruturada', {
            external_id: externalRecuperacao,
            agenda_id: agendas[a].id,
            reparo: 'recuperacao_descartada',
          })
          auditoriaRecuperacao.set(
            'snapshot_hash',
            $security.sha256(
              JSON.stringify({
                external_id: externalRecuperacao,
                agenda_id: agendas[a].id,
                estado: 'descartada',
              }),
            ),
          )
          auditoriaRecuperacao.set('snapshot_hash_versao', '1')
          tx.save(auditoriaRecuperacao)
        }
      }

      var evento = new Record(tx.findCollectionByNameOrId('com_eventos_integracao'))
      evento.set('sistema_origem', 'activecampaign')
      evento.set('evento_tipo', 'local_decisions_repair')
      evento.set('external_id', '4790,4787,4786,4667,4655,4653')
      evento.set('idempotency_key', idemKey)
      evento.set(
        'payload',
        JSON.stringify(Object.assign({ replay: false }, resposta)).slice(0, 4000),
      )
      evento.set('status', 'processed')
      tx.save(evento)
    })

    return e.json(200, Object.assign({ replay: false }, resposta))
  },
  $apis.requireAuth(),
  $apis.bodyLimit(4096),
)
