routerAdd(
  'POST',
  '/backend/v1/integracao/ac/security-matrix',
  (e) => {
    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Auth necessaria')
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

    var baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
    var whSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''

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
      } catch (_) {}
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
        return { status: res.statusCode, json: j }
      } catch (err) {
        return { status: 0, json: { error: String(err).substring(0, 100) } }
      }
    }
    function sign(payload) {
      var canonical = canonicalize(payload)
      var bodyStr = JSON.stringify(payload)
      return {
        headers: {
          'Content-Type': 'application/json',
          'X-AC-Signature': $security.hs256(canonical, whSecret),
        },
        body: bodyStr,
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
        negocios: safeCount('com_negocios'),
        snapshots: safeCount('com_snapshots_negocio'),
        ocorrencias: safeCount('com_ocorrencias_qualidade'),
      }
    }

    var before = getCounts()
    var results = []
    var r

    function failStop() {
      var passed = 0,
        failed = 0
      for (var i = 0; i < results.length; i++) {
        if (results[i].pass) passed++
        else failed++
      }
      return e.json(500, {
        stage: 'porta-2d-etapa-2a',
        matrix: results,
        summary: { total: results.length, passed: passed, failed: failed },
        beforeCounts: before,
        afterCounts: getCounts(),
        webhookDisabled: true,
        zeroExternalCalls: true,
      })
    }

    try {
      setWH(false)
      r = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
      results.push({
        test: 'disabled_returns_503',
        status: r.status,
        expected: 503,
        pass: r.status === 503,
      })
      if (!results[results.length - 1].pass) return failStop()

      setWH(true)

      r = callWH('GET', {}, '')
      results.push({
        test: 'wrong_method_get',
        status: r.status,
        expected: 405,
        pass: r.status === 405,
      })
      if (!results[results.length - 1].pass) return failStop()

      r = callWH('POST', { 'Content-Type': 'text/plain' }, '{}')
      results.push({
        test: 'invalid_content_type',
        status: r.status,
        expected: 400,
        pass: r.status === 400,
      })
      if (!results[results.length - 1].pass) return failStop()

      var emptySigned = sign({})
      r = callWH('POST', emptySigned.headers, emptySigned.body)
      results.push({ test: 'empty_body', status: r.status, expected: 400, pass: r.status === 400 })
      if (!results[results.length - 1].pass) return failStop()

      r = callWH('POST', { 'Content-Type': 'application/json', 'X-AC-Signature': 'x' }, 'not-json{')
      results.push({
        test: 'malformed_body',
        status: r.status,
        expected: 400,
        pass: r.status === 400 || r.status === 401,
      })
      if (!results[results.length - 1].pass) return failStop()

      r = callWH(
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify({ data: new Array(300000).join('x') }),
      )
      results.push({
        test: 'oversized_body',
        status: r.status,
        expected: 400,
        pass: r.status === 400,
      })
      if (!results[results.length - 1].pass) return failStop()

      r = callWH(
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify({
          type: 't',
          contact: { id: 'TESTE-SM-001' },
          timestamp: new Date().toISOString(),
        }),
      )
      results.push({
        test: 'missing_signature',
        status: r.status,
        expected: 401,
        pass: r.status === 401,
      })
      if (!results[results.length - 1].pass) return failStop()

      r = callWH(
        'POST',
        { 'Content-Type': 'application/json', 'X-AC-Signature': 'invalid' },
        JSON.stringify({ type: 't', contact: { id: 'TESTE-SM-002' } }),
      )
      results.push({
        test: 'invalid_signature',
        status: r.status,
        expected: 401,
        pass: r.status === 401,
      })
      if (!results[results.length - 1].pass) return failStop()

      var vp = {
        type: 'contact_create',
        contact: {
          id: 'TESTE-SM-003',
          firstName: '[TESTE]',
          lastName: 'SecMatrix',
          email: 'teste@teste.local',
        },
      }
      var sp = sign(vp)
      r = callWH('POST', sp.headers, sp.body)
      results.push({
        test: 'valid_signature_no_timestamp',
        status: r.status,
        expected: 200,
        pass: r.status === 200,
        evt: r.json.event_id ? String(r.json.event_id).substring(0, 8) : '',
      })
      if (!results[results.length - 1].pass) return failStop()

      var badTs = sign({
        type: 'contact_create',
        contact: { id: 'TESTE-SM-004' },
        timestamp: 'invalid',
      })
      r = callWH('POST', badTs.headers, badTs.body)
      results.push({
        test: 'invalid_timestamp',
        status: r.status,
        expected: 400,
        pass: r.status === 400,
      })
      if (!results[results.length - 1].pass) return failStop()

      var futTs = sign({
        type: 'contact_create',
        contact: { id: 'TESTE-SM-005' },
        timestamp: new Date(Date.now() + 600000).toISOString(),
      })
      r = callWH('POST', futTs.headers, futTs.body)
      results.push({
        test: 'future_timestamp',
        status: r.status,
        expected: 400,
        pass: r.status === 400,
      })
      if (!results[results.length - 1].pass) return failStop()

      var oldTs = sign({
        type: 'contact_create',
        contact: { id: 'TESTE-SM-006' },
        timestamp: new Date(Date.now() - 600000).toISOString(),
      })
      r = callWH('POST', oldTs.headers, oldTs.body)
      results.push({
        test: 'old_timestamp_outside_window',
        status: r.status,
        expected: 400,
        pass: r.status === 400,
      })
      if (!results[results.length - 1].pass) return failStop()

      r = callWH('POST', sp.headers, sp.body)
      results.push({
        test: 'replay_same_event',
        status: r.status,
        expected: 409,
        pass: r.status === 409 && r.json.duplicate === true,
        dup: r.json.duplicate,
      })
      if (!results[results.length - 1].pass) return failStop()

      var diffP = sign({
        type: 'contact_create',
        contact: { id: 'TESTE-SM-007', firstName: '[TESTE]', lastName: 'DiffId' },
      })
      r = callWH('POST', diffP.headers, diffP.body)
      results.push({
        test: 'different_id_new_event',
        status: r.status,
        expected: 200,
        pass: r.status === 200 && !r.json.duplicate,
        dup: r.json.duplicate,
      })
      if (!results[results.length - 1].pass) return failStop()

      setWH(false)
      r = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
      results.push({
        test: 'redisabled_returns_503',
        status: r.status,
        expected: 503,
        pass: r.status === 503,
      })
      if (!results[results.length - 1].pass) return failStop()

      var after = getCounts()
      var passed = 0,
        failed = 0
      for (var i = 0; i < results.length; i++) {
        if (results[i].pass) passed++
        else failed++
      }
      return e.json(200, {
        stage: 'porta-2d-etapa-2a',
        matrix: results,
        summary: { total: results.length, passed: passed, failed: failed },
        beforeCounts: before,
        afterCounts: after,
        webhookDisabled: true,
        zeroExternalCalls: true,
      })
    } finally {
      setWH(false)
    }
  },
  $apis.requireAuth(),
)
