routerAdd(
  'POST',
  '/backend/v1/integracao/ac/run-round-2d2a-r13',
  (e) => {
    var EXECUTION_ENABLED = true

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

    var reqBody = e.requestInfo().body || {}
    var mode = reqBody.mode || 'security-only'
    if (mode !== 'security-only' && mode !== 'full') mode = 'security-only'

    var startedAt = new Date().toISOString()
    var ts = startedAt.replace(/[:.]/g, '-')
    var nonce = $security.randomString(8)
    var correlationKey = 'TESTE-2D2A-R13-' + ts + '-' + nonce
    var baseUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var whSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    var authHdr = e.request.header.get('Authorization') || ''
    var sanitizedUrl = '/backend/v1/integracao/ac/webhook'

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
        var reRead = readFlag()
        if (reRead.error)
          return { success: false, error: 'Re-read failed: ' + reRead.error, reRead: reRead }
        if (reRead.valor !== (en ? 'true' : 'false') || reRead.ativo !== en)
          return {
            success: false,
            error:
              'Flag mismatch after write: expected valor=' +
              (en ? 'true' : 'false') +
              ' ativo=' +
              en +
              ' but got valor=' +
              reRead.valor +
              ' ativo=' +
              reRead.ativo,
            reRead: reRead,
          }
        return { success: true, error: null, reRead: reRead }
      } catch (err) {
        return { success: false, error: String(err).substring(0, 200), reRead: null }
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

    function sign(payload) {
      return {
        headers: {
          'Content-Type': 'application/json',
          'X-AC-Signature': $security.hs256(canonicalize(payload), whSecret),
        },
        body: JSON.stringify(payload),
      }
    }

    function callWH(method, headers, body) {
      try {
        var res = $http.send({
          url: baseUrl + '/backend/v1/integracao/ac/webhook',
          method: method,
          headers: headers,
          body: body || '',
          timeout: 15,
        })
        var j = {}
        try {
          j = res.json || {}
        } catch (_) {}
        return {
          status: res.statusCode,
          json: j,
          rawBody: String(res.body || '').substring(0, 500),
        }
      } catch (err) {
        return { status: 0, json: { error: String(err).substring(0, 100) }, rawBody: '' }
      }
    }

    function callRB(extId, extType) {
      try {
        var res = $http.send({
          url: baseUrl + '/backend/v1/integracao/ac/rollback',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHdr },
          body: JSON.stringify({ external_id: extId, entity_type: extType }),
          timeout: 15,
        })
        var j = {}
        try {
          j = res.json || {}
        } catch (_) {}
        return { status: res.statusCode, json: j }
      } catch (err) {
        return { status: 0, json: { error: String(err).substring(0, 100) } }
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

    function findVinculo(extType, extId) {
      try {
        return $app.findFirstRecordByFilter(
          'com_vinculos_externos',
          "sistema_origem = 'activecampaign' && external_type = '" +
            extType +
            "' && external_id = '" +
            extId +
            "'",
        )
      } catch (_) {
        return null
      }
    }

    function findEvento(extId) {
      try {
        return $app.findFirstRecordByFilter(
          'com_eventos_integracao',
          "sistema_origem = 'activecampaign' && external_id = '" + extId + "'",
        )
      } catch (_) {
        return null
      }
    }

    function redactHeaders(hdrs) {
      var rh = {}
      for (var k in hdrs) {
        if (k.toLowerCase() === 'x-ac-signature') rh[k] = '[REDACTED]'
        else if (k.toLowerCase() === 'authorization') rh[k] = '[REDACTED]'
        else rh[k] = hdrs[k]
      }
      return rh
    }

    function buildTest(
      num,
      name,
      corr,
      fb,
      fa,
      method,
      url,
      hdrs,
      bodyStr,
      expected,
      actual,
      resp,
      rawResp,
      cb,
      ca,
      passed,
      st,
      et,
    ) {
      return {
        test_number: num,
        test_name: name,
        correlation_key: corr,
        flag_before: fb,
        flag_after: fa,
        method: method,
        url: url,
        headers_sent: redactHeaders(hdrs),
        body_size_bytes: bodyStr ? bodyStr.length : 0,
        body_sanitized: bodyStr ? bodyStr.substring(0, 500) : '',
        expected_status: expected,
        actual_status: actual,
        response_sanitized: JSON.stringify(resp).substring(0, 500),
        raw_response: rawResp ? rawResp.substring(0, 500) : '',
        counts_before: cb,
        counts_after: ca,
        passed: passed,
        started_at: st,
        ended_at: et,
      }
    }

    function checkLock() {
      try {
        var rec = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_r13_execution_lock')
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
          fr = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_r13_execution_lock')
        } catch (_) {
          fr = new Record(pc)
          fr.set('chave', 'ac_r13_execution_lock')
          fr.set('versao', 1)
        }
        fr.set('valor', 'locked')
        fr.set('ativo', true)
        fr.set('descricao', 'Server-side single-execution lock for R13 runner')
        fr.set('tipo', 'lock')
        $app.save(fr)
        return true
      } catch (_) {
        return false
      }
    }

    var testsIncluded = [
      '1_disabled_returns_503',
      '2_wrong_method_get',
      '3_invalid_content_type',
      '4_empty_body',
      '5_malformed_body',
      '6_oversized_body',
      '7_missing_signature',
      '8_invalid_signature',
    ]

    if (checkLock()) {
      return e.json(200, {
        runner_version: 'R13',
        route: '/backend/v1/integracao/ac/run-round-2d2a-r13',
        execution_enabled: false,
        executed: true,
        locked: true,
        message: 'R13 already executed — server-side single-execution lock prevents re-execution',
        activecampaign_calls: 0,
      })
    }

    engageLock()

    if (!EXECUTION_ENABLED) {
      return e.json(200, {
        runner_version: 'R13',
        route: '/backend/v1/integracao/ac/run-round-2d2a-r13',
        execution_enabled: false,
        server_side_lock: 'armed',
        executed: false,
        tests_included: testsIncluded,
        activecampaign_calls: 0,
        message:
          'R13 runner ready — execution disabled. Set EXECUTION_ENABLED=true and release lock to run.',
      })
    }

    var overallStatus = 'PASS'
    var stopReason = null
    var securityMatrix = []
    var functionalFlow = 'not_started'
    var idempotencyReplay = 'not_started'
    var rollbackResult = 'not_started'
    var evidenceIds = []
    var flagBefore = readFlag()
    var flagDuring = null
    var flagFinal = null
    var finalProbeStatus = null
    var countsBefore = getCounts()
    var countsAfter = null
    var test7Compensation = null
    var test7CriticalFail = false

    try {
      var disRes = setWH(false)
      if (!disRes.success) {
        overallStatus = 'BLOCKED'
        stopReason = 'Failed to disable flag: ' + disRes.error
      }

      if (overallStatus === 'PASS') {
        var t1s = new Date().toISOString(),
          fb1 = readFlag(),
          cb1 = getCounts()
        var r1 = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
        var ca1 = getCounts(),
          fa1 = readFlag(),
          t1e = new Date().toISOString()
        var t1pass = r1.status === 503
        securityMatrix.push(
          buildTest(
            1,
            '1_disabled_returns_503',
            correlationKey,
            fb1,
            fa1,
            'POST',
            sanitizedUrl,
            { 'Content-Type': 'application/json' },
            '{}',
            503,
            r1.status,
            r1.json,
            r1.rawBody,
            cb1,
            ca1,
            t1pass,
            t1s,
            t1e,
          ),
        )
        if (!t1pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 1 FAIL: expected 503 got ' + r1.status
        }
      }

      if (overallStatus === 'PASS') {
        var enRes = setWH(true)
        if (!enRes.success) {
          overallStatus = 'BLOCKED'
          stopReason = 'Failed to enable flag: ' + enRes.error
        }
        flagDuring = readFlag()
      }

      if (overallStatus === 'PASS') {
        var t2s = new Date().toISOString(),
          fb2 = readFlag(),
          cb2 = getCounts()
        var r2 = callWH('GET', {}, '')
        var ca2 = getCounts(),
          fa2 = readFlag(),
          t2e = new Date().toISOString()
        var t2pass = r2.status === 405
        securityMatrix.push(
          buildTest(
            2,
            '2_wrong_method_get',
            correlationKey,
            fb2,
            fa2,
            'GET',
            sanitizedUrl,
            {},
            '',
            405,
            r2.status,
            r2.json,
            r2.rawBody,
            cb2,
            ca2,
            t2pass,
            t2s,
            t2e,
          ),
        )
        if (!t2pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 2 FAIL: expected 405 got ' + r2.status
        }
      }

      if (overallStatus === 'PASS') {
        var t3s = new Date().toISOString(),
          fb3 = readFlag(),
          cb3 = getCounts()
        var r3 = callWH('POST', { 'Content-Type': 'text/plain' }, '{}')
        var ca3 = getCounts(),
          fa3 = readFlag(),
          t3e = new Date().toISOString()
        var t3pass = r3.status === 400
        securityMatrix.push(
          buildTest(
            3,
            '3_invalid_content_type',
            correlationKey,
            fb3,
            fa3,
            'POST',
            sanitizedUrl,
            { 'Content-Type': 'text/plain' },
            '{}',
            400,
            r3.status,
            r3.json,
            r3.rawBody,
            cb3,
            ca3,
            t3pass,
            t3s,
            t3e,
          ),
        )
        if (!t3pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 3 FAIL: expected 400 got ' + r3.status
        }
      }

      if (overallStatus === 'PASS') {
        var s4 = sign({})
        var t4s = new Date().toISOString(),
          fb4 = readFlag(),
          cb4 = getCounts()
        var r4 = callWH('POST', s4.headers, s4.body)
        var ca4 = getCounts(),
          fa4 = readFlag(),
          t4e = new Date().toISOString()
        var t4pass = r4.status === 400
        securityMatrix.push(
          buildTest(
            4,
            '4_empty_body',
            correlationKey,
            fb4,
            fa4,
            'POST',
            sanitizedUrl,
            s4.headers,
            s4.body,
            400,
            r4.status,
            r4.json,
            r4.rawBody,
            cb4,
            ca4,
            t4pass,
            t4s,
            t4e,
          ),
        )
        if (!t4pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 4 FAIL: expected 400 got ' + r4.status
        }
      }

      if (overallStatus === 'PASS') {
        var t5s = new Date().toISOString(),
          fb5 = readFlag(),
          cb5 = getCounts()
        var r5 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': 'x' },
          'not-json{',
        )
        var ca5 = getCounts(),
          fa5 = readFlag(),
          t5e = new Date().toISOString()
        var t5pass = r5.status === 400 || r5.status === 401
        securityMatrix.push(
          buildTest(
            5,
            '5_malformed_body',
            correlationKey,
            fb5,
            fa5,
            'POST',
            sanitizedUrl,
            { 'Content-Type': 'application/json', 'X-AC-Signature': 'x' },
            'not-json{',
            400,
            r5.status,
            r5.json,
            r5.rawBody,
            cb5,
            ca5,
            t5pass,
            t5s,
            t5e,
          ),
        )
        if (!t5pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 5 FAIL: expected 400/401 got ' + r5.status
        }
      }

      if (overallStatus === 'PASS') {
        var oversizedPayload = { data: new Array(300000).join('x') }
        var s6 = sign(oversizedPayload)
        var t6s = new Date().toISOString(),
          fb6 = readFlag(),
          cb6 = getCounts()
        var r6 = callWH('POST', s6.headers, s6.body)
        var ca6 = getCounts(),
          fa6 = readFlag(),
          t6e = new Date().toISOString()
        var t6pass = r6.status === 400
        securityMatrix.push(
          buildTest(
            6,
            '6_oversized_body',
            correlationKey,
            fb6,
            fa6,
            'POST',
            sanitizedUrl,
            s6.headers,
            s6.body,
            400,
            r6.status,
            r6.json,
            r6.rawBody,
            cb6,
            ca6,
            t6pass,
            t6s,
            t6e,
          ),
        )
        if (!t6pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 6 FAIL: expected 400 got ' + r6.status
        }
      }

      if (overallStatus === 'PASS') {
        var t7Payload = {
          type: 'contact_create',
          contact: {
            id: correlationKey + '-SM-001',
            firstName: '[TESTE]',
            lastName: 'R13MissingSig',
            email: 'teste-r13-sm@teste.local',
            phone: '+5511999999999',
          },
        }
        var t7Body = JSON.stringify(t7Payload)
        var t7ByteLen = t7Body.length
        var t7Headers = { 'Content-Type': 'application/json' }
        var t7s = new Date().toISOString(),
          fb7 = readFlag(),
          cb7 = getCounts()
        var r7 = callWH('POST', t7Headers, t7Body)
        var ca7 = getCounts(),
          fa7 = readFlag(),
          t7e = new Date().toISOString()
        var t7pass = r7.status === 401 && r7.json.error === 'missing_signature'
        var t7 = buildTest(
          7,
          '7_missing_signature',
          correlationKey,
          fb7,
          fa7,
          'POST',
          sanitizedUrl,
          t7Headers,
          t7Body,
          401,
          r7.status,
          r7.json,
          r7.rawBody,
          cb7,
          ca7,
          t7pass,
          t7s,
          t7e,
        )
        t7.content_length_mode = 'automatic'
        t7.content_length_note =
          'Content-Length NOT set manually — runtime/$http.send computes it automatically (' +
          t7ByteLen +
          ' bytes ASCII JSON body); X-AC-Signature header omitted'
        t7.signature_header_present = false
        t7.payload_is_full_semantic_copy =
          'Exact copy of positive control payload (contact_create) with IDs swapped to R13 correlation key'
        t7.timestamp_note =
          'No timestamp in payload — positive control also has no timestamp; signature absence is validated before any other check'
        t7.expected_error_code = 'missing_signature'
        t7.barrier_layer = 'R13_outermost_barrier'
        securityMatrix.push(t7)

        var t7EventoCreated = findEvento(correlationKey + '-SM-001')
        var t7VinculoCreated = findVinculo('contact', correlationKey + '-SM-001')
        if (t7EventoCreated || t7VinculoCreated) {
          test7CriticalFail = true
          overallStatus = 'FAIL'
          stopReason =
            'CRITICAL: Test 7 returned ' +
            r7.status +
            ' (expected 401) but created records — webhook processed event without signature'
          t7.critical_fail = true
          t7.records_created = {
            evento: t7EventoCreated ? t7EventoCreated.id : null,
            vinculo: t7VinculoCreated ? t7VinculoCreated.id : null,
          }
          if (t7EventoCreated)
            evidenceIds.push({
              collection: 'com_eventos_integracao',
              id: t7EventoCreated.id.substring(0, 8),
              note: 'CRITICAL: created by test 7 without signature',
            })
          if (t7VinculoCreated) {
            evidenceIds.push({
              collection: 'com_vinculos_externos',
              id: t7VinculoCreated.id.substring(0, 8),
              note: 'CRITICAL: created by test 7 without signature',
            })
            try {
              var t7ContatoRec = $app.findRecordById(
                'com_contatos',
                t7VinculoCreated.getString('record_id'),
              )
              if (t7ContatoRec)
                evidenceIds.push({
                  collection: 'com_contatos',
                  id: t7ContatoRec.id.substring(0, 8),
                  note: 'CRITICAL: created by test 7 without signature',
                })
            } catch (_) {}
          }
        } else if (!t7pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 7 FAIL: expected 401 with missing_signature got ' + r7.status
        }
      }

      if (overallStatus === 'PASS') {
        var t8Payload = {
          type: 'contact_create',
          contact: {
            id: correlationKey + '-IS-001',
            firstName: '[TESTE]',
            lastName: 'R13InvalidSig',
            email: 'teste-r13-is@teste.local',
            phone: '+5511999999999',
          },
        }
        var t8Signed = sign(t8Payload)
        var t8Headers = {
          'Content-Type': 'application/json',
          'X-AC-Signature': 'tampered_invalid_signature_aaa',
        }
        var t8s = new Date().toISOString(),
          fb8 = readFlag(),
          cb8 = getCounts()
        var r8 = callWH('POST', t8Headers, t8Signed.body)
        var ca8 = getCounts(),
          fa8 = readFlag(),
          t8e = new Date().toISOString()
        var t8pass = r8.status === 401 && r8.json.error === 'invalid_signature'
        var t8 = buildTest(
          8,
          '8_invalid_signature',
          correlationKey,
          fb8,
          fa8,
          'POST',
          sanitizedUrl,
          t8Headers,
          t8Signed.body,
          401,
          r8.status,
          r8.json,
          r8.rawBody,
          cb8,
          ca8,
          t8pass,
          t8s,
          t8e,
        )
        t8.content_length_mode = 'automatic'
        t8.signature_header_present = true
        t8.signature_valid = false
        t8.expected_error_code = 'invalid_signature'
        t8.barrier_layer = 'R13_outermost_barrier'
        t8.payload_is_full_semantic_copy =
          'Exact copy of positive control payload (contact_create) with IDs swapped to R13 correlation key; signature header present but tampered'
        securityMatrix.push(t8)

        var t8EventoCreated = findEvento(correlationKey + '-IS-001')
        var t8VinculoCreated = findVinculo('contact', correlationKey + '-IS-001')
        if (t8EventoCreated || t8VinculoCreated) {
          overallStatus = 'FAIL'
          stopReason =
            'CRITICAL: Test 8 returned ' +
            r8.status +
            ' (expected 401) but created records — webhook processed event with invalid signature'
          t8.critical_fail = true
          t8.records_created = {
            evento: t8EventoCreated ? t8EventoCreated.id : null,
            vinculo: t8VinculoCreated ? t8VinculoCreated.id : null,
          }
        } else if (!t8pass) {
          overallStatus = 'FAIL'
          stopReason = 'Test 8 FAIL: expected 401 with invalid_signature got ' + r8.status
        }
      }

      if (overallStatus === 'PASS' && mode === 'full') {
        var fn = {}
        var contactExtId = correlationKey + '-FN-C1'
        var cp = sign({
          type: 'contact_create',
          contact: {
            id: contactExtId,
            firstName: '[TESTE]',
            lastName: 'R13Full',
            email: 'teste-r13@teste.local',
            phone: '+5511999999999',
          },
        })
        var f1s = new Date().toISOString(),
          ffb1 = readFlag(),
          fcb1 = getCounts()
        var fr1 = callWH('POST', cp.headers, cp.body)
        var fca1 = getCounts(),
          ffa1 = readFlag(),
          f1e = new Date().toISOString()
        var f1pass = fr1.status === 200
        fn.contact_create = buildTest(
          'F1',
          'contact_create',
          correlationKey,
          ffb1,
          ffa1,
          'POST',
          sanitizedUrl,
          cp.headers,
          cp.body,
          200,
          fr1.status,
          fr1.json,
          fr1.rawBody,
          fcb1,
          fca1,
          f1pass,
          f1s,
          f1e,
        )
        if (!f1pass) {
          overallStatus = 'FAIL'
          stopReason = 'FN contact_create FAIL: expected 200 got ' + fr1.status
        }
        if (fr1.status === 200 && fr1.json.event_id)
          evidenceIds.push({
            collection: 'com_eventos_integracao',
            id: String(fr1.json.event_id).substring(0, 8),
          })
        var cV = findVinculo('contact', contactExtId)
        if (cV) {
          evidenceIds.push({ collection: 'com_vinculos_externos', id: cV.id.substring(0, 8) })
          evidenceIds.push({
            collection: 'com_contatos',
            id: cV.getString('record_id').substring(0, 8),
          })
        }

        if (overallStatus === 'PASS') {
          var f2s = new Date().toISOString(),
            ffb2 = readFlag(),
            fcb2 = getCounts()
          var fr2 = callWH('POST', cp.headers, cp.body)
          var fca2 = getCounts(),
            ffa2 = readFlag(),
            f2e = new Date().toISOString()
          var f2pass = fr2.status === 409 && fr2.json.duplicate === true
          idempotencyReplay = buildTest(
            'F2',
            'idempotency_replay',
            correlationKey,
            ffb2,
            ffa2,
            'POST',
            sanitizedUrl,
            cp.headers,
            cp.body,
            409,
            fr2.status,
            fr2.json,
            fr2.rawBody,
            fcb2,
            fca2,
            f2pass,
            f2s,
            f2e,
          )
          if (!f2pass) {
            overallStatus = 'FAIL'
            stopReason = 'FN idempotency_replay FAIL: expected 409 got ' + fr2.status
          }
        }

        var dealExtId = correlationKey + '-FN-D1'
        if (overallStatus === 'PASS') {
          var dp = sign({
            type: 'deal_create',
            deal: {
              id: dealExtId,
              title: '[TESTE] R13 Full Negocio',
              value: 10000,
              stage: 'prospects',
            },
          })
          var f3s = new Date().toISOString(),
            ffb3 = readFlag(),
            fcb3 = getCounts()
          var fr3 = callWH('POST', dp.headers, dp.body)
          var fca3 = getCounts(),
            ffa3 = readFlag(),
            f3e = new Date().toISOString()
          var f3pass = fr3.status === 200
          fn.deal_create = buildTest(
            'F3',
            'deal_create',
            correlationKey,
            ffb3,
            ffa3,
            'POST',
            sanitizedUrl,
            dp.headers,
            dp.body,
            200,
            fr3.status,
            fr3.json,
            fr3.rawBody,
            fcb3,
            fca3,
            f3pass,
            f3s,
            f3e,
          )
          if (!f3pass) {
            overallStatus = 'FAIL'
            stopReason = 'FN deal_create FAIL: expected 200 got ' + fr3.status
          }
          if (fr3.status === 200 && fr3.json.event_id)
            evidenceIds.push({
              collection: 'com_eventos_integracao',
              id: String(fr3.json.event_id).substring(0, 8),
            })
          var dV = findVinculo('business', dealExtId)
          if (dV) {
            evidenceIds.push({ collection: 'com_vinculos_externos', id: dV.id.substring(0, 8) })
            evidenceIds.push({
              collection: 'com_negocios',
              id: dV.getString('record_id').substring(0, 8),
            })
          }
        }

        if (overallStatus === 'PASS') {
          var up = sign({
            type: 'deal_update',
            deal: {
              id: dealExtId,
              title: '[TESTE] R13 Full Atualizado',
              value: 15000,
              stage: 'producao_proposta',
            },
          })
          var f4s = new Date().toISOString(),
            ffb4 = readFlag(),
            fcb4 = getCounts()
          var fr4 = callWH('POST', up.headers, up.body)
          var fca4 = getCounts(),
            ffa4 = readFlag(),
            f4e = new Date().toISOString()
          var snapCt = fca4.snapshots - fcb4.snapshots
          var f4pass = fr4.status === 200 && snapCt > 0
          fn.deal_update_snapshot = buildTest(
            'F4',
            'deal_update_snapshot',
            correlationKey,
            ffb4,
            ffa4,
            'POST',
            sanitizedUrl,
            up.headers,
            up.body,
            200,
            fr4.status,
            fr4.json,
            fr4.rawBody,
            fcb4,
            fca4,
            f4pass,
            f4s,
            f4e,
          )
          fn.deal_update_snapshot.snapshots_created = snapCt
          if (!f4pass) {
            overallStatus = 'FAIL'
            stopReason = 'FN deal_update_snapshot FAIL'
          }
          if (f4pass) {
            var dV2 = findVinculo('business', dealExtId)
            if (dV2) {
              try {
                var snaps = $app.findRecordsByFilter(
                  'com_snapshots_negocio',
                  "negocio_id = '" + dV2.getString('record_id') + "'",
                  '-created',
                  1,
                  0,
                )
                if (snaps.length > 0)
                  evidenceIds.push({
                    collection: 'com_snapshots_negocio',
                    id: snaps[0].id.substring(0, 8),
                  })
              } catch (_) {}
            }
          }
        }

        var unmappedExtId = correlationKey + '-FN-D2'
        if (overallStatus === 'PASS') {
          var um = sign({
            type: 'deal_create',
            deal: {
              id: unmappedExtId,
              title: '[TESTE] R13 Sem Map',
              value: 5000,
              stage: 'unmapped_stage_xyz',
            },
          })
          var f5s = new Date().toISOString(),
            ffb5 = readFlag(),
            fcb5 = getCounts()
          var fr5 = callWH('POST', um.headers, um.body)
          var fca5 = getCounts(),
            ffa5 = readFlag(),
            f5e = new Date().toISOString()
          var f5pass = fr5.status === 200 && fca5.ocorrencias > fcb5.ocorrencias
          fn.unmapped_stage_quality = buildTest(
            'F5',
            'unmapped_stage_quality',
            correlationKey,
            ffb5,
            ffa5,
            'POST',
            sanitizedUrl,
            um.headers,
            um.body,
            200,
            fr5.status,
            fr5.json,
            fr5.rawBody,
            fcb5,
            fca5,
            f5pass,
            f5s,
            f5e,
          )
          if (!f5pass) {
            overallStatus = 'FAIL'
            stopReason = 'FN unmapped_stage_quality FAIL'
          }
          if (f5pass) {
            try {
              var occs = $app.findRecordsByFilter('com_ocorrencias_qualidade', '', '-created', 1, 0)
              if (occs.length > 0)
                evidenceIds.push({
                  collection: 'com_ocorrencias_qualidade',
                  id: occs[0].id.substring(0, 8),
                })
            } catch (_) {}
          }
        }

        if (overallStatus === 'PASS') {
          var f6s = new Date().toISOString(),
            ffb6 = readFlag(),
            fcb6 = getCounts()
          var rbRes = callRB(dealExtId, 'business')
          var fca6 = getCounts(),
            ffa6 = readFlag(),
            f6e = new Date().toISOString()
          var dealRestored = false
          var dV3 = findVinculo('business', dealExtId)
          if (dV3) {
            try {
              var negRec = $app.findRecordById('com_negocios', dV3.getString('record_id'))
              dealRestored =
                negRec.getString('titulo') === '[TESTE] R13 Full Negocio' &&
                negRec.getString('etapa') === 'prospects'
            } catch (_) {}
          }
          var f6pass = rbRes.status === 200 && dealRestored
          rollbackResult = buildTest(
            'F6',
            'rollback',
            correlationKey,
            ffb6,
            ffa6,
            'POST',
            '/backend/v1/integracao/ac/rollback',
            { 'Content-Type': 'application/json' },
            JSON.stringify({ external_id: dealExtId, entity_type: 'business' }),
            200,
            rbRes.status,
            rbRes.json,
            '',
            fcb6,
            fca6,
            f6pass,
            f6s,
            f6e,
          )
          rollbackResult.restored = dealRestored
          if (!f6pass) {
            overallStatus = 'FAIL'
            stopReason = 'FN rollback FAIL'
          }
          if (rbRes.json.rolled_back && rbRes.json.rolled_back.length > 0) {
            for (var ri = 0; ri < rbRes.json.rolled_back.length; ri++) {
              if (rbRes.json.rolled_back[ri].compensating_event)
                evidenceIds.push({
                  collection: 'com_eventos_integracao',
                  id: String(rbRes.json.rolled_back[ri].compensating_event).substring(0, 8),
                })
            }
          }
        }

        if (overallStatus === 'PASS') {
          var f7s = new Date().toISOString(),
            ffb7 = readFlag(),
            fcb7 = getCounts()
          var rbRes2 = callRB(dealExtId, 'business')
          var fca7 = getCounts(),
            ffa7 = readFlag(),
            f7e = new Date().toISOString()
          var f7pass = rbRes2.status === 200 || rbRes2.status === 404
          fn.rollback_idempotency = buildTest(
            'F7',
            'rollback_idempotency',
            correlationKey,
            ffb7,
            ffa7,
            'POST',
            '/backend/v1/integracao/ac/rollback',
            { 'Content-Type': 'application/json' },
            JSON.stringify({ external_id: dealExtId, entity_type: 'business' }),
            200,
            rbRes2.status,
            rbRes2.json,
            '',
            fcb7,
            fca7,
            f7pass,
            f7s,
            f7e,
          )
          if (!f7pass) {
            overallStatus = 'FAIL'
            stopReason = 'FN rollback_idempotency FAIL'
          }
        }

        functionalFlow = fn
      }
    } finally {
      if (test7CriticalFail) {
        var compActions = []
        var t7ExtId = correlationKey + '-SM-001'
        var t7Evt = findEvento(t7ExtId)
        if (t7Evt) {
          try {
            t7Evt.set('status', 'compensated_test7_critical_fail')
            $app.save(t7Evt)
            compActions.push({
              collection: 'com_eventos_integracao',
              id: t7Evt.id,
              action: 'marked_compensated',
            })
          } catch (_) {}
        }
        var t7Vinc = findVinculo('contact', t7ExtId)
        if (t7Vinc) {
          try {
            var t7ContatoId = t7Vinc.getString('record_id')
            if (t7ContatoId) {
              var t7Contato = $app.findRecordById('com_contatos', t7ContatoId)
              if (t7Contato) {
                t7Contato.set('ativo', false)
                $app.save(t7Contato)
                compActions.push({
                  collection: 'com_contatos',
                  id: t7ContatoId,
                  action: 'deactivated',
                })
              }
            }
          } catch (_) {}
        }
        test7Compensation = {
          critical_fail: true,
          compensated: true,
          actions: compActions,
          evidence_preserved: true,
          note: 'Synthetic data from test 7 was compensated (deactivated/marked) but NOT deleted — evidence preserved in returned JSON',
        }
      }

      var restoreRes = setWH(false)
      flagFinal = readFlag()
      if (!restoreRes.success) {
        overallStatus = 'BLOCKED'
        if (!stopReason) stopReason = 'Failed to restore flag: ' + restoreRes.error
      }
      if (flagFinal.error) {
        overallStatus = 'BLOCKED'
        if (!stopReason) stopReason = 'Failed to re-read flag after restore: ' + flagFinal.error
      }
      if (flagFinal.valor !== 'false' || flagFinal.ativo !== false) {
        overallStatus = 'BLOCKED'
        if (!stopReason)
          stopReason = 'Flag not restored: valor=' + flagFinal.valor + ' ativo=' + flagFinal.ativo
      }
      var probeRes = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
      finalProbeStatus = probeRes.status
      if (probeRes.status !== 503) {
        overallStatus = 'BLOCKED'
        if (!stopReason) stopReason = 'Final probe expected 503 got ' + probeRes.status
      }
    }

    var finishedAt = new Date().toISOString()
    countsAfter = getCounts()

    return e.json(200, {
      runner_version: 'R13',
      correlation_key: correlationKey,
      started_at: startedAt,
      finished_at: finishedAt,
      build_timestamp: startedAt,
      overall_status: overallStatus,
      stop_reason: stopReason,
      security_matrix: securityMatrix,
      functional_flow: functionalFlow,
      idempotency_replay: idempotencyReplay,
      rollback: rollbackResult,
      test7_compensation: test7Compensation,
      counts_before: countsBefore,
      counts_after: countsAfter,
      flag_before: flagBefore,
      flag_during: flagDuring,
      flag_final: flagFinal,
      final_webhook_probe_status: finalProbeStatus,
      evidence_ids: evidenceIds,
      activecampaign_calls: 0,
    })
  },
  $apis.requireAuth(),
)
