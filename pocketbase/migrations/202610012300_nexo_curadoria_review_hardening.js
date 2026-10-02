migrate(
  function (app) {
    function sameFieldValue(left, right) {
      if (left === right) return true
      return (
        left !== null &&
        right !== null &&
        typeof left === 'object' &&
        typeof right === 'object' &&
        String(left) === String(right)
      )
    }

    function addOrValidate(collection, name, field) {
      var existing = collection.fields.getByName(name)
      if (!existing) {
        collection.fields.add(field)
        return
      }

      if (existing.type() !== field.type()) {
        throw new Error('incompatible field ' + collection.name + '.' + name + ': type')
      }

      var keys = ['required', 'max', 'min', 'maxSize', 'onlyInt']
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        if (field[key] !== undefined && !sameFieldValue(existing[key], field[key])) {
          throw new Error('incompatible field ' + collection.name + '.' + name + ': ' + key)
        }
      }
    }

    function indexName(definition) {
      var match = String(definition).match(
        /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|\[([^\]]+)\]|([^\s]+))/i,
      )
      return match ? match[1] || match[2] || match[3] : null
    }

    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (indexName(indexes[i]) !== name) out.push(indexes[i])
      }
      return out
    }

    function normalizeSql(definition) {
      return String(definition).trim().replace(/\s+/g, ' ').toLowerCase()
    }

    function preflightPopulated(collection, requiredFields, uniqueIndexes) {
      try {
        app.findCollectionByNameOrId(collection.name)
      } catch (_) {
        return
      }
      if (app.countRecords(collection.name) === 0) return

      var problems = []
      for (var fi = 0; fi < requiredFields.length; fi++) {
        var expected = requiredFields[fi]
        var existing = collection.fields.getByName(expected.name)
        if (!existing) {
          problems.push('missing required field ' + expected.name)
          continue
        }
        if (existing.type() !== expected.type()) {
          problems.push('incompatible required field ' + expected.name + '.type')
          continue
        }
        var keys = ['required', 'max', 'min', 'maxSize', 'onlyInt']
        for (var ki = 0; ki < keys.length; ki++) {
          var key = keys[ki]
          if (expected[key] !== undefined && !sameFieldValue(existing[key], expected[key])) {
            problems.push('incompatible required field ' + expected.name + '.' + key)
            break
          }
        }
      }
      for (var ii = 0; ii < uniqueIndexes.length; ii++) {
        var expectedIndex = uniqueIndexes[ii]
        var matches = 0
        for (var ci = 0; ci < (collection.indexes || []).length; ci++) {
          if (
            indexName(collection.indexes[ci]) === indexName(expectedIndex) &&
            normalizeSql(collection.indexes[ci]) === normalizeSql(expectedIndex)
          ) {
            matches++
          }
        }
        if (matches !== 1)
          problems.push('missing or incompatible unique index ' + indexName(expectedIndex))
      }

      if (problems.length > 0) {
        throw new Error(
          'populated partial Curadoria collection ' +
            collection.name +
            ': ' +
            problems.join(', ') +
            '; refusing schema changes',
        )
      }
    }

    var auditoria
    try {
      auditoria = app.findCollectionByNameOrId('com_nexo_curadoria_outbox_auditoria')
    } catch (_) {
      auditoria = new Collection({
        type: 'base',
        name: 'com_nexo_curadoria_outbox_auditoria',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
    }
    preflightPopulated(
      auditoria,
      [
        new TextField({ name: 'outbox_id', required: true, max: 80 }),
        new NumberField({ name: 'retry_count', required: true, min: 1, onlyInt: true }),
        new TextField({ name: 'ator_id', required: true, max: 80 }),
        new TextField({ name: 'motivo', required: true, max: 1000 }),
        new TextField({ name: 'status_anterior', required: true, max: 80 }),
        new DateField({ name: 'requested_at', required: true }),
      ],
      [
        'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (outbox_id, retry_count)',
      ],
    )

    var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
    addOrValidate(
      ledger,
      'payload_hash',
      new TextField({ name: 'payload_hash', required: false, max: 160 }),
    )
    addOrValidate(
      ledger,
      'negocio_id',
      new TextField({ name: 'negocio_id', required: false, max: 80 }),
    )
    addOrValidate(
      ledger,
      'responsavel_id',
      new TextField({ name: 'responsavel_id', required: false, max: 80 }),
    )
    addOrValidate(
      ledger,
      'equipe_id',
      new TextField({ name: 'equipe_id', required: false, max: 80 }),
    )
    ledger.indexes = withoutIndex(ledger.indexes, 'idx_com_ledger_comercial_audit')
    ledger.indexes = withoutIndex(ledger.indexes, 'idx_com_ledger_comercial_audit_unique')
    ledger.indexes.push(
      "CREATE UNIQUE INDEX idx_com_ledger_comercial_audit_unique ON com_ledger_comercial (audit_id) WHERE audit_id != ''",
    )
    app.save(ledger)

    var casos = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
    addOrValidate(
      casos,
      'responsavel_id',
      new TextField({ name: 'responsavel_id', required: false, max: 80 }),
    )
    addOrValidate(
      casos,
      'equipe_id',
      new TextField({ name: 'equipe_id', required: false, max: 80 }),
    )
    addOrValidate(
      casos,
      'negocio_id',
      new TextField({ name: 'negocio_id', required: false, max: 80 }),
    )
    casos.indexes = withoutIndex(casos.indexes, 'idx_com_nexo_curadoria_casos_autorizacao')
    casos.indexes.push(
      'CREATE INDEX idx_com_nexo_curadoria_casos_autorizacao ON com_nexo_curadoria_casos (equipe_id, responsavel_id, negocio_id)',
    )
    app.save(casos)

    var outbox = app.findCollectionByNameOrId('com_nexo_curadoria_outbox')
    addOrValidate(
      outbox,
      'next_attempt_at',
      new DateField({ name: 'next_attempt_at', required: false }),
    )
    addOrValidate(
      outbox,
      'last_attempt_at',
      new DateField({ name: 'last_attempt_at', required: false }),
    )
    addOrValidate(
      outbox,
      'tentativas_ciclo',
      new NumberField({ name: 'tentativas_ciclo', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      outbox,
      'retry_count',
      new NumberField({ name: 'retry_count', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      outbox,
      'retry_requested_by',
      new TextField({ name: 'retry_requested_by', required: false, max: 80 }),
    )
    addOrValidate(
      outbox,
      'retry_reason',
      new TextField({ name: 'retry_reason', required: false, max: 1000 }),
    )
    addOrValidate(
      outbox,
      'superseded_by',
      new TextField({ name: 'superseded_by', required: false, max: 80 }),
    )
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_caso_revisao')
    outbox.indexes.push(
      'CREATE INDEX idx_com_nexo_curadoria_outbox_caso_revisao ON com_nexo_curadoria_outbox (caso_id, caso_revisao, status)',
    )
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_retry')
    outbox.indexes.push(
      'CREATE INDEX idx_com_nexo_curadoria_outbox_retry ON com_nexo_curadoria_outbox (status, next_attempt_at, requested_at)',
    )
    app.save(outbox)

    auditoria.createRule = null
    auditoria.updateRule = null
    auditoria.deleteRule = null
    auditoria.listRule = null
    auditoria.viewRule = null
    addOrValidate(
      auditoria,
      'outbox_id',
      new TextField({ name: 'outbox_id', required: true, max: 80 }),
    )
    addOrValidate(
      auditoria,
      'retry_count',
      new NumberField({ name: 'retry_count', required: true, min: 1, onlyInt: true }),
    )
    addOrValidate(auditoria, 'ator_id', new TextField({ name: 'ator_id', required: true, max: 80 }))
    addOrValidate(auditoria, 'motivo', new TextField({ name: 'motivo', required: true, max: 1000 }))
    addOrValidate(
      auditoria,
      'status_anterior',
      new TextField({ name: 'status_anterior', required: true, max: 80 }),
    )
    addOrValidate(
      auditoria,
      'requested_at',
      new DateField({ name: 'requested_at', required: true }),
    )
    auditoria.indexes = withoutIndex(
      auditoria.indexes,
      'idx_com_nexo_curadoria_outbox_auditoria_retry',
    )
    auditoria.indexes.push(
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (outbox_id, retry_count)',
    )
    auditoria.indexes = withoutIndex(
      auditoria.indexes,
      'idx_com_nexo_curadoria_outbox_auditoria_data',
    )
    auditoria.indexes.push(
      'CREATE INDEX idx_com_nexo_curadoria_outbox_auditoria_data ON com_nexo_curadoria_outbox_auditoria (requested_at)',
    )
    app.save(auditoria)
  },
  function (_) {
    // Intentionally non-destructive: all touched collections may already contain records.
  },
)
