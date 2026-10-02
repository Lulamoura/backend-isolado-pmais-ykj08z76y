migrate(
  function (app) {
    function addIfMissing(collection, name, field) {
      try {
        collection.fields.getByName(name)
      } catch (_) {
        collection.fields.add(field)
      }
    }

    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (String(indexes[i]).indexOf(name) === -1) out.push(indexes[i])
      }
      return out
    }

    var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
    addIfMissing(
      ledger,
      'payload_hash',
      new TextField({ name: 'payload_hash', required: false, max: 160 }),
    )
    addIfMissing(
      ledger,
      'negocio_id',
      new TextField({ name: 'negocio_id', required: false, max: 80 }),
    )
    addIfMissing(
      ledger,
      'responsavel_id',
      new TextField({ name: 'responsavel_id', required: false, max: 80 }),
    )
    addIfMissing(
      ledger,
      'equipe_id',
      new TextField({ name: 'equipe_id', required: false, max: 80 }),
    )
    ledger.indexes = withoutIndex(ledger.indexes, 'idx_com_ledger_comercial_audit')
    ledger.indexes.push(
      "CREATE UNIQUE INDEX idx_com_ledger_comercial_audit_unique ON com_ledger_comercial (audit_id) WHERE audit_id != ''",
    )
    app.save(ledger)

    var casos = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
    addIfMissing(
      casos,
      'responsavel_id',
      new TextField({ name: 'responsavel_id', required: false, max: 80 }),
    )
    addIfMissing(casos, 'equipe_id', new TextField({ name: 'equipe_id', required: false, max: 80 }))
    addIfMissing(
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
    addIfMissing(
      outbox,
      'next_attempt_at',
      new DateField({ name: 'next_attempt_at', required: false }),
    )
    addIfMissing(
      outbox,
      'last_attempt_at',
      new DateField({ name: 'last_attempt_at', required: false }),
    )
    addIfMissing(
      outbox,
      'tentativas_ciclo',
      new NumberField({ name: 'tentativas_ciclo', required: false, min: 0, onlyInt: true }),
    )
    addIfMissing(
      outbox,
      'retry_count',
      new NumberField({ name: 'retry_count', required: false, min: 0, onlyInt: true }),
    )
    addIfMissing(
      outbox,
      'retry_requested_by',
      new TextField({ name: 'retry_requested_by', required: false, max: 80 }),
    )
    addIfMissing(
      outbox,
      'retry_reason',
      new TextField({ name: 'retry_reason', required: false, max: 1000 }),
    )
    addIfMissing(
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

    var auditoria = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_outbox_auditoria',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    auditoria.fields.add(new TextField({ name: 'outbox_id', required: true, max: 80 }))
    auditoria.fields.add(
      new NumberField({ name: 'retry_count', required: true, min: 1, onlyInt: true }),
    )
    auditoria.fields.add(new TextField({ name: 'ator_id', required: true, max: 80 }))
    auditoria.fields.add(new TextField({ name: 'motivo', required: true, max: 1000 }))
    auditoria.fields.add(new TextField({ name: 'status_anterior', required: true, max: 80 }))
    auditoria.fields.add(new DateField({ name: 'requested_at', required: true }))
    auditoria.indexes = [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (outbox_id, retry_count)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_auditoria_data ON com_nexo_curadoria_outbox_auditoria (requested_at)',
    ]
    app.save(auditoria)
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_nexo_curadoria_outbox_auditoria'))
    } catch (_) {}

    function removeIfPresent(collection, name) {
      try {
        collection.fields.removeByName(name)
      } catch (_) {}
    }
    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (String(indexes[i]).indexOf(name) === -1) out.push(indexes[i])
      }
      return out
    }

    var outbox = app.findCollectionByNameOrId('com_nexo_curadoria_outbox')
    var outboxFields = [
      'next_attempt_at',
      'last_attempt_at',
      'tentativas_ciclo',
      'retry_count',
      'retry_requested_by',
      'retry_reason',
      'superseded_by',
    ]
    for (var oi = 0; oi < outboxFields.length; oi++) removeIfPresent(outbox, outboxFields[oi])
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_caso_revisao')
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_retry')
    app.save(outbox)

    var casos = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
    removeIfPresent(casos, 'responsavel_id')
    removeIfPresent(casos, 'equipe_id')
    removeIfPresent(casos, 'negocio_id')
    casos.indexes = withoutIndex(casos.indexes, 'idx_com_nexo_curadoria_casos_autorizacao')
    app.save(casos)

    var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
    removeIfPresent(ledger, 'payload_hash')
    removeIfPresent(ledger, 'negocio_id')
    removeIfPresent(ledger, 'responsavel_id')
    removeIfPresent(ledger, 'equipe_id')
    ledger.indexes = withoutIndex(ledger.indexes, 'idx_com_ledger_comercial_audit_unique')
    ledger.indexes.push(
      'CREATE INDEX idx_com_ledger_comercial_audit ON com_ledger_comercial (audit_id)',
    )
    app.save(ledger)
  },
)
