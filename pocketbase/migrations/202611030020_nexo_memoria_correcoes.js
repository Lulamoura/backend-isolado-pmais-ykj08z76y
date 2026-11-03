migrate(
  function (app) {
    try {
      app.findCollectionByNameOrId('com_nexo_memoria_correcoes_v1')
      return
    } catch (_) {}

    var collection = new Collection({
      type: 'base',
      name: 'com_nexo_memoria_correcoes_v1',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    collection.fields.add(new TextField({ name: 'external_id', required: true, max: 80 }))
    collection.fields.add(
      new NumberField({ name: 'revision', required: true, min: 1, onlyInt: true }),
    )
    collection.fields.add(new TextField({ name: 'schema_version', required: true, max: 80 }))
    collection.fields.add(new JSONField({ name: 'signals', required: true, maxSize: 4000 }))
    collection.fields.add(new TextField({ name: 'snapshot_hash', required: true, max: 64 }))
    collection.fields.add(new TextField({ name: 'usuario_id', required: true, max: 80 }))
    collection.fields.add(new DateField({ name: 'created_at', required: true }))
    collection.indexes = [
      'CREATE UNIQUE INDEX idx_nexo_memoria_correcao_revision ON com_nexo_memoria_correcoes_v1 (external_id, revision)',
      'CREATE INDEX idx_nexo_memoria_correcao_latest ON com_nexo_memoria_correcoes_v1 (external_id, revision DESC)',
    ]
    app.save(collection)
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_nexo_memoria_correcoes_v1'))
    } catch (_) {}
  },
)
