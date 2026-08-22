migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_parametros',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'chave',
          type: 'text',
          required: true,
          min: 2,
          max: 100,
          pattern: '^[a-z0-9._-]+$',
        },
        { name: 'valor', type: 'text', required: true, max: 1000 },
        { name: 'descricao', type: 'text', max: 500 },
        { name: 'versao', type: 'number', required: true, min: 1, onlyInt: true },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_parametros_chave ON com_parametros (chave)',
        'CREATE INDEX idx_com_parametros_ativo ON com_parametros (ativo)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_parametros')
      app.delete(collection)
    } catch (_) {}
  },
)
