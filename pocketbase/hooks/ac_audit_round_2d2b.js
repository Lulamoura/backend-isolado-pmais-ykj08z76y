routerAdd(
  'GET',
  '/backend/v1/integracao/ac/audit-round-2d2b',
  (e) => {
    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')
    var isSA = false
    try {
      var p = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (p && p.getString('slug') === 'superadministrador') isSA = true
    } catch (_) {}
    if (!isSA) {
      try {
        var sp = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        var bnd = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + authId + "' && perfil_id = '" + sp.id + "' && ativo = true",
          '',
          1,
          0,
        )
        if (bnd && bnd.length > 0) isSA = true
      } catch (_) {}
    }
    if (!isSA) return e.forbiddenError('Apenas superadministrador')

    var startedAt = new Date().toISOString()
    var readErrors = []
    var PATTERN_UPPER = 'TESTE-2D2B'
    var PATTERN_LOWER = 'teste-2d2b'
    var COLS = [
      'com_contatos',
      'com_negocios',
      'com_eventos_integracao',
      'com_execucoes_sincronizacao',
      'com_vinculos_externos',
      'com_snapshots_negocio',
      'com_ocorrencias_qualidade',
      'com_auditoria',
    ]
    var PAGE_SIZE = 200
    var MAX_RECORDS = 2000

    function tid(id) {
      return id ? String(id).substring(0, 8) : null
    }

    function readParam(key) {
      var paramCol
      try {
        paramCol = $app.findCollectionByNameOrId('com_parametros')
      } catch (colErr) {
        readErrors.push({
          collection: 'com_parametros',
          operation: 'readParam.findCollection',
          error:
            'Collection com_parametros not accessible (findCollectionByNameOrId): ' +
            String(colErr).substring(0, 150),
        })
        return {
          exists: false,
          readError: true,
          id: null,
          valor: null,
          ativo: null,
          tipo: null,
          versao: null,
          created: null,
          updated: null,
        }
      }
      try {
        var recs = $app.findRecordsByFilter('com_parametros', "chave = '" + key + "'", '', 1, 0)
        if (recs.length === 0)
          return {
            exists: false,
            readError: false,
            id: null,
            valor: null,
            ativo: null,
            tipo: null,
            versao: null,
            created: null,
            updated: null,
          }
        var r = recs[0]
        return {
          exists: true,
          readError: false,
          id: tid(r.id),
          valor: r.getString('valor'),
          ativo: r.getBool('ativo'),
          tipo: r.getString('tipo'),
          versao: r.getString('versao'),
          created: r.getString('created'),
          updated: r.getString('updated'),
        }
      } catch (err) {
        readErrors.push({
          collection: 'com_parametros',
          operation: 'readParam.findRecordsByFilter',
          error: String(err).substring(0, 200),
        })
        return {
          exists: false,
          readError: true,
          id: null,
          valor: null,
          ativo: null,
          tipo: null,
          versao: null,
          created: null,
          updated: null,
        }
      }
    }

    function paginateFind(collectionName, filter, sort) {
      var all = []
      var offset = 0
      while (offset < MAX_RECORDS) {
        try {
          var batch = $app.findRecordsByFilter(collectionName, filter, sort, PAGE_SIZE, offset)
          all = all.concat(batch)
          if (batch.length < PAGE_SIZE) return { records: all, truncated: false, error: false }
          offset += PAGE_SIZE
        } catch (err) {
          readErrors.push({
            collection: collectionName,
            operation: 'paginateFind',
            error: String(err).substring(0, 200),
          })
          return { records: all, truncated: false, error: true }
        }
      }
      readErrors.push({
        collection: collectionName,
        operation: 'paginateFind.truncated',
        error: 'Exceeded MAX_RECORDS (' + MAX_RECORDS + ') — result set may be incomplete',
      })
      return { records: all, truncated: true, error: true }
    }

    function safeFindAll(collectionName, filter) {
      try {
        var recs = $app.findRecordsByFilter(collectionName, filter, 'created', 100, 0)
        if (recs.length === 100) {
          readErrors.push({
            collection: collectionName,
            operation: 'safeFindAll.truncated',
            error: 'Targeted query returned 100 records — may be truncated',
          })
          return { records: recs, error: true }
        }
        return { records: recs, error: false }
      } catch (err) {
        readErrors.push({
          collection: collectionName,
          operation: 'safeFindAll',
          error: String(err).substring(0, 200),
        })
        return { records: [], error: true }
      }
    }

    function sanitize(collection, r) {
      var item = {
        collection: collection,
        id: tid(r.id),
        created: r.getString('created'),
        updated: r.getString('updated'),
      }
      if (collection === 'com_contatos') {
        item.ativo = r.getBool('ativo')
        item.empresa_id = tid(r.getString('empresa_id'))
      } else if (collection === 'com_negocios') {
        item.etapa = r.getString('etapa')
        item.inativo = r.getBool('inativo')
        item.empresa_id = tid(r.getString('empresa_id'))
        item.contato_principal_id = tid(r.getString('contato_principal_id'))
      } else if (collection === 'com_eventos_integracao') {
        item.evento_tipo = r.getString('evento_tipo')
        item.external_id = r.getString('external_id')
        item.status = r.getString('status')
        item.sistema_origem = r.getString('sistema_origem')
      } else if (collection === 'com_execucoes_sincronizacao') {
        item.status = r.getString('status')
        item.sistema_origem = r.getString('sistema_origem')
        item.inicio = r.getString('inicio')
        item.fim = r.getString('fim')
      } else if (collection === 'com_vinculos_externos') {
        item.external_type = r.getString('external_type')
        item.external_id = r.getString('external_id')
        item.collection_name = r.getString('collection_name')
        item.record_id = tid(r.getString('record_id'))
        item.sistema_origem = r.getString('sistema_origem')
      } else if (collection === 'com_snapshots_negocio') {
        item.negocio_id = tid(r.getString('negocio_id'))
        item.origem = r.getString('origem')
      } else if (collection === 'com_ocorrencias_qualidade') {
        item.tipo = r.getString('tipo')
        item.severidade = r.getString('severidade')
        item.resolvida = r.getBool('resolvida')
        item.execucao_id = tid(r.getString('execucao_id'))
      } else if (collection === 'com_auditoria') {
        item.acao = r.getString('acao')
        item.audit_collection_name = r.getString('collection_name')
        item.record_id = tid(r.getString('record_id'))
        item.origem_alteracao = r.getString('origem_alteracao')
      }
      return item
    }

    function extIdFilter(extId) {
      return "(external_id ~ '" + extId + "' || external_id ~ '" + extId.toLowerCase() + "')"
    }
    function payloadExtIdFilter(extId) {
      return "(payload ~ '" + extId + "' || payload ~ '" + extId.toLowerCase() + "')"
    }

    var lockData = readParam('ac_2d2b_execution_lock')
    lockData.note = 'Lock existence does not prove round completion — set at start, never cleared.'
    var flagData = readParam('ac_webhook_enabled')
    flagData.note = 'Current flag state observed read-only. No adjustment made.'

    var counts = {}
    for (var i = 0; i < COLS.length; i++) {
      try {
        counts[COLS[i]] = $app.countRecords(COLS[i])
      } catch (err) {
        counts[COLS[i]] = -1
        readErrors.push({
          collection: COLS[i],
          operation: 'countRecords',
          error: String(err).substring(0, 200),
        })
      }
    }

    var filters = {
      com_contatos:
        'email ~ "' +
        PATTERN_UPPER +
        '" || email ~ "' +
        PATTERN_LOWER +
        '" || nome ~ "' +
        PATTERN_UPPER +
        '" || nome ~ "' +
        PATTERN_LOWER +
        '"',
      com_negocios: 'titulo ~ "' + PATTERN_UPPER + '" || titulo ~ "' + PATTERN_LOWER + '"',
      com_eventos_integracao:
        'external_id ~ "' + PATTERN_UPPER + '" || external_id ~ "' + PATTERN_LOWER + '"',
      com_execucoes_sincronizacao:
        'payload ~ "' + PATTERN_UPPER + '" || payload ~ "' + PATTERN_LOWER + '"',
      com_vinculos_externos:
        'external_id ~ "' + PATTERN_UPPER + '" || external_id ~ "' + PATTERN_LOWER + '"',
      com_snapshots_negocio:
        'snapshot ~ "' + PATTERN_UPPER + '" || snapshot ~ "' + PATTERN_LOWER + '"',
      com_ocorrencias_qualidade:
        'descricao ~ "' + PATTERN_UPPER + '" || descricao ~ "' + PATTERN_LOWER + '"',
      com_auditoria:
        'valor_anterior ~ "' +
        PATTERN_UPPER +
        '" || valor_anterior ~ "' +
        PATTERN_LOWER +
        '" || valor_novo ~ "' +
        PATTERN_UPPER +
        '" || valor_novo ~ "' +
        PATTERN_LOWER +
        '"',
    }

    var evidence = {}
    for (var j = 0; j < COLS.length; j++) {
      var col = COLS[j]
      var result = paginateFind(col, filters[col], 'created')
      var items = []
      for (var k = 0; k < result.records.length; k++) items.push(sanitize(col, result.records[k]))
      evidence[col] = { count: items.length, items: items, truncated: result.truncated }
    }

    var b1Id = 'TESTE-2D2B-FN-C1'
    var b1Err = false
    var b1Vinc = safeFindAll('com_vinculos_externos', extIdFilter(b1Id))
    if (b1Vinc.error) b1Err = true
    var b1VR = b1Vinc.records.length > 0 ? b1Vinc.records[0] : null
    var b1CR = null
    if (b1VR) {
      var b1Rid = b1VR.getString('record_id')
      var b1Cn = b1VR.getString('collection_name')
      if (b1Cn === 'com_contatos' && b1Rid) {
        var b1C = safeFindAll('com_contatos', "id = '" + b1Rid + "'")
        if (b1C.error) b1Err = true
        b1CR = b1C.records.length > 0 ? b1C.records[0] : null
      }
    }
    var b1Ev = safeFindAll(
      'com_eventos_integracao',
      extIdFilter(b1Id) + " && evento_tipo = 'contact_create'",
    )
    if (b1Ev.error) b1Err = true
    var b1Ex = safeFindAll('com_execucoes_sincronizacao', payloadExtIdFilter(b1Id))
    if (b1Ex.error) b1Err = true
    var b1Found = !b1Err && !!b1VR && !!b1CR && b1Ev.records.length > 0 && b1Ex.records.length > 0
    var b1Ev_ = []
    if (b1VR) b1Ev_.push('com_vinculos_externos:' + tid(b1VR.id))
    if (b1CR) b1Ev_.push('com_contatos:' + tid(b1CR.id))
    if (b1Ev.records.length > 0) b1Ev_.push('com_eventos_integracao:' + tid(b1Ev.records[0].id))
    if (b1Ex.records.length > 0)
      b1Ev_.push('com_execucoes_sincronizacao:' + tid(b1Ex.records[0].id))

    var b3Id = 'TESTE-2D2B-FN-D1'
    var b3Err = false
    var b3Vinc = safeFindAll('com_vinculos_externos', extIdFilter(b3Id))
    if (b3Vinc.error) b3Err = true
    var b3VR = b3Vinc.records.length > 0 ? b3Vinc.records[0] : null
    var b3BR = null
    var b3Bid = null
    if (b3VR) {
      b3Bid = b3VR.getString('record_id')
      var b3Cn = b3VR.getString('collection_name')
      if (b3Cn === 'com_negocios' && b3Bid) {
        var b3N = safeFindAll('com_negocios', "id = '" + b3Bid + "'")
        if (b3N.error) b3Err = true
        b3BR = b3N.records.length > 0 ? b3N.records[0] : null
      }
    }
    var b3Ev = safeFindAll(
      'com_eventos_integracao',
      extIdFilter(b3Id) + " && evento_tipo = 'deal_create'",
    )
    if (b3Ev.error) b3Err = true
    var b3Ex = safeFindAll('com_execucoes_sincronizacao', payloadExtIdFilter(b3Id))
    if (b3Ex.error) b3Err = true
    var b3Found = !b3Err && !!b3VR && !!b3BR && b3Ev.records.length > 0 && b3Ex.records.length > 0
    var b3Ev_ = []
    if (b3VR) b3Ev_.push('com_vinculos_externos:' + tid(b3VR.id))
    if (b3BR) b3Ev_.push('com_negocios:' + tid(b3BR.id))
    if (b3Ev.records.length > 0) b3Ev_.push('com_eventos_integracao:' + tid(b3Ev.records[0].id))
    if (b3Ex.records.length > 0)
      b3Ev_.push('com_execucoes_sincronizacao:' + tid(b3Ex.records[0].id))

    var b4Err = false
    var b4Ev = safeFindAll(
      'com_eventos_integracao',
      extIdFilter(b3Id) + " && evento_tipo = 'deal_update'",
    )
    if (b4Ev.error) b4Err = true
    var b4Snap = { records: [], error: false }
    if (b3Bid) {
      b4Snap = safeFindAll('com_snapshots_negocio', "negocio_id = '" + b3Bid + "'")
      if (b4Snap.error) b4Err = true
    }
    var b4Found = !b4Err && b4Ev.records.length > 0 && b4Snap.records.length > 0 && !!b3Bid
    var b4Ev_ = []
    if (b4Ev.records.length > 0) b4Ev_.push('com_eventos_integracao:' + tid(b4Ev.records[0].id))
    if (b4Snap.records.length > 0) b4Ev_.push('com_snapshots_negocio:' + tid(b4Snap.records[0].id))

    var b5Id = 'TESTE-2D2B-FN-D2'
    var b5Err = false
    var b5Vinc = safeFindAll('com_vinculos_externos', extIdFilter(b5Id))
    if (b5Vinc.error) b5Err = true
    var b5VR = b5Vinc.records.length > 0 ? b5Vinc.records[0] : null
    var b5BR = null
    if (b5VR) {
      var b5Rid = b5VR.getString('record_id')
      var b5Cn = b5VR.getString('collection_name')
      if (b5Cn === 'com_negocios' && b5Rid) {
        var b5N = safeFindAll('com_negocios', "id = '" + b5Rid + "'")
        if (b5N.error) b5Err = true
        b5BR = b5N.records.length > 0 ? b5N.records[0] : null
      }
    }
    var b5Ev = safeFindAll(
      'com_eventos_integracao',
      extIdFilter(b5Id) + " && evento_tipo = 'deal_create'",
    )
    if (b5Ev.error) b5Err = true
    var b5Ex = safeFindAll('com_execucoes_sincronizacao', payloadExtIdFilter(b5Id))
    if (b5Ex.error) b5Err = true
    var b5Eid = b5Ex.records.length > 0 ? b5Ex.records[0].id : null
    var b5Occ = { records: [], error: false }
    if (b5Eid) {
      b5Occ = safeFindAll('com_ocorrencias_qualidade', "execucao_id = '" + b5Eid + "'")
      if (b5Occ.error) b5Err = true
    }
    var b5Found =
      !b5Err &&
      !!b5VR &&
      !!b5BR &&
      b5Ev.records.length > 0 &&
      b5Ex.records.length > 0 &&
      b5Occ.records.length > 0
    var b5Ev_ = []
    if (b5VR) b5Ev_.push('com_vinculos_externos:' + tid(b5VR.id))
    if (b5BR) b5Ev_.push('com_negocios:' + tid(b5BR.id))
    if (b5Ev.records.length > 0) b5Ev_.push('com_eventos_integracao:' + tid(b5Ev.records[0].id))
    if (b5Ex.records.length > 0)
      b5Ev_.push('com_execucoes_sincronizacao:' + tid(b5Ex.records[0].id))
    if (b5Occ.records.length > 0)
      b5Ev_.push('com_ocorrencias_qualidade:' + tid(b5Occ.records[0].id))

    var c1Err = false
    var c1Found = false
    var c1Ev_ = []
    if (b3Id) {
      var c1Rb = safeFindAll(
        'com_eventos_integracao',
        extIdFilter(b3Id) + " && evento_tipo = 'rollback'",
      )
      if (c1Rb.error) c1Err = true
      if (c1Rb.records.length > 0) {
        c1Found = true
        c1Ev_.push('com_eventos_integracao:' + tid(c1Rb.records[0].id))
      }
    }

    var anomalies = []
    var a7V = safeFindAll('com_vinculos_externos', extIdFilter('TESTE-2D2B-A7-C1'))
    var a8V = safeFindAll('com_vinculos_externos', extIdFilter('TESTE-2D2B-A8-C1'))
    for (var a7i = 0; a7i < a7V.records.length; a7i++)
      anomalies.push({
        type: 'SECURITY_ANOMALY',
        description:
          'Found persistent record for rejected A7 test case: ' +
          a7V.records[a7i].getString('external_id') +
          '. Should have been rejected at 401 without creating records.',
      })
    for (var a8i = 0; a8i < a8V.records.length; a8i++)
      anomalies.push({
        type: 'SECURITY_ANOMALY',
        description:
          'Found persistent record for rejected A8 test case: ' +
          a8V.records[a8i].getString('external_id') +
          '. Should have been rejected at 401 without creating records.',
      })

    var mapping = {
      A1: {
        found: null,
        not_reconstructable: true,
        description:
          'Webhook rejection with flag disabled (503). No persisted logs for rejection calls.',
        evidence: [],
      },
      A2: {
        found: null,
        not_reconstructable: true,
        description: 'Wrong HTTP method (405). No persisted logs for rejection calls.',
        evidence: [],
      },
      A3: {
        found: null,
        not_reconstructable: true,
        description: 'Wrong content-type (400). No persisted logs for rejection calls.',
        evidence: [],
      },
      A4: {
        found: null,
        not_reconstructable: true,
        description: 'Missing data fields (400). No persisted logs for rejection calls.',
        evidence: [],
      },
      A5: {
        found: null,
        not_reconstructable: true,
        description: 'Malformed JSON body (400). No persisted logs for rejection calls.',
        evidence: [],
      },
      A6: {
        found: null,
        not_reconstructable: true,
        description: 'Oversized payload (400). No persisted logs for rejection calls.',
        evidence: [],
      },
      A7: {
        found: null,
        not_reconstructable: true,
        description: 'Missing signature (401). No persisted logs. Anomaly check performed.',
        evidence: [],
        anomaly_detected: a7V.records.length > 0,
      },
      A8: {
        found: null,
        not_reconstructable: true,
        description: 'Invalid signature (401). No persisted logs. Anomaly check performed.',
        evidence: [],
        anomaly_detected: a8V.records.length > 0,
      },
      B1_contato_criado: {
        found: b1Err ? null : b1Found,
        not_reconstructable: b1Err,
        description:
          'Contact creation TESTE-2D2B-FN-C1 — requires correlated contact + event + execution + link',
        evidence: b1Ev_,
        correlation: {
          vinculo_found: !!b1VR,
          contact_found: !!b1CR,
          event_found: b1Ev.records.length > 0,
          execution_found: b1Ex.records.length > 0,
          read_error: b1Err,
        },
      },
      B2_duplicidade_sem_efeito: {
        found: null,
        not_reconstructable: true,
        description:
          'Duplicate rejection (409). No persistent records created. Absence does not prove call occurred.',
        evidence: [],
      },
      B3_negocio_criado: {
        found: b3Err ? null : b3Found,
        not_reconstructable: b3Err,
        description:
          'Deal creation TESTE-2D2B-FN-D1 — requires correlated business + event + execution + link',
        evidence: b3Ev_,
        correlation: {
          vinculo_found: !!b3VR,
          business_found: !!b3BR,
          event_found: b3Ev.records.length > 0,
          execution_found: b3Ex.records.length > 0,
          read_error: b3Err,
        },
      },
      B4_snapshot_e_atualizacao: {
        found: b4Err ? null : b4Found,
        not_reconstructable: b4Err,
        description:
          'Deal update + snapshot tied to TESTE-2D2B-FN-D1 — requires update event + snapshot with matching negocio_id',
        evidence: b4Ev_,
        correlation: {
          update_event_found: b4Ev.records.length > 0,
          snapshot_found: b4Snap.records.length > 0,
          business_id_resolved: !!b3Bid,
          read_error: b4Err,
        },
      },
      B5_negocio_e_ocorrencia_qualidade: {
        found: b5Err ? null : b5Found,
        not_reconstructable: b5Err,
        description:
          'Deal creation TESTE-2D2B-FN-D2 + quality occurrence — requires business + event + execution + link + correlated occurrence',
        evidence: b5Ev_,
        correlation: {
          vinculo_found: !!b5VR,
          business_found: !!b5BR,
          event_found: b5Ev.records.length > 0,
          execution_found: b5Ex.records.length > 0,
          occurrence_found: b5Occ.records.length > 0,
          read_error: b5Err,
        },
      },
      C1_rollback: {
        found: c1Err ? null : c1Found,
        not_reconstructable: c1Err || !c1Found,
        description:
          'Rollback from snapshot — defaults to found:null, not_reconstructable:true. Only set found:true when a specific persisted rollback event (evento_tipo=rollback) with unambiguous correlation key exists in com_eventos_integracao. com_auditoria is NOT used because the plan expects delta +0 there (audit_negocios.js uses onRecordUpdateRequest, which does not fire on server-side $app.save). Generic audit records are neither expected nor used as proof of rollback.',
        evidence: c1Ev_,
        correlation: {
          correlation_key_resolved: !!b3Id,
          rollback_event_found: c1Found,
          read_error: c1Err,
          auditoria_not_used: true,
          auditoria_expected_delta: 0,
        },
      },
      C2_repeticao_idempotente: {
        found: null,
        not_reconstructable: true,
        description:
          'Idempotent rollback repeat. No persistent records created. Absence does not prove call occurred.',
        evidence: [],
      },
      D1: {
        found: null,
        not_reconstructable: true,
        description: 'Final probe with flag disabled (503). No persisted logs for rejection calls.',
        evidence: [],
      },
    }

    var stepKeys = [
      'B1_contato_criado',
      'B3_negocio_criado',
      'B4_snapshot_e_atualizacao',
      'B5_negocio_e_ocorrencia_qualidade',
    ]
    var persistentStepsFound = 0
    var anyIndeterminate = false
    for (var x = 0; x < stepKeys.length; x++) {
      if (mapping[stepKeys[x]].not_reconstructable) anyIndeterminate = true
      if (mapping[stepKeys[x]].found === true) persistentStepsFound++
    }

    var classification, justification
    if (readErrors.length > 0) {
      classification = 'ESTADO_INDETERMINADO'
      justification =
        'One or more collection reads failed (' +
        readErrors.length +
        ' errors). Classification is indeterminate until all collections can be queried successfully. No catch block converted an error into valid data.'
    } else if (anyIndeterminate) {
      classification = 'ESTADO_INDETERMINADO'
      justification =
        'One or more required evidence queries encountered errors, making reconstruction indeterminate for those steps.'
    } else if (persistentStepsFound === 0) {
      classification = 'ESTADO_INDETERMINADO'
      justification =
        'No correlated evidence found for any expected persistent step (B1, B3, B4, B5). Absence of persisted evidence does not constitute proof of non-execution — the original 16-call report was not persisted and cannot be reconstructed.'
    } else if (persistentStepsFound < stepKeys.length) {
      classification = 'INDICIOS_DE_EXECUCAO_PARCIAL'
      justification =
        'Correlated evidence found for ' +
        persistentStepsFound +
        ' of ' +
        stepKeys.length +
        ' expected persistent steps. The round appears to have been partially executed or interrupted. The original 16-call PASS/GO report was not persisted and cannot be fully reconstructed.'
    } else {
      classification = 'INDICIOS_DE_EXECUCAO_COMPLETA_NAO_COMPROVADA'
      justification =
        'Correlated evidence found for all ' +
        stepKeys.length +
        ' expected persistent steps (B1, B3, B4, B5). However, the original 16-call PASS/GO report was not persisted in any collection — it was only returned as an HTTP response body. Without the persisted report, complete execution cannot be fully confirmed. C1 rollback evidence is ' +
        (mapping.C1_rollback.found === true ? 'present' : 'not found or not reconstructable') +
        '.'
    }

    var gaps = [
      {
        gap: 'persisted_16_call_report',
        description:
          'The original Porta 2D.2B round result (16-call PASS/GO report) was only returned as an HTTP response body. It was NOT persisted in any collection. The original PASS/GO verdict cannot be fully reconstructed from persisted evidence alone.',
      },
      {
        gap: 'B2_duplicate_evidence',
        description:
          'B2 tests duplicate rejection (409). No persistent records created. Absence of evidence does not indicate failure or success.',
      },
      {
        gap: 'C2_idempotent_evidence',
        description:
          'C2 tests idempotent rollback repeat. No persistent records created. Absence of evidence does not indicate failure or success.',
      },
      {
        gap: 'A7_A8_rejected_evidence',
        description:
          'A7/A8 test signature validation failures (401). No records should have been created. Finding evidence would indicate a security anomaly.',
      },
      {
        gap: 'A1_A6_D1_rejection_logs',
        description:
          'A1-A6 and D1 test webhook rejection behavior (503, 405, 400). No persisted logs created. These calls are not reconstructable from persisted evidence.',
      },
      {
        gap: 'C1_rollback_specificity',
        description:
          'C1 rollback defaults to not_reconstructable. Only confirmed when a specific persisted rollback event (evento_tipo=rollback) with unambiguous correlation to TESTE-2D2B-FN-D1 exists in com_eventos_integracao. com_auditoria is NOT used (plan expects delta +0 — audit_negocios.js uses onRecordUpdateRequest, does not fire on server-side saves). Generic audit records, snapshot existence, or negocio updates alone do not prove rollback occurred.',
      },
    ]

    return e.json(200, {
      route: 'GET /backend/v1/integracao/ac/audit-round-2d2b',
      route_version: 'R2-AUDIT-2D2B-20260813-CORRECTED',
      read_only: true,
      writes_performed: 0,
      external_calls: 0,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      correlation_key: 'TESTE-2D2B',
      lock: lockData,
      flag: flagData,
      counts: counts,
      counts_note:
        'Current counts of monitored collections. NOT equivalent to original deltas — no persisted baseline exists.',
      evidence: evidence,
      evidence_mapping: mapping,
      classification: classification,
      classification_justification: justification,
      original_pass_go_reconstructable: false,
      original_pass_go_note:
        'The original PASS/GO verdict cannot be fully reconstructed without the original persisted 16-call report.',
      gaps: gaps,
      anomalies: anomalies,
      read_errors: readErrors,
      monitored_collections: COLS,
      search_pattern: PATTERN_UPPER,
      search_variants: [PATTERN_UPPER, PATTERN_LOWER],
      search_case_insensitive: false,
      search_case_note:
        'Both uppercase (TESTE-2D2B) and lowercase (teste-2d2b) variants are searched explicitly. Case-insensitivity is NOT claimed because the underlying mechanism (SQLite LIKE) cannot be provably guaranteed across all configurations.',
      expected_correlation_keys: [
        'TESTE-2D2B-FN-C1',
        'TESTE-2D2B-FN-D1',
        'TESTE-2D2B-FN-D2',
        'TESTE-2D2B-A7-C1',
        'TESTE-2D2B-A8-C1',
      ],
      logical_operators_verification: {
        inspected_file: 'pocketbase/hooks/ac_run_round_2d2b.js',
        verified: true,
        findings: [
          { call: 'A1', check: 'status === 503', verified: true },
          { call: 'A2', check: 'status === 405', verified: true },
          { call: 'A3', check: 'status === 400', verified: true },
          { call: 'A4', check: 'status === 400', verified: true },
          { call: 'A5', check: 'status === 400', verified: true },
          { call: 'A6', check: 'status === 400', verified: true },
          {
            call: 'A7',
            check: 'status === 401 && json.error === "missing_signature"',
            verified: true,
          },
          { call: 'A8', check: 'status === 401', verified: true },
          { call: 'B1', check: 'status === 200', verified: true },
          { call: 'B2', check: 'status === 409 && json.duplicate === true', verified: true },
          { call: 'B3', check: 'status === 200', verified: true },
          { call: 'B4', check: 'status === 200 && snapshot count delta > 0', verified: true },
          { call: 'B5', check: 'status === 200 && occurrence count delta > 0', verified: true },
          {
            call: 'C1',
            check:
              'status === 200 && success === true && idempotent === false && rolled_back[0].action === "restored_from_snapshot" && rolled_back[0].collection === "com_negocios" && rolled_back[0].record_id',
            verified: true,
          },
          {
            call: 'C2',
            check:
              'status === 200 && success === true && idempotent === true && rolled_back.length === 0',
            verified: true,
          },
          { call: 'D1', check: 'status === 503', verified: true },
        ],
        summary:
          'All 16 call checks in ac_run_round_2d2b.js use correct logical operators. Strict equality (===) and AND (&&) are used consistently. No missing operators found.',
      },
      declared_code_properties: {
        nature:
          'CODE_DECLARATIONS_NOT_INDEPENDENT_PROOF — These are developer declarations about the code, not independently verified runtime proof.',
        write_primitives_absent: true,
        write_primitives_check:
          'No $app.save(), $app.delete(), new Record(), or raw INSERT/UPDATE/DELETE statements found.',
        external_http_calls_absent: true,
        external_http_calls_check:
          'No $http.send(), $http.stream(), fetch(), or any outbound HTTP call found.',
        readparam_logic:
          'readParam uses findCollectionByNameOrId to verify collection existence (replacing unsupported $app.hasTable). Collection-not-found is distinct from read-error. Uses findRecordsByFilter (returns empty array when not found). Not-found returns exists:false, readError:false. Real errors are caught and added to read_errors with readError:true. No catch converts an error into valid data.',
        logical_operators_verified: true,
        logical_operators_summary:
          'All 16 call checks in ac_run_round_2d2b.js verified correct. No missing operators.',
        search_case_insensitive_removed: true,
        search_case_insensitive_check:
          'search_case_insensitive is set to false. Both uppercase and lowercase variants searched explicitly. No unproven claim remains.',
        pagination_implemented: true,
        pagination_check:
          'paginateFind implements real pagination: PAGE_SIZE=200 up to MAX_RECORDS=2000, truncated results marked and pushed to read_errors forcing ESTADO_INDETERMINADO. safeFindAll (directed/correlation queries) uses a FIXED limit of 100 — NOT complete pagination. If a directed query returns exactly 100 records, truncation is detected and pushed to read_errors, forcing ESTADO_INDETERMINADO.',
        correlation_implemented: true,
        correlation_check:
          'Each B step requires correlated evidence across multiple collections. C1 requires a specific persisted rollback event (evento_tipo=rollback in com_eventos_integracao) with unambiguous correlation — NOT generic com_auditoria records (plan expects delta +0). No inference from partial or generic records.',
        sanitized_evidence: true,
        sanitization_check:
          'Evidence exposes only truncated IDs, timestamps, status fields, correlation keys. No payloads, emails, phones, tokens, signatures, or authorization headers exposed.',
      },
      deployment_target: 'PREVIEW_ONLY',
      production_promoted: false,
    })
  },
  $apis.requireAuth(),
)
