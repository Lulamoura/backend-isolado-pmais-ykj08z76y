migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_vinculos_externos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'sistema_origem', type: 'text', required: true, max: 50 },
        { name: 'external_type', type: 'text', max: 50 },
        { name: 'external_id', type: 'text', max: 200 },
        { name: 'collection_name', type: 'text', max: 100 },
        { name: 'record_id', type: 'text', max: 200 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_vinculos_externos_origem_type_id ON com_vinculos_externos (sistema_origem, external_type, external_id)',
        'CREATE INDEX idx_com_vinculos_externos_collection_record ON com_vinculos_externos (collection_name, record_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_vinculos_externos')
      app.delete(collection)
    } catch (_) {}
  },
)
