migrate(
  function (app) {
    var collectionName = 'com_nexo_curadoria_execucoes'
    var collection
    try {
      collection = app.findCollectionByNameOrId(collectionName)
    } catch (_) {
      collection = new Collection({
        type: 'base',
        name: collectionName,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
    }

    function same(left, right) {
      if (left === right) return true
      return (
        left !== null &&
        right !== null &&
        typeof left === 'object' &&
        typeof right === 'object' &&
        String(left) === String(right)
      )
    }

    function addOrValidate(field) {
      var existing = collection.fields.getByName(field.name)
      if (!existing) {
        collection.fields.add(field)
        return
      }
      if (existing.type() !== field.type())
        throw new Error('incompatible field ' + collectionName + '.' + field.name + ': type')
      var keys = ['required', 'max', 'min', 'onlyInt']
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        if (field[key] !== undefined && !same(existing[key], field[key]))
          throw new Error('incompatible field ' + collectionName + '.' + field.name + ': ' + key)
      }
    }

    collection.createRule = null
    collection.updateRule = null
    collection.deleteRule = null
    collection.listRule = null
    collection.viewRule = null

    addOrValidate(new TextField({ name: 'worker_identity', required: true, max: 80 }))
    addOrValidate(new TextField({ name: 'result_code', required: true, max: 40 }))
    addOrValidate(new TextField({ name: 'execution_scope', required: true, max: 80 }))
    addOrValidate(new TextField({ name: 'activation_cutoff_created', required: true, max: 30 }))
    addOrValidate(new TextField({ name: 'activation_cutoff_id', required: true, max: 15 }))
    addOrValidate(new TextField({ name: 'ledger_snapshot_hash', required: true, max: 64 }))
    addOrValidate(
      new NumberField({ name: 'selected_ledger_records', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'cases_created', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'cases_updated', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'evidence_created', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'transitions_created', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'outbox_created', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'outbox_processed', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'outbox_failed', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'outbox_invalidated', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'automatic_cases', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'human_exceptions', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({ name: 'human_exceptions_new', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(
      new NumberField({
        name: 'open_human_exceptions_before',
        required: false,
        min: 0,
        onlyInt: true,
      }),
    )
    addOrValidate(new DateField({ name: 'executed_at', required: true }))

    collection.indexes = [
      'CREATE INDEX idx_com_nexo_curadoria_execucoes_data ON com_nexo_curadoria_execucoes (executed_at)',
      'CREATE INDEX idx_com_nexo_curadoria_execucoes_resultado ON com_nexo_curadoria_execucoes (result_code, executed_at)',
    ]
    app.save(collection)
  },
  function (_) {
    // Intentionally non-destructive: execution metrics are an audit trail.
  },
)
