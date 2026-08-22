routerAdd(
  'POST',
  '/backend/v1/integracao/ac/run-round-2d2a-r3',
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

    var reqBody = e.requestInfo().body || {}
    var mode = reqBody.mode || 'security-only'
    if (mode !== 'security-only' && mode !== 'full') mode = 'security-only'

    var ts = new Date().toISOString().replace(/[:.]/g, '-')
    var nonce = $security.randomString(8)
    var correlationKey = 'TESTE-2D2A-R4-' + ts + '-' + nonce

    var baseUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var whSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    var authHdr = e.request.header.get('Authorization') || ''

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
    function callWH(method, headers, bodyStr) {
      try {
        var res = $http.send({
          url: baseUrl + '/backend/v1/integracao/ac/webhook',
          method: method,
          headers: headers,
          body: bodyStr || '',
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
    function sc(n) {
      try {
        return $app.countRecords(n)
      } catch (_) {
        return -1
      }
    }
    function getCounts() {
      return {
        eventos: sc('com_eventos_integracao'),
        execucoes: sc('com_execucoes_sincronizacao'),
        vinculos: sc('com_vinculos_externos'),
        ocorrencias: sc('com_ocorrencias_qualidade'),
        snapshots: sc('com_snapshots_negocio'),
        negocios: sc('com_negocios'),
        parametros: sc('com_parametros'),
      }
    }
    function countsEq(a, b) {
      return (
        a.eventos === b.eventos &&
        a.execucoes === b.execucoes &&
        a.vinculos === b.vinculos &&
        a.ocorrencias === b.ocorrencias &&
        a.snapshots === b.snapshots &&
        a.negocios === b.negocios
      )
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
    function getCreated(col, id) {
      try {
        return $app.findRecordById(col, id).getString('created') || ''
      } catch (_) {
        return ''
      }
    }

    var evidenceLedger = []
    function addEvidence(col, id, created, corr) {
      if (id)
        evidenceLedger.push({
          collection: col,
          id: String(id).substring(0, 8),
          created: created || '',
          correlationKey: corr,
        })
    }

    var beforeCounts = getCounts()
    var securityMatrix = []
    var stopReason = null
    var functionalResults = null
    var deactivationProof = null

    try {
      setWH(false)
      var cb1 = getCounts()
      var r1 = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
      var ca1 = getCounts()
      securityMatrix.push({
        test: '1_disabled_returns_503',
        expected: 503,
        actual: r1.status,
        passed: r1.status === 503,
        beforeCounts: cb1,
        afterCounts: ca1,
      })
      if (r1.status !== 503) stopReason = 'Test 1 FAIL: expected 503 got ' + r1.status

      if (!stopReason) {
        setWH(true)
        var cb2 = getCounts()
        var r2 = callWH('GET', {}, '')
        var ca2 = getCounts()
        securityMatrix.push({
          test: '2_wrong_method_get',
          expected: 405,
          actual: r2.status,
          passed: r2.status === 405,
          beforeCounts: cb2,
          afterCounts: ca2,
        })
        if (r2.status !== 405) stopReason = 'Test 2 FAIL: expected 405 got ' + r2.status
      }
      if (!stopReason) {
        var cb3 = getCounts()
        var r3 = callWH('POST', { 'Content-Type': 'text/plain' }, '{}')
        var ca3 = getCounts()
        securityMatrix.push({
          test: '3_invalid_content_type',
          expected: 400,
          actual: r3.status,
          passed: r3.status === 400,
          beforeCounts: cb3,
          afterCounts: ca3,
        })
        if (r3.status !== 400) stopReason = 'Test 3 FAIL: expected 400 got ' + r3.status
      }
      if (!stopReason) {
        var s4 = sign({})
        var cb4 = getCounts()
        var r4 = callWH('POST', s4.headers, s4.body)
        var ca4 = getCounts()
        securityMatrix.push({
          test: '4_empty_body',
          expected: 400,
          actual: r4.status,
          passed: r4.status === 400,
          beforeCounts: cb4,
          afterCounts: ca4,
        })
        if (r4.status !== 400) stopReason = 'Test 4 FAIL: expected 400 got ' + r4.status
      }
      if (!stopReason) {
        var cb5 = getCounts()
        var r5 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': 'x' },
          'not-json{',
        )
        var ca5 = getCounts()
        securityMatrix.push({
          test: '5_malformed_body',
          expected: 400,
          actual: r5.status,
          passed: r5.status === 400 || r5.status === 401,
          beforeCounts: cb5,
          afterCounts: ca5,
        })
        if (r5.status !== 400 && r5.status !== 401)
          stopReason = 'Test 5 FAIL: expected 400/401 got ' + r5.status
      }
      if (!stopReason) {
        var cb6 = getCounts()
        var r6 = callWH(
          'POST',
          { 'Content-Type': 'application/json' },
          JSON.stringify({ data: new Array(300000).join('x') }),
        )
        var ca6 = getCounts()
        securityMatrix.push({
          test: '6_oversized_body',
          expected: 400,
          actual: r6.status,
          passed: r6.status === 400,
          beforeCounts: cb6,
          afterCounts: ca6,
        })
        if (r6.status !== 400) stopReason = 'Test 6 FAIL: expected 400 got ' + r6.status
      }
      if (!stopReason) {
        var cb7 = getCounts()
        var r7 = callWH(
          'POST',
          { 'Content-Type': 'application/json' },
          JSON.stringify({
            type: 't',
            contact: { id: correlationKey + '-SM-001' },
            timestamp: new Date().toISOString(),
          }),
        )
        var ca7 = getCounts()
        securityMatrix.push({
          test: '7_missing_signature',
          expected: 401,
          actual: r7.status,
          passed: r7.status === 401,
          beforeCounts: cb7,
          afterCounts: ca7,
        })
        if (r7.status !== 401) stopReason = 'Test 7 FAIL: expected 401 got ' + r7.status
      }
      if (!stopReason) {
        var cb8 = getCounts()
        var r8 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': 'invalid' },
          JSON.stringify({ type: 't', contact: { id: correlationKey + '-SM-002' } }),
        )
        var ca8 = getCounts()
        securityMatrix.push({
          test: '8_invalid_signature',
          expected: 401,
          actual: r8.status,
          passed: r8.status === 401,
          beforeCounts: cb8,
          afterCounts: ca8,
        })
        if (r8.status !== 401) stopReason = 'Test 8 FAIL: expected 401 got ' + r8.status
      }

      var validSigned = null
      var validExtId = correlationKey + '-SM-003'
      if (!stopReason) {
        validSigned = sign({
          type: 'contact_create',
          contact: {
            id: validExtId,
            firstName: '[TESTE]',
            lastName: 'SecMatrix',
            email: 'teste@teste.local',
          },
        })
        var cb9 = getCounts()
        var r9 = callWH('POST', validSigned.headers, validSigned.body)
        var ca9 = getCounts()
        securityMatrix.push({
          test: '9_valid_signature_no_timestamp',
          expected: 200,
          actual: r9.status,
          passed: r9.status === 200,
          beforeCounts: cb9,
          afterCounts: ca9,
        })
        if (r9.status !== 200) stopReason = 'Test 9 FAIL: expected 200 got ' + r9.status
        if (r9.status === 200 && r9.json.event_id) {
          addEvidence(
            'com_eventos_integracao',
            r9.json.event_id,
            getCreated('com_eventos_integracao', r9.json.event_id),
            validExtId,
          )
          var smV = findVinculo('contact', validExtId)
          if (smV) {
            addEvidence('com_vinculos_externos', smV.id, smV.getString('created') || '', validExtId)
            addEvidence(
              'com_contatos',
              smV.getString('record_id'),
              getCreated('com_contatos', smV.getString('record_id')),
              validExtId,
            )
          }
        }
      }
      if (!stopReason) {
        var badTs = sign({
          type: 'contact_create',
          contact: { id: correlationKey + '-SM-004' },
          timestamp: 'invalid',
        })
        var cb10 = getCounts()
        var r10 = callWH('POST', badTs.headers, badTs.body)
        var ca10 = getCounts()
        securityMatrix.push({
          test: '10_invalid_timestamp',
          expected: 400,
          actual: r10.status,
          passed: r10.status === 400,
          beforeCounts: cb10,
          afterCounts: ca10,
        })
        if (r10.status !== 400) stopReason = 'Test 10 FAIL: expected 400 got ' + r10.status
      }
      if (!stopReason) {
        var futTs = sign({
          type: 'contact_create',
          contact: { id: correlationKey + '-SM-005' },
          timestamp: new Date(Date.now() + 600000).toISOString(),
        })
        var cb11 = getCounts()
        var r11 = callWH('POST', futTs.headers, futTs.body)
        var ca11 = getCounts()
        securityMatrix.push({
          test: '11_future_timestamp',
          expected: 400,
          actual: r11.status,
          passed: r11.status === 400,
          beforeCounts: cb11,
          afterCounts: ca11,
        })
        if (r11.status !== 400) stopReason = 'Test 11 FAIL: expected 400 got ' + r11.status
      }
      if (!stopReason) {
        var oldTs = sign({
          type: 'contact_create',
          contact: { id: correlationKey + '-SM-006' },
          timestamp: new Date(Date.now() - 600000).toISOString(),
        })
        var cb12 = getCounts()
        var r12 = callWH('POST', oldTs.headers, oldTs.body)
        var ca12 = getCounts()
        securityMatrix.push({
          test: '12_old_timestamp',
          expected: 400,
          actual: r12.status,
          passed: r12.status === 400,
          beforeCounts: cb12,
          afterCounts: ca12,
        })
        if (r12.status !== 400) stopReason = 'Test 12 FAIL: expected 400 got ' + r12.status
      }
      if (!stopReason && validSigned) {
        var cb13 = getCounts()
        var r13 = callWH('POST', validSigned.headers, validSigned.body)
        var ca13 = getCounts()
        securityMatrix.push({
          test: '13_replay_same_event',
          expected: 409,
          actual: r13.status,
          passed: r13.status === 409 && r13.json.duplicate === true,
          beforeCounts: cb13,
          afterCounts: ca13,
          dup: r13.json.duplicate,
        })
        if (r13.status !== 409) stopReason = 'Test 13 FAIL: expected 409 got ' + r13.status
      }
      if (!stopReason) {
        var diffExtId = correlationKey + '-SM-007'
        var diffP = sign({
          type: 'contact_create',
          contact: { id: diffExtId, firstName: '[TESTE]', lastName: 'DiffId' },
        })
        var cb14 = getCounts()
        var r14 = callWH('POST', diffP.headers, diffP.body)
        var ca14 = getCounts()
        securityMatrix.push({
          test: '14_different_id_new_event',
          expected: 200,
          actual: r14.status,
          passed: r14.status === 200 && !r14.json.duplicate,
          beforeCounts: cb14,
          afterCounts: ca14,
          dup: r14.json.duplicate,
        })
        if (r14.status !== 200) stopReason = 'Test 14 FAIL: expected 200 got ' + r14.status
        if (r14.status === 200 && r14.json.event_id) {
          addEvidence(
            'com_eventos_integracao',
            r14.json.event_id,
            getCreated('com_eventos_integracao', r14.json.event_id),
            diffExtId,
          )
          var smV2 = findVinculo('contact', diffExtId)
          if (smV2) {
            addEvidence(
              'com_vinculos_externos',
              smV2.id,
              smV2.getString('created') || '',
              diffExtId,
            )
            addEvidence(
              'com_contatos',
              smV2.getString('record_id'),
              getCreated('com_contatos', smV2.getString('record_id')),
              diffExtId,
            )
          }
        }
      }

      if (!stopReason && mode === 'full') {
        var fn = {}
        var contactExtId = correlationKey + '-FN-C1'
        var cp = sign({
          type: 'contact_create',
          contact: {
            id: contactExtId,
            firstName: '[TESTE]',
            lastName: 'R3Full',
            email: 'teste-r3-full@teste.local',
            phone: '+5511999999999',
          },
        })
        var fcb1 = getCounts()
        var fr1 = callWH('POST', cp.headers, cp.body)
        var fca1 = getCounts()
        fn.contact_create = {
          status: fr1.status,
          pass: fr1.status === 200,
          beforeCounts: fcb1,
          afterCounts: fca1,
        }
        if (fr1.status !== 200) stopReason = 'FN contact_create FAIL'
        if (fr1.status === 200) {
          if (fr1.json.event_id) {
            fn.contact_create.eventId = String(fr1.json.event_id).substring(0, 8)
            addEvidence(
              'com_eventos_integracao',
              fr1.json.event_id,
              getCreated('com_eventos_integracao', fr1.json.event_id),
              contactExtId,
            )
          }
          var cV = findVinculo('contact', contactExtId)
          if (cV) {
            fn.contact_create.vinculoId = cV.id.substring(0, 8)
            fn.contact_create.contactId = cV.getString('record_id').substring(0, 8)
            fn.contact_create.created = getCreated('com_contatos', cV.getString('record_id'))
            addEvidence('com_vinculos_externos', cV.id, cV.getString('created') || '', contactExtId)
            addEvidence(
              'com_contatos',
              cV.getString('record_id'),
              fn.contact_create.created,
              contactExtId,
            )
          }
        }
        if (!stopReason) {
          var fcb2 = getCounts()
          var fr2 = callWH('POST', cp.headers, cp.body)
          var fca2 = getCounts()
          fn.idempotency_replay = {
            status: fr2.status,
            pass: fr2.status === 409 && fr2.json.duplicate === true,
            duplicate: fr2.json.duplicate,
            beforeCounts: fcb2,
            afterCounts: fca2,
          }
          if (fr2.status !== 409) stopReason = 'FN idempotency_replay FAIL'
        }
        var dealExtId = correlationKey + '-FN-D1'
        if (!stopReason) {
          var dp = sign({
            type: 'deal_create',
            deal: {
              id: dealExtId,
              title: '[TESTE] R3 Full Negocio',
              value: 10000,
              stage: 'prospects',
            },
          })
          var fcb3 = getCounts()
          var fr3 = callWH('POST', dp.headers, dp.body)
          var fca3 = getCounts()
          fn.deal_create = {
            status: fr3.status,
            pass: fr3.status === 200,
            beforeCounts: fcb3,
            afterCounts: fca3,
          }
          if (fr3.status !== 200) stopReason = 'FN deal_create FAIL'
          if (fr3.status === 200) {
            if (fr3.json.event_id) {
              fn.deal_create.eventId = String(fr3.json.event_id).substring(0, 8)
              addEvidence(
                'com_eventos_integracao',
                fr3.json.event_id,
                getCreated('com_eventos_integracao', fr3.json.event_id),
                dealExtId,
              )
            }
            var dV = findVinculo('business', dealExtId)
            if (dV) {
              fn.deal_create.vinculoId = dV.id.substring(0, 8)
              fn.deal_create.negocioId = dV.getString('record_id').substring(0, 8)
              fn.deal_create.created = getCreated('com_negocios', dV.getString('record_id'))
              addEvidence('com_vinculos_externos', dV.id, dV.getString('created') || '', dealExtId)
              addEvidence(
                'com_negocios',
                dV.getString('record_id'),
                fn.deal_create.created,
                dealExtId,
              )
            }
          }
        }
        if (!stopReason) {
          var up = sign({
            type: 'deal_update',
            deal: {
              id: dealExtId,
              title: '[TESTE] R3 Full Atualizado',
              value: 15000,
              stage: 'producao_proposta',
            },
          })
          var fcb4 = getCounts()
          var fr4 = callWH('POST', up.headers, up.body)
          var fca4 = getCounts()
          var snapCt = fca4.snapshots - fcb4.snapshots
          fn.deal_update_snapshot = {
            status: fr4.status,
            pass: fr4.status === 200 && snapCt > 0,
            snapshotsCreated: snapCt,
            beforeCounts: fcb4,
            afterCounts: fca4,
          }
          if (fr4.status !== 200 || snapCt <= 0) stopReason = 'FN deal_update_snapshot FAIL'
          if (fr4.status === 200 && snapCt > 0) {
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
                if (snaps.length > 0) {
                  fn.deal_update_snapshot.snapshotId = snaps[0].id.substring(0, 8)
                  addEvidence(
                    'com_snapshots_negocio',
                    snaps[0].id,
                    snaps[0].getString('created') || '',
                    dealExtId,
                  )
                }
              } catch (_) {}
            }
          }
        }
        var unmappedExtId = correlationKey + '-FN-D2'
        if (!stopReason) {
          var um = sign({
            type: 'deal_create',
            deal: {
              id: unmappedExtId,
              title: '[TESTE] R3 Full Sem Map',
              value: 5000,
              stage: 'unmapped_stage_xyz',
            },
          })
          var fcb5 = getCounts()
          var fr5 = callWH('POST', um.headers, um.body)
          var fca5 = getCounts()
          fn.unmapped_stage_quality = {
            status: fr5.status,
            pass: fr5.status === 200 && fca5.ocorrencias > fcb5.ocorrencias,
            beforeCounts: fcb5,
            afterCounts: fca5,
          }
          if (fr5.status !== 200 || fca5.ocorrencias <= fcb5.ocorrencias)
            stopReason = 'FN unmapped_stage_quality FAIL'
          if (fr5.status === 200 && fca5.ocorrencias > fcb5.ocorrencias) {
            try {
              var occs = $app.findRecordsByFilter('com_ocorrencias_qualidade', '', '-created', 1, 0)
              if (occs.length > 0) {
                fn.unmapped_stage_quality.occurrenceId = occs[0].id.substring(0, 8)
                addEvidence(
                  'com_ocorrencias_qualidade',
                  occs[0].id,
                  occs[0].getString('created') || '',
                  unmappedExtId,
                )
              }
            } catch (_) {}
          }
        }
        if (!stopReason) {
          var fcb6 = getCounts()
          var rbRes = callRB(dealExtId, 'business')
          var fca6 = getCounts()
          var dealRestored = false
          var dV3 = findVinculo('business', dealExtId)
          if (dV3) {
            try {
              var negRec = $app.findRecordById('com_negocios', dV3.getString('record_id'))
              dealRestored =
                negRec.getString('titulo') === '[TESTE] R3 Full Negocio' &&
                negRec.getString('etapa') === 'prospects'
            } catch (_) {}
          }
          fn.rollback = {
            status: rbRes.status,
            pass: rbRes.status === 200 && dealRestored,
            restored: dealRestored,
            beforeCounts: fcb6,
            afterCounts: fca6,
          }
          if (rbRes.status !== 200) stopReason = 'FN rollback FAIL'
          if (rbRes.json.rolled_back && rbRes.json.rolled_back.length > 0) {
            for (var ri = 0; ri < rbRes.json.rolled_back.length; ri++) {
              var rbItem = rbRes.json.rolled_back[ri]
              if (rbItem.compensating_event) {
                fn.rollback.compensatingEventId = String(rbItem.compensating_event).substring(0, 8)
                addEvidence(
                  'com_eventos_integracao',
                  rbItem.compensating_event,
                  getCreated('com_eventos_integracao', rbItem.compensating_event),
                  dealExtId,
                )
              }
            }
          }
        }
        if (!stopReason) {
          var rbRes2 = callRB(dealExtId, 'business')
          fn.rollback_idempotency = {
            status: rbRes2.status,
            pass: rbRes2.status === 200 || rbRes2.status === 404,
          }
        }
        functionalResults = fn
      }
    } finally {
      setWH(false)
    }

    var deactRes = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
    deactivationProof = {
      status: deactRes.status,
      pass: deactRes.status === 503,
      webhookEnabled: false,
    }

    var afterCounts = getCounts()
    var smPassed = securityMatrix.length > 0
    for (var si = 0; si < securityMatrix.length; si++) {
      if (!securityMatrix[si].passed) {
        smPassed = false
        break
      }
    }

    return e.json(200, {
      httpStatus: stopReason ? 500 : 200,
      correlationKey: correlationKey,
      mode: mode,
      securityMatrix: securityMatrix,
      securityMatrixPassed: smPassed,
      functionalResults: functionalResults,
      deactivationProof: deactivationProof,
      evidenceLedger: evidenceLedger,
      stopReason: stopReason,
      beforeCounts: beforeCounts,
      afterCounts: afterCounts,
      webhookActive: false,
      flagFinal: false,
    })
  },
  $apis.requireAuth(),
)
