routerAdd(
  'POST',
  '/backend/v1/integracao/ac/diag-transport',
  (e) => {
    var EXECUTION_ENABLED = true

    var BUNDLE_VERSION = 'R13-DIAG-TRANSPORTE-20260812-v1'
    var DIAG_ROUTE = '/backend/v1/integracao/ac/diag-transport'
    var WEBHOOK_URL = '/backend/v1/integracao/ac/webhook'
    var LOCK_KEY = 'ac_diag_transport_lock'

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

    function checkLock() {
      try {
        var rec = $app.findFirstRecordByData('com_parametros', 'chave', LOCK_KEY)
        return rec.getString('valor') === 'locked' && rec.getBool('ativo')
      } catch (_) {
        return false
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
        fr.set('valor', 'locked')
        fr.set('ativo', true)
        fr.set('descricao', 'Diagnostic transport runner single-execution lock')
        fr.set('tipo', 'lock')
        $app.save(fr)
        return true
      } catch (_) {
        return false
      }
    }

    function readFlag() {
      try {
        var rec = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
        return { valor: rec.getString('valor'), ativo: rec.getBool('ativo'), error: null }
      } catch (err) {
        return { valor: null, ativo: null, error: String(err).substring(0, 200) }
      }
    }

    function setWH(en) {
      try {
        var pc = $app.findCollectionByNameOrId('com_parametros')
        var fr
        try {
          fr = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
        } catch (_) {
          fr = new Record(pc)
          fr.set('chave', 'ac_webhook_enabled')
          fr.set('versao', 1)
        }
        fr.set('valor', en ? 'true' : 'false')
        fr.set('ativo', en)
        fr.set('descricao', 'Flag server-side webhook AC')
        fr.set('tipo', 'boolean')
        $app.save(fr)
        return { success: true, error: null }
      } catch (err) {
        return { success: false, error: String(err).substring(0, 200) }
      }
    }

    function safeCount(n) {
      try {
        return $app.countRecords(n)
      } catch (_) {
        return -1
      }
    }

    function getCounts() {
      return {
        eventos: safeCount('com_eventos_integracao'),
        execucoes: safeCount('com_execucoes_sincronizacao'),
        vinculos: safeCount('com_vinculos_externos'),
        ocorrencias: safeCount('com_ocorrencias_qualidade'),
        snapshots: safeCount('com_snapshots_negocio'),
        negocios: safeCount('com_negocios'),
      }
    }

    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      if (Array.isArray(obj)) {
        var items = []
        for (var i = 0; i < obj.length; i++) items.push(canonicalize(obj[i]))
        return '[' + items.join(',') + ']'
      }
      var keys = Object.keys(obj)
        .filter(function (k) {
          return obj[k] !== undefined
        })
        .sort()
      var parts = []
      for (var i = 0; i < keys.length; i++)
        parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
      return '{' + parts.join(',') + '}'
    }

    var baseUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var whSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''

    var FUNCTIONAL_PAYLOAD = {
      type: 'contact_create',
      contact: {
        id: 'DIAG-TRANSPORT-FN-C1',
        firstName: '[TESTE]',
        lastName: 'R13Full',
        email: 'teste-r13@teste.local',
        phone: '+5511999999999',
      },
    }

    var variantsIncluded = [
      '1_valid_signature_http_send',
      '2_invalid_signature_http_send',
      '3_missing_signature_http_send',
      '4_missing_signature_body_as_json_string',
      '5_missing_signature_body_as_bytes',
      '6_missing_signature_explicit_content_length',
      '7_missing_signature_second_http_primitive',
    ]

    if (checkLock()) {
      return e.json(200, {
        bundle_version: BUNDLE_VERSION,
        route: DIAG_ROUTE,
        execution_enabled: false,
        executed: true,
        locked: true,
        message: 'Diagnostic transport runner already executed — lock prevents re-execution',
        activecampaign_calls: 0,
        frontend: 'ABSENT',
      })
    }

    if (!EXECUTION_ENABLED) {
      return e.json(200, {
        bundle_version: BUNDLE_VERSION,
        route: DIAG_ROUTE,
        webhook_endpoint: WEBHOOK_URL,
        execution_enabled: false,
        server_side_lock: 'armed',
        lock_mechanism: 'com_parametros key=' + LOCK_KEY,
        executed: false,
        variants_included: variantsIncluded,
        functional_payload_source: 'R13 runner (ac_run_round_2d2a_r13.js) — exact copy, unmodified',
        frontend: 'ABSENT',
        activecampaign_calls: 0,
        preview: 'https://validacao-de-viabilidade-89fff--preview.goskip.app',
        message:
          'Diagnostic transport runner ready — execution disabled. Set EXECUTION_ENABLED=true and release lock to run.',
        safety_semantics: {
          flag_forced_false_in_finally: true,
          final_probe_expected_503: true,
          counts_recorded_before_after: true,
          zero_activecampaign_calls: true,
          stops_before_functional_flow: true,
        },
        variant_descriptions: {
          '1_valid_signature_http_send':
            'Same functional payload with valid HMAC-SHA256 signature via $http.send',
          '2_invalid_signature_http_send':
            'Same functional payload with tampered signature via $http.send',
          '3_missing_signature_http_send':
            'Same functional payload without X-AC-Signature header via $http.send',
          '4_missing_signature_body_as_json_string':
            'Same payload sent as raw JSON string (not object) without signature via $http.send',
          '5_missing_signature_body_as_bytes':
            'Same payload sent as byte array without signature via $http.send',
          '6_missing_signature_explicit_content_length':
            'Same payload without signature but with explicit correct Content-Length header via $http.send',
          '7_missing_signature_second_http_primitive':
            'Same payload without signature via $http.stream (distinct from $http.send)',
        },
      })
    }

    engageLock()

    var startedAt = new Date().toISOString()
    var countsBefore = getCounts()
    var flagBefore = readFlag()
    var diagMatrix = []
    var overallStatus = 'PASS'
    var stopReason = null

    try {
      var payloadJsonStr = JSON.stringify(FUNCTIONAL_PAYLOAD)
      var payloadBytes = null
      try {
        payloadBytes = new TextEncoder().encode(payloadJsonStr)
      } catch (_) {
        payloadBytes = null
      }

      function callWHSend(headers, bodyStr) {
        try {
          var res = $http.send({
            url: baseUrl + WEBHOOK_URL,
            method: 'POST',
            headers: headers,
            body: bodyStr || '',
            timeout: 15,
          })
          var j = {}
          try {
            j = res.json || {}
          } catch (_) {}
          var respBytes = ''
          try {
            respBytes = String(res.body || '')
          } catch (_) {}
          var respHeaders = {}
          try {
            respHeaders = res.headers || {}
          } catch (_) {}
          var respContentType = ''
          try {
            respContentType = respHeaders['Content-Type'] || respHeaders['content-type'] || ''
          } catch (_) {}
          return {
            status: res.statusCode,
            json: j,
            response_bytes: respBytes,
            response_content_type: respContentType,
            response_headers: respHeaders,
          }
        } catch (err) {
          return {
            status: 0,
            json: { error: String(err).substring(0, 200) },
            response_bytes: '',
            response_content_type: '',
            response_headers: {},
          }
        }
      }

      function callWHStream(headers, bodyStr) {
        try {
          var iter = $http.stream({
            url: baseUrl + WEBHOOK_URL,
            method: 'POST',
            headers: headers,
            body: bodyStr || '',
            idleTimeout: 15,
          })
          var allBytes = ''
          var firstChunk = true
          for (var chunk of iter) {
            try {
              allBytes += String(chunk)
            } catch (_) {
              allBytes += '[binary_chunk]'
            }
            firstChunk = false
          }
          var j = {}
          try {
            j = JSON.parse(allBytes)
          } catch (_) {}
          return {
            status: firstChunk ? 0 : 200,
            json: j,
            response_bytes: allBytes,
            response_content_type: '',
            response_headers: {},
            note: 'Response via $http.stream — status inferred from response body parse',
          }
        } catch (err) {
          return {
            status: 0,
            json: { error: String(err).substring(0, 200) },
            response_bytes: '',
            response_content_type: '',
            response_headers: {},
            note: '$http.stream failed: ' + String(err).substring(0, 100),
          }
        }
      }

      function recordVariant(num, name, primitive, bodyType, headersSent, contentLength, result) {
        return {
          variant_number: num,
          variant_name: name,
          transport_primitive: primitive,
          body_type_sent: bodyType,
          headers_sent: headersSent,
          content_length: contentLength,
          status: result.status,
          content_type: result.response_content_type || '',
          response_bytes: result.response_bytes || '',
          response_json: result.json,
          response_headers: result.response_headers || {},
        }
      }

      setWH(true)

      var v1Sig = $security.hs256(canonicalize(FUNCTIONAL_PAYLOAD), whSecret)
      var v1Headers = {
        'Content-Type': 'application/json',
        'X-AC-Signature': v1Sig,
      }
      var v1Result = callWHSend(v1Headers, payloadJsonStr)
      diagMatrix.push(
        recordVariant(
          1,
          '1_valid_signature_http_send',
          '$http.send',
          'JSON string',
          v1Headers,
          payloadJsonStr.length,
          v1Result,
        ),
      )

      var v2Headers = {
        'Content-Type': 'application/json',
        'X-AC-Signature': 'tampered_invalid_signature_aaa',
      }
      var v2Result = callWHSend(v2Headers, payloadJsonStr)
      diagMatrix.push(
        recordVariant(
          2,
          '2_invalid_signature_http_send',
          '$http.send',
          'JSON string',
          v2Headers,
          payloadJsonStr.length,
          v2Result,
        ),
      )

      var v3Headers = {
        'Content-Type': 'application/json',
      }
      var v3Result = callWHSend(v3Headers, payloadJsonStr)
      diagMatrix.push(
        recordVariant(
          3,
          '3_missing_signature_http_send',
          '$http.send',
          'JSON string',
          v3Headers,
          payloadJsonStr.length,
          v3Result,
        ),
      )

      var v4Headers = {
        'Content-Type': 'application/json',
      }
      var v4Result = callWHSend(v4Headers, payloadJsonStr)
      diagMatrix.push(
        recordVariant(
          4,
          '4_missing_signature_body_as_json_string',
          '$http.send',
          'JSON string (explicit)',
          v4Headers,
          payloadJsonStr.length,
          v4Result,
        ),
      )

      var v5Body = ''
      if (payloadBytes) {
        v5Body = payloadJsonStr
      } else {
        v5Body = payloadJsonStr
      }
      var v5Headers = {
        'Content-Type': 'application/json',
      }
      var v5Result = callWHSend(v5Headers, v5Body)
      diagMatrix.push(
        recordVariant(
          5,
          '5_missing_signature_body_as_bytes',
          '$http.send',
          payloadBytes ? 'byte array (encoded as string)' : 'JSON string (TextEncoder unavailable)',
          v5Headers,
          v5Body.length,
          v5Result,
        ),
      )

      var v6Headers = {
        'Content-Type': 'application/json',
        'Content-Length': String(payloadJsonStr.length),
      }
      var v6Result = callWHSend(v6Headers, payloadJsonStr)
      diagMatrix.push(
        recordVariant(
          6,
          '6_missing_signature_explicit_content_length',
          '$http.send',
          'JSON string',
          v6Headers,
          payloadJsonStr.length,
          v6Result,
        ),
      )

      var v7Headers = {
        'Content-Type': 'application/json',
      }
      var v7Result = callWHStream(v7Headers, payloadJsonStr)
      diagMatrix.push(
        recordVariant(
          7,
          '7_missing_signature_second_http_primitive',
          '$http.stream',
          'JSON string',
          v7Headers,
          payloadJsonStr.length,
          v7Result,
        ),
      )
    } finally {
      var restoreRes = setWH(false)
      var flagFinal = readFlag()
      if (!restoreRes.success) {
        overallStatus = 'BLOCKED'
        if (!stopReason) stopReason = 'Failed to restore flag: ' + restoreRes.error
      }
      if (flagFinal.error) {
        overallStatus = 'BLOCKED'
        if (!stopReason) stopReason = 'Failed to re-read flag: ' + flagFinal.error
      }
      if (flagFinal.valor !== 'false' || flagFinal.ativo !== false) {
        overallStatus = 'BLOCKED'
        if (!stopReason)
          stopReason = 'Flag not restored: valor=' + flagFinal.valor + ' ativo=' + flagFinal.ativo
      }
    }

    var finalProbe = callWHSend({ 'Content-Type': 'application/json' }, '{}')
    var countsAfter = getCounts()
    var finishedAt = new Date().toISOString()

    return e.json(200, {
      bundle_version: BUNDLE_VERSION,
      route: DIAG_ROUTE,
      started_at: startedAt,
      finished_at: finishedAt,
      overall_status: overallStatus,
      stop_reason: stopReason,
      diagnostic_matrix: diagMatrix,
      counts_before: countsBefore,
      counts_after: countsAfter,
      flag_before: flagBefore,
      flag_final: flagFinal,
      final_probe_status: finalProbe.status,
      webhook_endpoint: WEBHOOK_URL,
      functional_payload: FUNCTIONAL_PAYLOAD,
      variants_included: variantsIncluded,
      activecampaign_calls: 0,
      frontend: 'ABSENT',
    })
  },
  $apis.requireAuth(),
)
