migrate(
  function (app) {
    try {
      app.findCollectionByNameOrId('com_nexo_sugestao_feedback_v1')
      return
    } catch (_) {}

    var collection = new Collection({
      type: 'base',
      name: 'com_nexo_sugestao_feedback_v1',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })

    collection.fields.add(new TextField({ name: 'external_id', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
    collection.fields.add(new TextField({ name: 'resultado', required: true, max: 40 }))
    collection.fields.add(new TextField({ name: 'usuario_id', required: true, max: 80 }))
    collection.fields.add(new DateField({ name: 'created_at', required: true }))

    collection.indexes = [
      'CREATE UNIQUE INDEX idx_nexo_feedback_audit_usuario ON com_nexo_sugestao_feedback_v1 (audit_id, usuario_id)',
      'CREATE INDEX idx_nexo_feedback_external_created ON com_nexo_sugestao_feedback_v1 (external_id, created_at)',
    ]

    app.save(collection)
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_nexo_sugestao_feedback_v1'))
    } catch (_) {}
  },
)
