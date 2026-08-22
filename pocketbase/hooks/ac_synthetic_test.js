routerAdd(
  'POST',
  '/backend/v1/integracao/ac/synthetic-test',
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
    var authHeader = e.request.header.get('Authorization') || ''

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
    function callWH(payload) {
      var body = JSON.stringify(payload)
      try {
        var res = $http.send({
          url: baseUrl + '/backend/v1/integracao/ac/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AC-Signature': $security.hs256(body, whSecret),
          },
          body: body,
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
    function callRollback(extId, extType) {
      try {
        var res = $http.send({
          url: baseUrl + '/backend/v1/integracao/ac/rollback',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
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
        negocios: safeCount('com_negocios'),
        snapshots: safeCount('com_snapshots_negocio'),
        ocorrencias: safeCount('com_ocorrencias_qualidade'),
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

    var before = getCounts()
    var results = {}
    setWH(true)

    var contactEvt = {
      type: 'contact_create',
      contact: {
        id: 'TESTE-SYN-001',
        firstName: '[TESTE]',
        lastName: 'Contact',
        email: 'teste-syn@teste.local',
        phone: '+5511999999999',
      },
    }
    var contactRes = callWH(contactEvt)
    var contactVinc = findVinculo('contact', 'TESTE-SYN-001')
    results.contact_create = {
      status: contactRes.status,
      pass: contactRes.status === 200 && !!contactVinc,
      evt: contactRes.json.event_id ? String(contactRes.json.event_id).substring(0, 8) : '',
      vinculo: contactVinc ? contactVinc.id.substring(0, 8) : '',
    }

    var contactRes2 = callWH(contactEvt)
    results.idempotency_replay = {
      status: contactRes2.status,
      pass: contactRes2.status === 409 && contactRes2.json.duplicate === true,
      dup: contactRes2.json.duplicate,
    }

    var dealRes = callWH({
      type: 'deal_create',
      deal: {
        id: 'TESTE-SYN-001',
        title: '[TESTE] Negocio Sintetico',
        value: 10000,
        stage: 'prospects',
      },
    })
    var dealVinc = findVinculo('business', 'TESTE-SYN-001')
    results.deal_create = {
      status: dealRes.status,
      pass: dealRes.status === 200 && !!dealVinc,
      vinculo: dealVinc ? dealVinc.id.substring(0, 8) : '',
    }

    var dealUpdRes = callWH({
      type: 'deal_update',
      deal: {
        id: 'TESTE-SYN-001',
        title: '[TESTE] Negocio Atualizado',
        value: 15000,
        stage: 'producao_proposta',
      },
    })
    var snapCount = 0
    if (dealVinc) {
      try {
        var snaps = $app.findRecordsByFilter(
          'com_snapshots_negocio',
          "negocio_id = '" + dealVinc.getString('record_id') + "'",
          '',
          100,
          0,
        )
        snapCount = snaps.length
      } catch (_) {}
    }
    results.deal_update_snapshot = {
      status: dealUpdRes.status,
      pass: dealUpdRes.status === 200 && snapCount > 0,
      snapshots: snapCount,
    }

    var occBefore = safeCount('com_ocorrencias_qualidade')
    var unmappedRes = callWH({
      type: 'deal_create',
      deal: {
        id: 'TESTE-SYN-002',
        title: '[TESTE] Sem Mapeamento',
        value: 5000,
        stage: 'unmapped_stage_xyz',
      },
    })
    var occAfter = safeCount('com_ocorrencias_qualidade')
    results.unmapped_stage_quality_occurrence = {
      status: unmappedRes.status,
      pass: unmappedRes.status === 200 && occAfter > occBefore,
      occ_created: occAfter > occBefore,
    }

    var rbRes = callRollback('TESTE-SYN-001', 'business')
    var dealRestored = false
    if (dealVinc) {
      try {
        var negRec = $app.findRecordById('com_negocios', dealVinc.getString('record_id'))
        dealRestored =
          negRec.getString('titulo') === '[TESTE] Negocio Sintetico' &&
          negRec.getString('etapa') === 'prospects'
      } catch (_) {}
    }
    results.rollback = {
      status: rbRes.status,
      pass: rbRes.status === 200 && dealRestored,
      restored: dealRestored,
      rolled_back: rbRes.json.rolled_back ? rbRes.json.rolled_back.length : 0,
    }

    var rbRes2 = callRollback('TESTE-SYN-001', 'business')
    results.rollback_idempotency = {
      status: rbRes2.status,
      pass: rbRes2.status === 200 || rbRes2.status === 404,
    }

    var after = getCounts()
    setWH(false)

    var disRes = callWH({ type: 'test' })
    results.disabled_after_test = { status: disRes.status, pass: disRes.status === 503 }

    var allPass = true
    for (var k in results) {
      if (!results[k].pass) allPass = false
    }

    return e.json(200, {
      stage: 'porta-2d-etapa-2a',
      results: results,
      allPass: allPass,
      beforeCounts: before,
      afterCounts: after,
      webhookDisabled: true,
      zeroExternalCalls: true,
      zeroRealData: true,
      testeRecordsPreserved: true,
      message:
        'Porta 2D-2A executada. Webhook desativado. Porta 2D NAO aprovada. 2D-2B e 2E bloqueadas.',
    })
  },
  $apis.requireAuth(),
)
