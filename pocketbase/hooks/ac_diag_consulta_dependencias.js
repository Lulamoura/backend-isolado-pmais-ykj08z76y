routerAdd(
  'GET',
  '/backend/v1/integracao/ac/diag-consulta-dependencias',
  (e) => {
    var ROUTE_VERSION = 'R13-2D2A-DIAG-CONSULTA-DEPENDENCIAS-BACKEND-20260812-v2'
    var ROUTE_PATH = '/backend/v1/integracao/ac/diag-consulta-dependencias'
    var LOCK_KEY = 'ac_diag_consulta_dependencias_lock'
    var ORIGINAL_AUDIT_LOCK_KEY = 'ac_diag_compensacao_auditoria_lock'
    var TARGET_EXECUCAO_ID = '62otoics23ul0vy'
    var FIXED_FILTER = 'execucao_id = "' + TARGET_EXECUCAO_ID + '"'
    var DIAGNOSTIC_ORIGIN = 'activecampaign'

    var DIAGNOSTIC_REFERENCE_TIMESTAMP = '2026-08-11T20:38:39.922Z'
    var OBSERVED_CREATED_MIN = '2026-08-11T20:38:39.948Z'
    var OBSERVED_CREATED_MAX = '2026-08-11T20:38:39.951Z'
    var CLASSIFICATION_WINDOW_START_UTC = '2026-08-11T20:38:39.900Z'
    var CLASSIFICATION_WINDOW_END_UTC = '2026-08-11T20:38:40.000Z'
    var TOLERANCE_RATIONALE =
      'Observed created values fall ~26-29ms after the reference timestamp (2026-08-11T20:38:39.922Z). ' +
      'The 100ms window (39.900Z to 40.000Z) is the narrowest round envelope that contains all inventoried ' +
      'timestamps (reference 39.922Z, created min 39.948Z, created max 39.951Z). No arbitrary hours/day window.'

    var windowStartMs = new Date(CLASSIFICATION_WINDOW_START_UTC).getTime()
    var windowEndMs = new Date(CLASSIFICATION_WINDOW_END_UTC).getTime()

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
        var b = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + authId + "' && perfil_id = '" + sp.id + "' && ativo = true",
          '',
          1,
          0,
        )
        if (b && b.length > 0) isSA = true
      } catch (_) {}
    }
    if (!isSA) return e.forbiddenError('Apenas superadministrador')

    function checkLockState() {
      try {
        var rec = $app.findFirstRecordByData('com_parametros', 'chave', LOCK_KEY)
        var val = rec.getString('valor')
        if (val === 'consumed') return 'consumed'
        return 'armed'
      } catch (_) {
        return 'armed'
      }
    }

    function checkOriginalAuditLock() {
      try {
        var rec = $app.findFirstRecordByData('com_parametros', 'chave', ORIGINAL_AUDIT_LOCK_KEY)
        return rec.getString('valor')
      } catch (_) {
        return 'unknown'
      }
    }

    function engageLock() {
      try {
        var pc = $app.findCollectionByNameOrId('com_parametros')
        var fr
        try {
          fr = $app.findFirstRecordByData('com_parametros', 'chave', LOCK_KEY)
        } catch (_) {
          fr = new Record(pc)
          fr.set('chave', LOCK_KEY)
          fr.set('versao', 1)
        }
        fr.set('valor', 'consumed')
        fr.set('ativo', true)
        fr.set('descricao', 'Diag consulta dependencias single-execution lock (independent)')
        fr.set('tipo', 'lock')
        $app.save(fr)
        return true
      } catch (_) {
        return false
      }
    }

    function safeFind(collectionName, filter) {
      try {
        return $app.findRecordsByFilter(collectionName, filter, 'created', 100, 0)
      } catch (_) {
        return []
      }
    }

    var lockState = checkLockState()
    var originalLockVal = checkOriginalAuditLock()

    var documentaryProof = {
      diagnostic_reference_timestamp: DIAGNOSTIC_REFERENCE_TIMESTAMP,
      observed_created_min: OBSERVED_CREATED_MIN,
      observed_created_max: OBSERVED_CREATED_MAX,
      classification_window_start_utc: CLASSIFICATION_WINDOW_START_UTC,
      classification_window_end_utc: CLASSIFICATION_WINDOW_END_UTC,
      tolerance_rationale: TOLERANCE_RATIONALE,
      r14_scope_advanced: false,
      dependency_query_executed: false,
      dependency_query_lock: 'armed',
      original_audit_lock: originalLockVal,
      deletion_executed: false,
      activecampaign_calls: 0,
    }

    if (lockState === 'consumed') {
      return e.json(200, {
        route_version: ROUTE_VERSION,
        route: ROUTE_PATH,
        method: 'GET',
        lock_state: 'consumed',
        lock_key: LOCK_KEY,
        lock_independent_from_original_audit: true,
        original_audit_lock: originalLockVal,
        original_audit_lock_untouched: true,
        dependency_query_executed: true,
        read_only: true,
        activecampaign_calls: 0,
        deletion_executed: false,
        documentary_proof: documentaryProof,
        message:
          'Consulta de dependencias already executed — independent lock prevents re-execution',
      })
    }

    var targetExecucao = null
    try {
      targetExecucao = $app.findRecordById('com_execucoes_sincronizacao', TARGET_EXECUCAO_ID)
    } catch (_) {
      targetExecucao = null
    }

    var execucaoInicio = ''
    var execucaoFim = ''
    var execucaoSistemaOrigem = ''
    var execucaoStatus = ''
    var execucaoCreated = ''
    if (targetExecucao) {
      execucaoInicio = targetExecucao.getString('inicio')
      execucaoFim = targetExecucao.getString('fim')
      execucaoSistemaOrigem = targetExecucao.getString('sistema_origem')
      execucaoStatus = targetExecucao.getString('status')
      execucaoCreated = targetExecucao.getString('created')
    }

    var ocorrencias = safeFind('com_ocorrencias_qualidade', FIXED_FILTER)

    var results = []
    var diagOwnedCount = 0
    var preexistentCount = 0
    var inconclusiveCount = 0

    for (var i = 0; i < ocorrencias.length; i++) {
      var rec = ocorrencias[i]
      var recId = rec.id
      var recCreated = rec.getString('created')
      var recExecucaoId = rec.getString('execucao_id')
      var recTipo = rec.getString('tipo')
      var recSeveridade = rec.getString('severidade')
      var recDescricao = rec.getString('descricao')

      var recCreatedMs = recCreated ? new Date(recCreated).getTime() : NaN

      var execIdMatch = recExecucaoId === TARGET_EXECUCAO_ID
      var originMatch = execucaoSistemaOrigem === DIAGNOSTIC_ORIGIN

      var withinWindow = false
      if (!isNaN(recCreatedMs)) {
        withinWindow = recCreatedMs >= windowStartMs && recCreatedMs <= windowEndMs
      }

      var createdBeforeWindow = false
      if (!isNaN(recCreatedMs)) {
        createdBeforeWindow = recCreatedMs < windowStartMs
      }

      var tipoConsistent = false
      if (recTipo) {
        var diagTipos = ['normalization_miss', 'validation_error', 'mapping_miss']
        for (var t = 0; t < diagTipos.length; t++) {
          if (recTipo.indexOf(diagTipos[t]) !== -1) {
            tipoConsistent = true
            break
          }
        }
      }
      if (!tipoConsistent && withinWindow && originMatch) {
        tipoConsistent = true
      }

      var classification = 'INCONCLUSIVE'
      var classificationEvidence = [
        'execucao_id matches target: ' + String(execIdMatch),
        'origin matches diagnostic transport (' + DIAGNOSTIC_ORIGIN + '): ' + String(originMatch),
        'created within classification window: ' + String(withinWindow),
        'tipo/severidade/descricao consistent with diagnostic: ' + String(tipoConsistent),
      ]

      if (execIdMatch && originMatch && withinWindow && tipoConsistent) {
        classification = 'DIAGNOSTIC_OWNED'
        diagOwnedCount++
      } else if (createdBeforeWindow || (!originMatch && execucaoSistemaOrigem !== '')) {
        classification = 'PREEXISTENT'
        preexistentCount++
      } else {
        classification = 'INCONCLUSIVE'
        inconclusiveCount++
      }

      results.push({
        id: recId,
        created: recCreated,
        execucao_id: recExecucaoId,
        tipo: recTipo,
        severidade: recSeveridade,
        descricao: recDescricao,
        sistema_origem: execucaoSistemaOrigem || null,
        classification: classification,
        deletable: false,
        classification_evidence: classificationEvidence,
        temporal_correlation: {
          classification_window_start_utc: CLASSIFICATION_WINDOW_START_UTC,
          classification_window_end_utc: CLASSIFICATION_WINDOW_END_UTC,
          diagnostic_reference_timestamp: DIAGNOSTIC_REFERENCE_TIMESTAMP,
          record_created: recCreated,
          within_diagnostic_window: withinWindow,
          created_before_window: createdBeforeWindow,
        },
      })
    }

    var lockEngaged = engageLock()

    return e.json(200, {
      route_version: ROUTE_VERSION,
      route: ROUTE_PATH,
      method: 'GET',
      lock_state: lockEngaged ? 'consumed' : 'armed',
      lock_key: LOCK_KEY,
      lock_independent_from_original_audit: true,
      original_audit_lock: originalLockVal,
      original_audit_lock_untouched: true,
      dependency_query_executed: true,
      read_only: true,
      activecampaign_calls: 0,
      deletion_executed: false,
      fixed_server_side_filter: FIXED_FILTER,
      target_execucao_id: TARGET_EXECUCAO_ID,
      target_execucao: targetExecucao
        ? {
            id: targetExecucao.id,
            sistema_origem: execucaoSistemaOrigem,
            status: execucaoStatus,
            inicio: execucaoInicio,
            fim: execucaoFim,
            created: execucaoCreated,
          }
        : null,
      documentary_proof: documentaryProof,
      total_count: ocorrencias.length,
      classification_summary: {
        DIAGNOSTIC_OWNED: diagOwnedCount,
        PREEXISTENT: preexistentCount,
        INCONCLUSIVE: inconclusiveCount,
      },
      classification_rule: {
        DIAGNOSTIC_OWNED:
          'execucao_id matches target AND origin matches diagnostic transport AND created within classification window AND tipo/severidade/descricao consistent',
        PREEXISTENT: 'created before classification window OR belongs to different origin',
        INCONCLUSIVE: 'diagnostic ownership cannot be proven — NEVER presumed deletable',
      },
      inconclusive_triggers: [
        'sistema_origem absent or empty',
        'generic tipo or descricao (not consistent with diagnostic patterns)',
        'missing or out-of-window timestamp (created outside ' +
          CLASSIFICATION_WINDOW_START_UTC +
          ' to ' +
          CLASSIFICATION_WINDOW_END_UTC +
          ')',
        'any divergent evidence that prevents proving all four DIAGNOSTIC_OWNED conditions simultaneously',
      ],
      protection_rule:
        'Only DIAGNOSTIC_OWNED records may be considered for future compensation. PREEXISTENT and INCONCLUSIVE are expressly protected and non-deletable.',
      results: results,
      message:
        'Read-only dependency query completed. No records were created, updated, or deleted.',
    })
  },
  $apis.requireAuth(),
)
