migrate(
  (app) => {
    const negociosCol = app.findCollectionByNameOrId('com_negocios')
    const collection = new Collection({
      name: 'com_snapshots_negocio',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'negocio_id',
          type: 'relation',
          required: true,
          collectionId: negociosCol.id,
          maxSelect: 1,
        },
        { name: 'snapshot', type: 'text', max: 8000 },
        { name: 'origem', type: 'text', max: 50 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_snapshots_negocio_negocio ON com_snapshots_negocio (negocio_id)',
        'CREATE INDEX idx_com_snapshots_negocio_origem ON com_snapshots_negocio (origem)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_snapshots_negocio')
      app.delete(collection)
    } catch (_) {}
  },
)
