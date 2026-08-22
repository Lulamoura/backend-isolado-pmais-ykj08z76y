migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_eventos_integracao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'sistema_origem', type: 'text', max: 50 },
        { name: 'evento_tipo', type: 'text', max: 50 },
        { name: 'external_id', type: 'text', max: 200 },
        { name: 'idempotency_key', type: 'text', max: 200 },
        { name: 'payload', type: 'text', max: 4000 },
        { name: 'status', type: 'text', max: 30 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_eventos_integracao_idempotency ON com_eventos_integracao (idempotency_key)',
        'CREATE INDEX idx_com_eventos_integracao_origem ON com_eventos_integracao (sistema_origem)',
        'CREATE INDEX idx_com_eventos_integracao_status ON com_eventos_integracao (status)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_eventos_integracao')
      app.delete(collection)
    } catch (_) {}
  },
)
