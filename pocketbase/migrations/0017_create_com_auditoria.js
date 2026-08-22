migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_auditoria',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'collection_name', type: 'text', required: true, max: 100 },
        { name: 'record_id', type: 'text', required: true, max: 100 },
        { name: 'usuario_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'acao',
          type: 'select',
          required: true,
          values: ['create', 'update', 'inactivate', 'delete'],
          maxSelect: 1,
        },
        { name: 'valor_anterior', type: 'text', max: 4000 },
        { name: 'valor_novo', type: 'text', max: 4000 },
        { name: 'justificativa', type: 'text', max: 1000 },
        { name: 'origem_alteracao', type: 'text', max: 50 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_auditoria_collection_record ON com_auditoria (collection_name, record_id)',
        'CREATE INDEX idx_com_auditoria_created ON com_auditoria (created)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_auditoria')
      app.delete(collection)
    } catch (_) {}
  },
)
