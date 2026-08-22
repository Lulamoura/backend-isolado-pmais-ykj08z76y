migrate(
  (app) => {
    // === PRE-CHECK (read-only) — stop rule ===
    var blk = []

    var evts = app.findRecordsByFilter('com_eventos_integracao', '', '', 500, 0)
    var nullKeys = [],
      seenKeys = {}
    for (var i = 0; i < evts.length; i++) {
      var k = evts[i].getString('idempotency_key')
      if (!k) {
        nullKeys.push(evts[i].id)
      }
      if (k) {
        if (seenKeys[k]) {
          blk.push({ check: 'duplicate idempotency_key', value: k })
        }
        seenKeys[k] = 1
      }
    }
    if (nullKeys.length)
      blk.push({ check: 'null/empty idempotency_key', count: nullKeys.length, ids: nullKeys })

    var vins = app.findRecordsByFilter('com_vinculos_externos', '', '', 500, 0)
    var nullType = [],
      nullId = [],
      seenCombos = {}
    for (var j = 0; j < vins.length; j++) {
      var t = vins[j].getString('external_type')
      var id = vins[j].getString('external_id')
      if (!t) {
        nullType.push(vins[j].id)
      }
      if (!id) {
        nullId.push(vins[j].id)
      }
      if (t && id) {
        var c = vins[j].getString('sistema_origem') + '|' + t + '|' + id
        if (seenCombos[c]) {
          blk.push({ check: 'duplicate (sistema_origem, external_type, external_id)', value: c })
        }
        seenCombos[c] = 1
      }
    }
    if (nullType.length)
      blk.push({ check: 'null/empty external_type', count: nullType.length, ids: nullType })
    if (nullId.length)
      blk.push({ check: 'null/empty external_id', count: nullId.length, ids: nullId })

    if (blk.length) {
      var msg = 'PRE-CHECK FAILED — blockages found, migration aborted:\n'
      for (var b = 0; b < blk.length; b++) {
        msg += JSON.stringify(blk[b]) + '\n'
      }
      throw new Error(msg)
    }

    // === MAKE FIELDS REQUIRED (preserve UNIQUE indexes) ===
    var evCol = app.findCollectionByNameOrId('com_eventos_integracao')
    evCol.fields.removeByName('idempotency_key')
    evCol.fields.add(new TextField({ name: 'idempotency_key', required: true, max: 200 }))
    app.save(evCol)

    var viCol = app.findCollectionByNameOrId('com_vinculos_externos')
    viCol.fields.removeByName('external_type')
    viCol.fields.add(new TextField({ name: 'external_type', required: true, max: 50 }))
    viCol.fields.removeByName('external_id')
    viCol.fields.add(new TextField({ name: 'external_id', required: true, max: 200 }))
    app.save(viCol)

    // === NATIVE RBAC CLOSURE (least privilege, real schema) ===
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var HR =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    var HC =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')"

    function setRules(name, lr, vr, cr, ur) {
      var c = app.findCollectionByNameOrId(name)
      c.listRule = lr
      c.viewRule = vr
      c.createRule = cr
      if (ur !== undefined) c.updateRule = ur
      app.save(c)
    }

    setRules('com_etapas', SI, SI, SI, SI)
    setRules('com_alias_dimensoes', SI, SI, SI, SI)
    setRules('com_vinculos_externos', SI, SI, SI, SI)
    setRules('com_execucoes_sincronizacao', SI, SI, SI, SO)
    setRules('com_eventos_integracao', SI, SI, SI, SO)
    setRules('com_snapshots_negocio', SI, SI, SO, null)
    setRules('com_ocorrencias_qualidade', SI, SI, SI, SO)
    setRules('com_negocio_historico', HR, HR, HC, null)

    // com_auditoria createRule — integracao must NOT create audit records
    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.createRule = HC
    app.save(audCol)

    // === REVOKE snapshots_negocio.create from integracao profile ===
    try {
      var intP = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')
      var snapPerm = app.findFirstRecordByData('com_permissoes', 'slug', 'snapshots_negocio.create')
      try {
        var link = app.findFirstRecordByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + intP.id + "' && permissao_id = '" + snapPerm.id + "'",
        )
        app.delete(link)
      } catch (_) {}
    } catch (_) {}
  },
  (app) => {
    // === ROLLBACK ===
    var G = "@request.auth.id != ''"

    var evCol = app.findCollectionByNameOrId('com_eventos_integracao')
    evCol.fields.removeByName('idempotency_key')
    evCol.fields.add(new TextField({ name: 'idempotency_key', required: false, max: 200 }))
    evCol.listRule = G
    evCol.viewRule = G
    evCol.createRule = G
    evCol.updateRule = G
    app.save(evCol)

    var viCol = app.findCollectionByNameOrId('com_vinculos_externos')
    viCol.fields.removeByName('external_type')
    viCol.fields.add(new TextField({ name: 'external_type', required: false, max: 50 }))
    viCol.fields.removeByName('external_id')
    viCol.fields.add(new TextField({ name: 'external_id', required: false, max: 200 }))
    viCol.listRule = G
    viCol.viewRule = G
    viCol.createRule = G
    viCol.updateRule = G
    app.save(viCol)

    function resetRules(name, ur) {
      var c = app.findCollectionByNameOrId(name)
      c.listRule = G
      c.viewRule = G
      c.createRule = G
      if (ur !== undefined) c.updateRule = ur
      app.save(c)
    }

    resetRules('com_etapas', G)
    resetRules('com_alias_dimensoes', G)
    resetRules('com_vinculos_externos', G)
    resetRules('com_execucoes_sincronizacao', G)
    resetRules('com_eventos_integracao', G)
    resetRules('com_snapshots_negocio', null)
    resetRules('com_ocorrencias_qualidade', G)
    resetRules('com_negocio_historico', null)

    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.createRule = G
    app.save(audCol)

    // Re-grant snapshots_negocio.create to integracao
    try {
      var intP = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')
      var snapPerm = app.findFirstRecordByData('com_permissoes', 'slug', 'snapshots_negocio.create')
      try {
        app.findFirstRecordByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + intP.id + "' && permissao_id = '" + snapPerm.id + "'",
        )
      } catch (_) {
        var ppCol = app.findCollectionByNameOrId('com_perfil_permissoes')
        var lr = new Record(ppCol)
        lr.set('perfil_id', intP.id)
        lr.set('permissao_id', snapPerm.id)
        lr.set('escopo', 'todos')
        app.save(lr)
      }
    } catch (_) {}
  },
)
