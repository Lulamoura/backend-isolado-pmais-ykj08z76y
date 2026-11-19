migrate(
  function (app) {
    var collectionName = 'com_nexo_curadoria_worker_estado'
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
      var keys = ['required', 'max', 'min', 'onlyInt', 'maxSize']
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
    addOrValidate(new TextField({ name: 'gate_version', required: true, max: 120 }))
    addOrValidate(new TextField({ name: 'cursor_created', required: true, max: 30 }))
    addOrValidate(new TextField({ name: 'cursor_id', required: true, max: 15 }))
    addOrValidate(new JSONField({ name: 'pending_ledger_ids', required: false, maxSize: 5000 }))
    addOrValidate(new JSONField({ name: 'pending_ledger_hashes', required: false, maxSize: 30000 }))
    addOrValidate(new TextField({ name: 'lease_owner', required: false, max: 64 }))
    addOrValidate(new DateField({ name: 'lease_expires_at', required: false }))
    addOrValidate(
      new NumberField({ name: 'processed_records', required: false, min: 0, onlyInt: true }),
    )
    addOrValidate(new TextField({ name: 'last_result_code', required: true, max: 40 }))
    addOrValidate(new DateField({ name: 'last_executed_at', required: true }))

    collection.indexes = [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_worker_estado_identidade ON com_nexo_curadoria_worker_estado (worker_identity)',
      'CREATE INDEX idx_com_nexo_curadoria_worker_estado_lease ON com_nexo_curadoria_worker_estado (lease_expires_at)',
    ]
    app.save(collection)
  },
  function (_) {
    // Intentionally non-destructive: cursor, accumulator, and lease protect replay safety.
  },
)
