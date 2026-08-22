migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_execucoes_sincronizacao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'sistema_origem', type: 'text', max: 50 },
        { name: 'status', type: 'text', max: 30 },
        { name: 'payload', type: 'text', max: 4000 },
        { name: 'erro', type: 'text', max: 2000 },
        { name: 'inicio', type: 'date' },
        { name: 'fim', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_execucoes_sincronizacao_status ON com_execucoes_sincronizacao (status)',
        'CREATE INDEX idx_com_execucoes_sincronizacao_origem ON com_execucoes_sincronizacao (sistema_origem)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_execucoes_sincronizacao')
      app.delete(collection)
    } catch (_) {}
  },
)
